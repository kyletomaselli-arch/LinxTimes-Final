import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenant } from "@/lib/tenant";

const SLOT_HOLD_MINUTES = 10;

/**
 * POST /api/courses/[slug]/bookings/[bookingId]/hold
 *
 * When a golfer opens the payment form, hold the slot for 10 minutes.
 * This prevents overbooking if they abandon the form. The cleanup job
 * will release expired holds.
 */
export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/courses/[slug]/bookings/[bookingId]/hold">
) {
  const { slug, bookingId } = await ctx.params;

  const tenant = await resolveTenant(slug);
  if (!tenant.ok) {
    return NextResponse.json({ error: tenant.reason }, { status: tenant.status });
  }

  try {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, courseId: tenant.course.id },
      select: { id: true, paymentStatus: true, status: true },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Only set holds on unpaid bookings that haven't been cancelled
    if (booking.paymentStatus !== "unpaid" || booking.status !== "confirmed") {
      return NextResponse.json({ error: "Booking is no longer available" }, { status: 409 });
    }

    const expiresAt = new Date(Date.now() + SLOT_HOLD_MINUTES * 60_000);

    await prisma.booking.update({
      where: { id: bookingId },
      data: { slotHeldUntil: expiresAt },
    });

    return NextResponse.json({
      ok: true,
      message: `Slot held for ${SLOT_HOLD_MINUTES} minutes. Complete payment to confirm.`,
    });
  } catch (err) {
    console.error("[POST /hold] error:", err);
    return NextResponse.json({ error: "Failed to hold slot" }, { status: 500 });
  }
}
