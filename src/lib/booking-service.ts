import "server-only";
import { prisma } from "./prisma";
import { getStripe } from "./stripe";
import { computePricing } from "./pricing";
import { computeAvailability } from "./availability";
import { buildConfirmationNo } from "./confirmation";
import { fromDateKey, isPastSlot } from "./datetime";
import { sendBookingEmails } from "./email";
import { resolveMembers } from "./members";
import { resolvePromo } from "./promo";
import { resolveRainCheck } from "./raincheck";
import type { Course } from "./../generated/prisma";
import type { BookingInput } from "./validation";
import { Prisma } from "./../generated/prisma";

export type BookingResult =
  | {
      ok: true;
      bookingId: string;
      confirmationNo: string;
      paymentStatus: "unpaid" | "paid_online";
      // The client uses these with Stripe Elements to collect payment.
      clientSecret?: string;
      publishableKey?: string;
      stripeAccountId?: string;
      totalCents: number;
      // True when there is nothing to charge (e.g. a comp/free member): the
      // booking is already confirmed and the client can skip payment.
      free?: boolean;
    }
  | { ok: false; status: 400 | 402 | 404 | 409; reason: string };

/**
 * Create a booking. This is the authoritative money path:
 *  - price is recomputed server-side (the client cannot dictate the amount),
 *  - the slot is validated against the live availability rules,
 *  - the DB unique constraint on (layoutId, date, slotTime) is the final guard
 *    against double-booking under concurrency,
 *  - for online payment, a Stripe destination charge splits the LinxTimes fee
 *    out automatically via application_fee_amount.
 */
export async function createBooking(
  course: Course,
  input: BookingInput
): Promise<BookingResult> {
  const layout = await prisma.layout.findFirst({
    where: { id: input.layoutId, courseId: course.id, isActive: true },
    include: { pricing: true },
  });
  if (!layout || !layout.pricing) {
    return { ok: false, status: 404, reason: "Layout not configured" };
  }

  // Validate the slot against the same rules the public grid uses (window,
  // day template, overrides, already-booked).
  const availability = await computeAvailability({
    course,
    layout,
    dateKey: input.date,
  });
  if (!input.agreedToTerms) {
    return { ok: false, status: 400, reason: "Please agree to the Terms and cancellation policy." };
  }
  if (isPastSlot(input.date, input.slotTime, course.timezone)) {
    return { ok: false, status: 409, reason: "Online booking has closed for that tee time." };
  }
  const slot = availability.slots.find((s) => s.time === input.slotTime);
  if (!slot) {
    return { ok: false, status: 400, reason: "Tee time is not available on this date" };
  }
  if (slot.blocked) {
    return { ok: false, status: 409, reason: slot.reason ?? "Tee time is closed" };
  }
  if (!slot.available) {
    return { ok: false, status: 409, reason: "Tee time is full" };
  }
  if (input.numPlayers > slot.spotsLeft) {
    return {
      ok: false,
      status: 409,
      reason: `Only ${slot.spotsLeft} spot${slot.spotsLeft === 1 ? "" : "s"} left at this time`,
    };
  }

  const codes = [...(input.memberIds ?? []), ...(input.memberId ? [input.memberId] : [])];
  const [members, promoRes, creditRes] = await Promise.all([
    resolveMembers(course.id, codes),
    resolvePromo(course.id, codes),
    resolveRainCheck(course.id, codes),
  ]);

  const breakdown = computePricing({
    course,
    pricing: layout.pricing,
    dateKey: input.date,
    slotTime: input.slotTime,
    numPlayers: input.numPlayers,
    holes: input.holes,
    withCart: input.withCart,
    members,
    promo: promoRes?.promo ?? null,
    credit: creditRes ? { code: creditRes.code, amountCents: creditRes.amountCents } : null,
  });

  const bookingFeeCents = breakdown.bookingFeeCents;
  const totalCents = breakdown.totalCents;

  // Every public booking is paid online — the course must have a connected
  // Stripe account before it can accept bookings.
  if (!course.stripeAccountId || !course.stripeOnboarded) {
    return {
      ok: false,
      status: 402,
      reason: "This course is not accepting online payments yet",
    };
  }

  const bookingDate = fromDateKey(input.date);
  const phone = input.golferPhone && input.golferPhone !== "" ? input.golferPhone : null;
  const lockKey = `${layout.id}|${input.date}|${input.slotTime}`;

  // Reserve inside a transaction guarded by a Postgres advisory lock keyed to
  // this exact tee time. The lock serializes concurrent bookings for the same
  // slot so the capacity (maxPlayers) can never be exceeded, then we recount
  // and insert. confirmationNo collisions are retried within the transaction.
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    const agg = await tx.booking.aggregate({
      where: { layoutId: layout.id, bookingDate, slotTime: input.slotTime, status: { not: "cancelled" } },
      _sum: { numPlayers: true },
    });
    const remaining = slot.maxPlayers - (agg._sum.numPlayers ?? 0);
    if (input.numPlayers > remaining) {
      return { conflict: remaining } as const;
    }

    const existingCount = await tx.booking.count({ where: { courseId: course.id, bookingDate } });
    for (let attempt = 0; attempt < 5; attempt++) {
      const confirmationNo = buildConfirmationNo(course.slug, input.date, existingCount + 1 + attempt);
      try {
        const booking = await tx.booking.create({
          data: {
            confirmationNo, courseId: course.id, layoutId: layout.id, memberId: members[0]?.id ?? null,
            bookingDate, slotTime: input.slotTime, numPlayers: input.numPlayers,
            withCart: input.withCart, holes: input.holes,
            golferName: input.golferName, golferEmail: input.golferEmail, golferPhone: phone,
            rateType: breakdown.rateType, greenFeeCents: breakdown.greenFeeCents,
            cartFeeCents: breakdown.cartFeeCents, bookingFeeCents,
            taxCents: breakdown.taxCents, memberCount: breakdown.memberCount,
            discountCents: breakdown.discountCents, promoCode: breakdown.promoCode,
            creditCents: breakdown.creditCents, rainCheckCode: breakdown.creditCode, totalCents,
            notes: input.notes?.trim() || null,
            termsAcceptedAt: new Date(),
            paymentStatus: "unpaid", status: "confirmed", source: "online",
          },
          select: { id: true, confirmationNo: true },
        });
        return { created: booking } as const;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }
    }
    return { created: null } as const;
  });

  if ("conflict" in outcome) {
    return { ok: false, status: 409, reason: `Only ${outcome.conflict} spot${outcome.conflict === 1 ? "" : "s"} left — please pick another time` };
  }
  const created = outcome.created;
  if (!created) {
    return { ok: false, status: 409, reason: "Could not reserve tee time, please retry" };
  }

  // Count the promo redemption once the booking is reserved.
  if (promoRes && breakdown.discountCents > 0) {
    await prisma.promoCode.update({ where: { id: promoRes.id }, data: { timesRedeemed: { increment: 1 } } });
  }
  // Rain checks are NOT consumed here — they're consumed only when payment succeeds
  // (payment_intent.succeeded webhook). If payment times out or fails, the rain check
  // stays available and can be used for another booking. The slotHeldUntil field tracks
  // when the slot hold expires (10 min from when user opens payment form).
  if (creditRes && breakdown.creditCents > 0) {
    // Store which rain check was used, so we can consume it on payment success
    await prisma.booking.update({
      where: { id: created.id },
      data: { rainCheckCode: creditRes.code },
    });
  }

  // Nothing to charge (e.g. a comp/free member whose total is $0). Stripe won't
  // create a sub-$0.50 PaymentIntent, so confirm the booking directly and send
  // the confirmation emails here (there is no webhook to do it).
  if (totalCents <= 0) {
    await prisma.booking.update({
      where: { id: created.id },
      data: { paymentStatus: "paid_online", amountPaidCents: 0 },
    });
    await sendBookingEmails(created.id);
    return {
      ok: true,
      bookingId: created.id,
      confirmationNo: created.confirmationNo,
      paymentStatus: "paid_online",
      totalCents: 0,
      free: true,
    };
  }

  // Online: platform charge model. LinxTimes charges the customer on its own
  // account, deducts the application fee, and transfers the remainder to the
  // course's connected account. The course absorbs Stripe's processing fees
  // (2.9% + $0.30 est), so the transfer is reduced by that amount.
  const stripe = getStripe();
  try {
    // Estimate Stripe processing fee: 2.9% + $0.30 (typical card rate)
    const estimatedStripeFee = Math.round(totalCents * 0.029) + 30;
    const transferAmount = Math.max(0, totalCents - estimatedStripeFee - bookingFeeCents);

    const intent = await stripe.paymentIntents.create(
      {
        amount: totalCents,
        currency: "usd",
        application_fee_amount: bookingFeeCents,
        transfer_data: { destination: course.stripeAccountId!, amount: transferAmount },
        automatic_payment_methods: { enabled: true },
        description: `Tee time ${created.confirmationNo}`,
        metadata: {
          bookingId: created.id,
          confirmationNo: created.confirmationNo,
          courseId: course.id,
        },
      },
      { idempotencyKey: `${created.confirmationNo}-payment` }
    );

    await prisma.booking.update({
      where: { id: created.id },
      data: { stripePaymentIntentId: intent.id },
    });

    return {
      ok: true,
      bookingId: created.id,
      confirmationNo: created.confirmationNo,
      paymentStatus: "unpaid",
      clientSecret: intent.client_secret ?? undefined,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
      stripeAccountId: course.stripeAccountId!,
      totalCents,
    };
  } catch {
    // Payment setup failed → release the slot so it isn't held by a dead booking.
    await prisma.booking.update({
      where: { id: created.id },
      data: { status: "cancelled", cancellationReason: "Payment setup failed", cancelledAt: new Date(), cancelledBy: "system" },
    });
    return { ok: false, status: 402, reason: "Could not start payment, please try again" };
  }
}
