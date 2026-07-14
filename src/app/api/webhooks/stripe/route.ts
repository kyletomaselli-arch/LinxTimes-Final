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
    },
  });

  if (result.count === 1) {
    await sendBookingEmails(bookingId);
  }
}

async function handlePaymentFailed(pi: Stripe.PaymentIntent) {
  if (pi.metadata?.kind === "in_person" && pi.metadata.paymentId) {
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
  await prisma.booking.updateMany({
    where: { stripePaymentIntentId: piId },
    data: { paymentStatus: "refunded" },
  });
}

async function handleAccountUpdated(account: Stripe.Account) {
  // Reflect the course's Stripe connection/onboarding state in our DB.
  const onboarded = Boolean(account.charges_enabled && account.payouts_enabled);
  await prisma.course.updateMany({
    where: { stripeAccountId: account.id },
    data: { stripeOnboarded: onboarded },
  });
}
