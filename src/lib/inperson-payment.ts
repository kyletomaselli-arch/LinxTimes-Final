import "server-only";
import { prisma } from "./prisma";
import { getStripe } from "./stripe";
import type { Booking, Course } from "../generated/prisma";

/**
 * In-person (counter) payments. A booking's green+cart total can be collected
 * in one charge, split per player, or partially ("pay for 2 of 4"), plus a
 * custom amount. The LinxTimes in-person fee (course.linxtimesInPersonFee per
 * player) is added on top and taken via the Stripe application fee — only on
 * CARD (terminal) payments. Cash is recorded but carries no platform fee (there
 * is no card to skim).
 */

export type ChargeMode = "full" | "players" | "custom";

export interface ChargePlan {
  amountCents: number; // green+cart portion collected toward the booking
  feeCents: number; // LinxTimes in-person fee (card only)
  addonsCents: number; // pro-shop items added at the counter
  taxCents: number; // sales tax on (amount + add-ons)
  addonSummary: string | null;
  chargeTotalCents: number; // amount charged = amount + fee + add-ons + tax
  playersCovered: number;
}

/** Work out how much a requested collection covers, capped to what's still owed. */
export function planCharge(
  booking: Pick<Booking, "totalCents" | "numPlayers" | "amountPaidCents">,
  inPersonFeePerPlayer: number,
  opts: { mode: ChargeMode; players?: number; customCents?: number; isCard: boolean }
): ChargePlan {
  const remaining = Math.max(0, booking.totalCents - booking.amountPaidCents);
  const perPlayer = booking.numPlayers > 0 ? Math.round(booking.totalCents / booking.numPlayers) : booking.totalCents;

  let amount: number;
  if (opts.mode === "full") amount = remaining;
  else if (opts.mode === "players") amount = Math.min(remaining, Math.max(1, opts.players ?? 1) * perPlayer);
  else amount = Math.min(remaining, Math.max(0, opts.customCents ?? 0));

  // How many players this charge covers — at least one whenever money changes
  // hands, so a card charge always carries the in-person fee.
  const playersCovered = amount > 0
    ? (perPlayer > 0 ? Math.max(1, Math.min(booking.numPlayers, Math.round(amount / perPlayer))) : 1)
    : 0;

  // The LinxTimes in-person fee is charged PER PLAYER COVERED on card payments —
  // not prorated by dollar amount (which rounded a small custom charge down to
  // ~$0 and skipped the fee entirely). Cash carries no platform fee.
  const feeCents = opts.isCard ? inPersonFeePerPlayer * playersCovered : 0;

  return {
    amountCents: amount, feeCents, addonsCents: 0, taxCents: 0, addonSummary: null,
    chargeTotalCents: amount + feeCents, playersCovered,
  };
}

/**
 * Fold pro-shop add-ons + sales tax into a base plan. Tax applies to the add-ons
 * plus the booking green/cart portion — but NOT if that booking was already
 * taxed online (avoids double-taxing). Returns a new plan with the full charge.
 * Pro-shop transactions add $0.50 to the LinxTimes fee.
 */
export function withAddons(
  base: ChargePlan,
  opts: { addonsCents: number; addonSummary: string | null; taxRateBps: number; bookingAlreadyTaxed: boolean }
): ChargePlan {
  const taxable = opts.addonsCents + (opts.bookingAlreadyTaxed ? 0 : base.amountCents);
  const taxCents = Math.round((taxable * (opts.taxRateBps ?? 0)) / 10000);

  // Add $0.50 pro-shop transaction fee if there are add-ons
  const proshopFeeCents = opts.addonsCents > 0 ? 50 : 0;
  const newFeeCents = base.feeCents + proshopFeeCents;

  return {
    ...base,
    feeCents: newFeeCents,
    addonsCents: opts.addonsCents,
    taxCents,
    addonSummary: opts.addonSummary,
    chargeTotalCents: base.amountCents + newFeeCents + opts.addonsCents + taxCents,
  };
}

/** Recompute a booking's paid total from its succeeded payments + set status. */
export async function refreshBookingPaid(bookingId: string): Promise<void> {
  const [booking, agg, feeAgg] = await Promise.all([
    prisma.booking.findUnique({ where: { id: bookingId }, select: { totalCents: true } }),
    prisma.payment.aggregate({ where: { bookingId, state: "succeeded" }, _sum: { amountCents: true } }),
    prisma.payment.aggregate({ where: { bookingId, state: "succeeded" }, _sum: { feeCents: true } }),
  ]);
  if (!booking) return;
  const paid = agg._sum.amountCents ?? 0;
  const inPersonFees = feeAgg._sum.feeCents ?? 0;
  const paymentStatus = paid >= booking.totalCents ? "paid_in_person" : paid > 0 ? "partially_paid" : "unpaid";
  await prisma.booking.update({ where: { id: bookingId }, data: { amountPaidCents: paid, inPersonFeesCents: inPersonFees, paymentStatus } });
}

/** Record a cash (or other manual) payment — works with no Stripe. */
export async function recordManualPayment(args: {
  booking: Booking;
  plan: ChargePlan;
  method: "cash" | "other";
  adminId: string;
}): Promise<void> {
  await prisma.payment.create({
    data: {
      bookingId: args.booking.id,
      courseId: args.booking.courseId,
      amountCents: args.plan.amountCents,
      feeCents: 0, // no platform fee on cash
      addonsCents: args.plan.addonsCents,
      taxCents: args.plan.taxCents,
      addonSummary: args.plan.addonSummary,
      playersCovered: args.plan.playersCovered,
      method: args.method,
      state: "succeeded",
      createdBy: args.adminId,
    },
  });
  await refreshBookingPaid(args.booking.id);
}

/**
 * Start a card payment on the course's Stripe reader. Creates a card-present
 * PaymentIntent on the connected account (with the LinxTimes fee as the
 * application fee) and pushes it to the reader; the reader prompts the tap.
 * Finalization happens on the payment_intent.succeeded webhook.
 * Requires the course to have Stripe connected + a registered reader.
 */
export async function startTerminalPayment(args: {
  booking: Booking;
  course: Course;
  plan: ChargePlan;
  adminId: string;
  receiptEmail?: string;
}): Promise<{ ok: true; paymentId: string } | { ok: false; message: string }> {
  const { course, booking, plan } = args;
  // Stripe emails a receipt for the card-present charge when receipt_email is
  // set (live mode). Prefer a counter-entered email, else the booking's email.
  const rawEmail = (args.receiptEmail?.trim() || booking.golferEmail || "").trim();
  const receiptEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rawEmail) ? rawEmail : undefined;
  if (!course.stripeAccountId || !course.stripeOnboarded) {
    return { ok: false, message: "Connect the course's Stripe account first (Settings → Payments)." };
  }
  if (!course.stripeTerminalReaderId) {
    return { ok: false, message: "Register a card reader first (Settings → Payments)." };
  }

  // Safety check: verify reader ID looks valid (not empty/test)
  if (!course.stripeTerminalReaderId.trim()) {
    return { ok: false, message: "Card reader ID is invalid or empty. Check Settings → Payments." };
  }

  // Guard against a double-tap: if a terminal charge for this booking is already
  // in flight, don't start a second one (which would strand an orphan PI).
  const inFlight = await prisma.payment.findFirst({
    where: { bookingId: booking.id, method: "terminal", state: "pending" },
    select: { id: true },
  });
  if (inFlight) {
    return { ok: false, message: "A card payment is already in progress for this booking — finish or cancel it on the reader first." };
  }

  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id, courseId: course.id, amountCents: plan.amountCents,
      feeCents: plan.feeCents, addonsCents: plan.addonsCents, taxCents: plan.taxCents,
      addonSummary: plan.addonSummary, playersCovered: plan.playersCovered, method: "terminal", state: "pending",
      createdBy: args.adminId,
    },
  });

  try {
    const stripe = getStripe(); // throws if Stripe keys aren't configured yet
    // Estimate Stripe processing fee for card_present: 2.7% + $0.05 (lower for terminal)
    const estimatedStripeFee = Math.round(plan.chargeTotalCents * 0.027) + 5;
    const transferAmount = Math.max(0, plan.chargeTotalCents - estimatedStripeFee - plan.feeCents);

    const intent = await stripe.paymentIntents.create(
      {
        amount: plan.chargeTotalCents,
        currency: "usd",
        payment_method_types: ["card_present"],
        capture_method: "automatic",
        // application_fee_amount and transfer_data.amount are mutually exclusive
        // in Stripe. Use an explicit transfer amount so the course absorbs the
        // Stripe fee; the LinxTimes in-person fee is what stays on the platform.
        transfer_data: { destination: course.stripeAccountId, amount: transferAmount },
        description: `Counter payment ${booking.confirmationNo}`,
        ...(receiptEmail ? { receipt_email: receiptEmail } : {}),
        metadata: { kind: "in_person", paymentId: payment.id, bookingId: booking.id },
      }
      // Payment created on platform account (no stripeAccount param)
    );
    await prisma.payment.update({ where: { id: payment.id }, data: { stripePaymentIntentId: intent.id } });

    // Push the payment to the physical reader — it prompts the golfer to tap.
    // Reader is now registered to platform account, not course account.
    console.log(`[TERMINAL_PAYMENT] Pushing to reader ${course.stripeTerminalReaderId} for payment ${payment.id}`);
    const readerResponse = await stripe.terminal.readers.processPaymentIntent(
      course.stripeTerminalReaderId,
      { payment_intent: intent.id }
      // No stripeAccount param — reader is on platform account
    );

    console.log(`[TERMINAL_PAYMENT] Reader response:`, readerResponse);

    // Verify the reader accepted the payment intent
    if (!readerResponse || readerResponse.status === "offline") {
      throw new Error(`Reader returned status: ${readerResponse?.status || "unknown"}`);
    }

    console.log(`[TERMINAL_PAYMENT] Payment ${payment.id} successfully pushed to reader`);
    return { ok: true, paymentId: payment.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[TERMINAL_PAYMENT_ERROR] Payment ${payment.id}: ${errorMsg}`);
    console.error(`[TERMINAL_PAYMENT_ERROR] Full error:`, err);
    await prisma.payment.update({ where: { id: payment.id }, data: { state: "failed" } });
    return { ok: false, message: "Card reader offline or unreachable. Check that reader is online and try again." };
  }
}
