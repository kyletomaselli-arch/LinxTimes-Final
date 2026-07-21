import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { serverEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { sendBookingEmails } from "@/lib/email";

/**
 * POST /api/webhooks/stripe
 *
 * Stripe event receiver. SECURITY: every request is verified against the
 * Stripe-Signature header using STRIPE_WEBHOOK_SECRET before any processing.
 * Unverified requests are rejected with 400 — we never act on unsigned input.
 *
 * We read the RAW body (request.text()) because signature verification is done
 * over the exact bytes Stripe sent; parsing to JSON first would break it.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      serverEnv.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    // Bad signature or malformed payload — reject without processing.
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      default:
        // Ignore unsubscribed event types.
        break;
    }
  } catch (err) {
    // Returning 500 tells Stripe to retry; log server-side for diagnosis.
    console.error("Webhook handler error", event.type, err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  // Acknowledge quickly so Stripe doesn't time out / retry needlessly.
  return NextResponse.json({ received: true });
}

async function handlePaymentSucceeded(pi: Stripe.PaymentIntent) {
  // In-person (Stripe Terminal) payment succeeded → finalize that Payment row.
  if (pi.metadata?.kind === "in_person" && pi.metadata.paymentId) {
    const { refreshBookingPaid } = await import("@/lib/inperson-payment");
    await prisma.payment.updateMany({ where: { id: pi.metadata.paymentId, state: { not: "succeeded" } }, data: { state: "succeeded" } });
    if (pi.metadata.bookingId) await refreshBookingPaid(pi.metadata.bookingId);
    return;
  }

  // Membership payment succeeded → create member and finalize payment
  if (pi.metadata?.kind === "membership" && pi.metadata.paymentId) {
    const payment = await prisma.payment.findUnique({ where: { id: pi.metadata.paymentId } });
    if (!payment || !payment.metadata) return;

    const meta = payment.metadata as Record<string, string>;
    const { firstName, lastName, email, phone, tierId, memberId, courseId } = meta;

    // Upsert makes this idempotent under Stripe's webhook retries. A real
    // failure THROWS (→ 500 → Stripe retries) instead of being swallowed —
    // money must never be captured with no member created and no alert.
    await prisma.member.upsert({
      where: { courseId_memberId: { courseId, memberId } },
      update: { membershipTierId: tierId, membershipPaidAt: new Date(), isActive: true },
      create: {
        courseId,
        memberId,
        firstName,
        lastName,
        email: email || null,
        phone: phone || null,
        membershipTierId: tierId,
        membershipPaidAt: new Date(),
        isActive: true,
      },
    });

    // Mark payment as succeeded only once the member is in place.
    await prisma.payment.update({ where: { id: pi.metadata.paymentId }, data: { state: "succeeded" } });
    return;
  }

  // Renewal payment succeeded → update member and finalize payment
  if (pi.metadata?.kind === "renewal" && pi.metadata.paymentId) {
    const payment = await prisma.payment.findUnique({ where: { id: pi.metadata.paymentId } });
    if (!payment || !payment.metadata) return;

    const meta = payment.metadata as Record<string, string>;
    const { memberId, tierId } = meta;

    // Update the member's membership tier and paid date
    await prisma.member.update({
      where: { id: memberId },
      data: { membershipTierId: tierId, membershipPaidAt: new Date(), isActive: true },
    });

    // Mark payment as succeeded only once the member is updated.
    await prisma.payment.update({ where: { id: pi.metadata.paymentId }, data: { state: "succeeded" } });
    return;
  }

  // Quick charge payment succeeded → just mark as succeeded
  if (pi.metadata?.kind === "quick_charge" && pi.metadata.paymentId) {
    await prisma.payment.updateMany({ where: { id: pi.metadata.paymentId, state: { not: "succeeded" } }, data: { state: "succeeded" } });
    return;
  }

  const bookingId = pi.metadata?.bookingId;
  if (!bookingId) return;
  const chargeId =
    typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id ?? null;

  // Only the first unpaid -> paid transition updates a row. This makes the
  // handler idempotent against Stripe's webhook retries, so the confirmation
  // email is sent exactly once.
  const result = await prisma.booking.updateMany({
    where: { id: bookingId, paymentStatus: "unpaid" },
    data: {
      paymentStatus: "paid_online",
      stripeChargeId: chargeId,
      status: "confirmed",
      slotHeldUntil: null, // Payment succeeded, release the hold
    },
  });

  if (result.count === 1) {
    // Consume the rain check now that payment succeeded. This is idempotent:
    // if the webhook retries, the rain check is already marked redeemed.
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { courseId: true, rainCheckCode: true },
    });
    if (booking?.rainCheckCode) {
      await prisma.rainCheck.updateMany({
        where: {
          code: booking.rainCheckCode,
          courseId: booking.courseId,
          redeemedAt: null, // Only consume once
        },
        data: {
          redeemedAt: new Date(),
          redeemedBookingId: bookingId,
          isActive: false,
        },
      });
    }
    await sendBookingEmails(bookingId);
  }
}

async function handlePaymentFailed(pi: Stripe.PaymentIntent) {
  if (pi.metadata?.kind === "in_person" && pi.metadata.paymentId) {
    await prisma.payment.updateMany({ where: { id: pi.metadata.paymentId }, data: { state: "failed" } });
    return;
  }
  // Membership payment failed — just mark the payment as failed
  if (pi.metadata?.kind === "membership" && pi.metadata.paymentId) {
    await prisma.payment.updateMany({ where: { id: pi.metadata.paymentId }, data: { state: "failed" } });
    return;
  }
  // Quick charge payment failed — just mark as failed
  if (pi.metadata?.kind === "quick_charge" && pi.metadata.paymentId) {
    await prisma.payment.updateMany({ where: { id: pi.metadata.paymentId }, data: { state: "failed" } });
    return;
  }
  const bookingId = pi.metadata?.bookingId;
  if (!bookingId) return;
  // Release the slot: a failed payment must not hold a tee time.
  const result = await prisma.booking.updateMany({
    where: { id: bookingId, paymentStatus: "unpaid" },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledBy: "system",
      cancellationReason: "Payment failed",
    },
  });
  // Put any promo / rain-check codes back if we actually cancelled the booking.
  if (result.count > 0) {
    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, courseId: true, promoCode: true, rainCheckCode: true },
    });
    if (b) {
      const { releaseBookingCodes } = await import("@/lib/booking-codes");
      await releaseBookingCodes(b);
    }
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const piId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;
  if (!piId) return;

  // Only a FULL refund flips state here. Partial refunds — including our own
  // cancellation flow, which refunds total − LinxTimes fee — are recorded by
  // the flow that issued them (cancelBooking sets paymentStatus itself).
  if (!charge.refunded) return;

  // Online bookings carry the PI on the booking row.
  await prisma.booking.updateMany({
    where: { stripePaymentIntentId: piId },
    data: { paymentStatus: "refunded" },
  });

  // In-person (terminal) charges carry the PI on the Payment row — reflect a
  // dashboard-issued refund there too, and recompute the booking's paid state.
  const payments = await prisma.payment.findMany({
    where: { stripePaymentIntentId: piId },
    select: { id: true, bookingId: true },
  });
  if (payments.length > 0) {
    await prisma.payment.updateMany({
      where: { stripePaymentIntentId: piId },
      data: { state: "refunded" },
    });
    const { refreshBookingPaid } = await import("@/lib/inperson-payment");
    for (const p of payments) {
      if (p.bookingId) await refreshBookingPaid(p.bookingId);
    }
  }
}

async function handleAccountUpdated(account: Stripe.Account) {
  // Reflect the course's Stripe connection/onboarding state in our DB.
  const onboarded = Boolean(account.charges_enabled && account.payouts_enabled);
  await prisma.course.updateMany({
    where: { stripeAccountId: account.id },
    data: { stripeOnboarded: onboarded },
  });
}
