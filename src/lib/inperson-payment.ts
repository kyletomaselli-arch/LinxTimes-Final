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

  const feeTotal = inPersonFeePerPlayer * booking.numPlayers;
  const feeCents = opts.isCard && booking.totalCents > 0 ? Math.round((feeTotal * amount) / booking.totalCents) : 0;
  const playersCovered = perPlayer > 0 ? Math.max(1, Math.round(amount / perPlayer)) : booking.numPlayers;

  return {
    amountCents: amount, feeCents, addonsCents: 0, taxCents: 0, addonSummary: null,
    chargeTotalCents: amount + feeCents, playersCovered,
  };
}

/**
 * Fold pro-shop add-ons + sales tax into a base plan. Tax applies to the add-ons
 * plus the booking green/cart portion — but NOT if that booking was already
 * taxed online (avoids double-taxing). Returns a new plan with the full charge.
 */
export function withAddons(
  base: ChargePlan,
  opts: { addonsCents: number; addonSummary: string | null; taxRateBps: number; bookingAlreadyTaxed: boolean }
): ChargePlan {
  const taxable = opts.addonsCents + (opts.bookingAlreadyTaxed ? 0 : base.amountCents);
  const taxCents = Math.round((taxable * (opts.taxRateBps ?? 0)) / 10000);
  return {
    ...base,
    addonsCents: opts.addonsCents,
    taxCents,
    addonSummary: opts.addonSummary,
    chargeTotalCents: base.amountCents + base.feeCents + opts.addonsCents + taxCents,
  };
}

/** Recompute a booking's paid total from its succeeded payments + set status. */
export async function refreshBookingPaid(bookingId: string): Promise<void> {
  const [booking, agg] = await Promise.all([
    prisma.booking.findUnique({ where: { id: bookingId }, select: { totalCents: true } }),
    prisma.payment.aggregate({ where: { bookingId, state: "succeeded" }, _sum: { amountCents: true } }),
  ]);
  if (!booking) return;
  const paid = agg._sum.amountCents ?? 0;
  const paymentStatus = paid >= booking.totalCents ? "paid_in_person" : paid > 0 ? "partially_paid" : "unpaid";
  await prisma.booking.update({ where: { id: bookingId }, data: { amountPaidCents: paid, paymentStatus } });
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
}): Promise<{ ok: true } | { ok: false; message: string }> {
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
    const intent = await stripe.paymentIntents.create(
      {
        amount: plan.chargeTotalCents,
        currency: "usd",
        payment_method_types: ["card_present"],
        capture_method: "automatic",
        application_fee_amount: plan.feeCents,
        description: `Counter payment ${booking.confirmationNo}`,
        ...(receiptEmail ? { receipt_email: receiptEmail } : {}),
        metadata: { kind: "in_person", paymentId: payment.id, bookingId: booking.id },
      },
      { stripeAccount: course.stripeAccountId }
    );
    await prisma.payment.update({ where: { id: payment.id }, data: { stripePaymentIntentId: intent.id } });

    // Push the payment to the physical reader — it prompts the golfer to tap.
    await stripe.terminal.readers.processPaymentIntent(
      course.stripeTerminalReaderId,
      { payment_intent: intent.id },
      { stripeAccount: course.stripeAccountId }
    );
    return { ok: true };
  } catch {
    await prisma.payment.update({ where: { id: payment.id }, data: { state: "failed" } });
    return { ok: false, message: "Could not start the card payment. Check the reader is online." };
  }
}
