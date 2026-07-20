import "server-only";
import { prisma } from "./prisma";
import { releaseBookingCodes } from "./booking-codes";

/** How long an online booking may sit unpaid before its slot is released. */
export const UNPAID_BOOKING_TTL_MS = 30 * 60 * 1000;

/**
 * Cancel stale unpaid ONLINE bookings so an abandoned checkout (golfer closed
 * the tab — no Stripe webhook ever fires) releases its tee time and gives back
 * any promo / rain-check codes it consumed. Called lazily from the
 * availability path, so it costs one indexed query when nothing is stale.
 *
 * Each booking is cancelled with a guarded updateMany re-checking
 * paymentStatus, so a payment webhook landing between the read and the write
 * can never cancel a booking that just got paid. If a golfer pays *after* the
 * sweep (rare — >30 min on the payment form), the payment_intent.succeeded
 * handler re-confirms the booking, which we prefer over taking money for a
 * dead reservation.
 */
export async function sweepAbandonedBookings(courseId: string): Promise<void> {
  const cutoff = new Date(Date.now() - UNPAID_BOOKING_TTL_MS);
  const stale = await prisma.booking.findMany({
    where: {
      courseId,
      source: "online",
      paymentStatus: "unpaid",
      status: "confirmed",
      createdAt: { lt: cutoff },
    },
    select: { id: true, courseId: true, promoCode: true, rainCheckCode: true },
  });
  if (stale.length === 0) return;

  for (const b of stale) {
    const res = await prisma.booking.updateMany({
      where: { id: b.id, paymentStatus: "unpaid", status: "confirmed" },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: "system",
        cancellationReason: "Payment not completed",
      },
    });
    if (res.count > 0) await releaseBookingCodes(b);
  }
}

/**
 * Release slot holds that have expired (10 min). When a golfer opens the payment
 * form, the slot is held for 10 minutes. If they don't complete payment in that
 * time, the hold is released and the rain check is restored so they can use it
 * for another booking.
 *
 * Called lazily from the availability path. Guarded so a payment_intent.succeeded
 * webhook landing at the same time won't accidentally release a paid booking.
 */
export async function releaseExpiredSlotHolds(courseId: string): Promise<void> {
  const now = new Date();
  const expired = await prisma.booking.findMany({
    where: {
      courseId,
      slotHeldUntil: { lt: now },
      paymentStatus: "unpaid",
      status: "confirmed",
    },
    select: { id: true, rainCheckCode: true },
  });
  if (expired.length === 0) return;

  for (const b of expired) {
    // Release the hold (can never be re-held once it expires)
    const released = await prisma.booking.updateMany({
      where: {
        id: b.id,
        slotHeldUntil: { not: null },
        paymentStatus: "unpaid",
      },
      data: { slotHeldUntil: null },
    });

    // If the hold was released and a rain check was used, restore it
    if (released.count > 0 && b.rainCheckCode) {
      await prisma.rainCheck.updateMany({
        where: { code: b.rainCheckCode, courseId },
        data: { redeemedAt: null, redeemedBookingId: null, isActive: true },
      });
    }
  }
}

