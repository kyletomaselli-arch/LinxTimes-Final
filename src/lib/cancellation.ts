import "server-only";
import { prisma } from "./prisma";
import { getStripe } from "./stripe";
import { teeTimeEpochMs, toDateKey } from "./datetime";
import { sendCancellationEmail } from "./email";
import { notifyWaitlistForSlot } from "./waitlist";
import { releaseBookingCodes } from "./booking-codes";

/**
 * Cancellation with the 24-hour rule enforced at the service level (not just
 * the UI), plus the partial Stripe refund.
 *
 * Refund policy (per spec):
 *  - The green fee + cart fee are refunded to the golfer.
 *  - The LinxTimes convenience fee (bookingFeeCents) is NEVER refunded — we
 *    refund totalCents − bookingFeeCents and keep the fee, with
 *    refund_application_fee:false + reverse_transfer:true so the money comes
 *    back out of the course's connected account, not LinxTimes'.
 *  - Walk-in / phone (or any not-paid-online) bookings issue no Stripe refund;
 *    the booking is simply marked cancelled.
 */

export const CANCELLATION_WINDOW_HOURS = 24;

export type CancelResult =
  | { ok: true; refundedCents: number; refunded: boolean }
  | { ok: false; code: "not_found" | "already_cancelled" | "within_window" | "needs_reason"; message: string };

interface CancelArgs {
  bookingId: string;
  cancelledBy: string; // course-admin id (or "system")
  reason?: string;
  /** Bypass the 24-hour rule (logged). A reason is required when overriding. */
  override?: boolean;
}

/** The refundable portion — everything except the non-refundable LinxTimes fee. */
export function refundableCents(totalCents: number, bookingFeeCents: number): number {
  return Math.max(0, totalCents - bookingFeeCents);
}

/** Hours between now and the tee time, in the course's timezone. */
export function hoursUntilTeeTime(
  dateKey: string,
  slotTime: string,
  timezone: string,
  now: number = Date.now()
): number {
  return (teeTimeEpochMs(dateKey, slotTime, timezone) - now) / 3_600_000;
}

export async function cancelBooking(args: CancelArgs): Promise<CancelResult> {
  const { bookingId, cancelledBy, reason, override = false } = args;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { course: true },
  });
  if (!booking) {
    return { ok: false, code: "not_found", message: "Booking not found" };
  }
  if (booking.status === "cancelled") {
    return { ok: false, code: "already_cancelled", message: "Booking is already cancelled" };
  }

  // 24-hour rule — enforced here, at the API/service layer.
  const hrs = hoursUntilTeeTime(
    toDateKey(booking.bookingDate),
    booking.slotTime,
    booking.course.timezone
  );
  if (hrs < CANCELLATION_WINDOW_HOURS && !override) {
    return {
      ok: false,
      code: "within_window",
      message: `Cancellations must be made at least ${CANCELLATION_WINDOW_HOURS} hours before the tee time.`,
    };
  }
  // An override (inside the window) must be justified and logged.
  if (hrs < CANCELLATION_WINDOW_HOURS && override && !reason?.trim()) {
    return {
      ok: false,
      code: "needs_reason",
      message: "A reason is required to override the 24-hour cancellation window.",
    };
  }

  // Partial refund only for online-paid bookings.
  let refunded = false;
  let refundedCents = 0;
  if (booking.paymentStatus === "paid_online" && booking.stripePaymentIntentId) {
    refundedCents = refundableCents(booking.totalCents, booking.bookingFeeCents);
    if (refundedCents > 0) {
      const stripe = getStripe();
      await stripe.refunds.create(
        {
          payment_intent: booking.stripePaymentIntentId,
          amount: refundedCents,
          // Keep the LinxTimes application fee; pull the refund from the course.
          refund_application_fee: false,
          reverse_transfer: true,
          metadata: { confirmationNo: booking.confirmationNo, reason: reason ?? "" },
        },
        { idempotencyKey: `${booking.confirmationNo}-refund` }
      );
      refunded = true;
    }
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: "cancelled",
      paymentStatus: refunded ? "refunded" : booking.paymentStatus,
      cancelledAt: new Date(),
      cancelledBy,
      cancellationReason: reason?.trim() || null,
      cancellationOverride: hrs < CANCELLATION_WINDOW_HOURS && override,
    },
  });

  // Notify the golfer (notes the convenience fee is non-refundable).
  await sendCancellationEmail(booking.id, refundedCents);

  // A spot just freed up — email anyone waiting for this tee time.
  await notifyWaitlistForSlot(booking.courseId, booking.layoutId, booking.bookingDate, booking.slotTime);

  // Put any promo / rain-check codes this booking used back into circulation.
  await releaseBookingCodes({
    id: booking.id, courseId: booking.courseId,
    promoCode: booking.promoCode, rainCheckCode: booking.rainCheckCode,
  });

  return { ok: true, refunded, refundedCents };
}
