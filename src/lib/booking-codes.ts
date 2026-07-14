import "server-only";
import { prisma } from "./prisma";

/**
 * When a booking that used a promo or rain check is cancelled or its payment
 * fails, put those codes back: restore the rain check to unredeemed and give the
 * promo redemption back. Never throws — a code cleanup must not fail the cancel.
 */
export async function releaseBookingCodes(booking: {
  id: string;
  courseId: string;
  promoCode: string | null;
  rainCheckCode: string | null;
}): Promise<void> {
  try {
    if (booking.rainCheckCode) {
      await prisma.rainCheck.updateMany({
        where: { redeemedBookingId: booking.id },
        data: { redeemedAt: null, isActive: true, redeemedBookingId: null },
      });
    }
    if (booking.promoCode) {
      await prisma.promoCode.updateMany({
        where: { courseId: booking.courseId, code: booking.promoCode, timesRedeemed: { gt: 0 } },
        data: { timesRedeemed: { decrement: 1 } },
      });
    }
  } catch (err) {
    console.error("[booking-codes] release failed", err);
  }
}
