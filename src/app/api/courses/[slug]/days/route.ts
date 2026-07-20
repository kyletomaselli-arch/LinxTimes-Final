import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenant } from "@/lib/tenant";
import { rateLimit } from "@/lib/rate-limit";
import { idSchema } from "@/lib/validation";
import { sweepAbandonedBookings, releaseExpiredSlotHolds } from "@/lib/booking-sweep";
import { cleanupExpiredWaitlistEntries } from "@/lib/waitlist";
import {
  todayKeyInTz,
  addDays,
  fromDateKey,
  toDateKey,
  dayOfWeek,
  timeToMinutes,
} from "@/lib/datetime";

/**
 * GET /api/courses/[slug]/days?layoutId=
 *
 * Lightweight per-day availability summary for the booking page's day strip:
 * for each day in the course's booking window (capped at 60), whether the day
 * is closed (no template / full-day override) or fully booked. Computed with
 * one grouped query — NOT by running the full availability engine per day.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/courses/[slug]/days">
) {
  const limited = rateLimit(request, "days", 60, 60_000);
  if (limited) return limited;

  const { slug } = await ctx.params;
  const tenant = await resolveTenant(slug);
  if (!tenant.ok) {
    return NextResponse.json({ error: tenant.reason }, { status: tenant.status });
  }
  const course = tenant.course;

  const parsed = idSchema.safeParse(request.nextUrl.searchParams.get("layoutId") ?? "");
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid layoutId" }, { status: 400 });
  }

  const layout = await prisma.layout.findFirst({
    where: { id: parsed.data, courseId: course.id, isActive: true },
    include: { teeTimeSlots: true },
  });
  if (!layout) {
    return NextResponse.json({ error: "Layout not found" }, { status: 404 });
  }

  // Lazy cleanup of stale data: abandoned bookings, expired slot holds, past waitlist entries
  await Promise.all([
    sweepAbandonedBookings(course.id),
    releaseExpiredSlotHolds(course.id),
    cleanupExpiredWaitlistEntries(course.id, course.timezone),
  ]);

  const today = todayKeyInTz(course.timezone);
  const daysAhead = Math.min(course.maxDaysAhead, 60);
  const lastKey = addDays(today, daysAhead);

  const [booked, overrides] = await Promise.all([
    prisma.booking.groupBy({
      by: ["bookingDate"],
      where: {
        layoutId: layout.id,
        status: { not: "cancelled" },
        bookingDate: { gte: fromDateKey(today), lte: fromDateKey(lastKey) },
      },
      _sum: { numPlayers: true },
    }),
    prisma.dailyOverride.findMany({
      where: {
        courseId: course.id,
        slotTime: null,
        isClosed: true,
        overrideDate: { gte: fromDateKey(today), lte: fromDateKey(lastKey) },
      },
      select: { overrideDate: true },
    }),
  ]);

  const bookedMap = new Map(booked.map((b) => [toDateKey(b.bookingDate), b._sum.numPlayers ?? 0]));
  const closedDays = new Set(overrides.map((o) => toDateKey(o.overrideDate)));

  // Capacity per day-of-week from the weekly slot template.
  const capacityByDow = new Map<number, number>();
  for (const t of layout.teeTimeSlots) {
    if (!t.isActive) continue;
    const slotCount = Math.floor((timeToMinutes(t.endTime) - timeToMinutes(t.startTime)) / t.intervalMin) + 1;
    capacityByDow.set(t.dayOfWeek, Math.max(0, slotCount) * t.maxPlayers);
  }

  const days: { date: string; closed: boolean; full: boolean }[] = [];
  for (let i = 0; i <= daysAhead; i++) {
    const key = addDays(today, i);
    const capacity = capacityByDow.get(dayOfWeek(key)) ?? 0;
    const closed = closedDays.has(key) || capacity === 0;
    const full = !closed && (bookedMap.get(key) ?? 0) >= capacity;
    days.push({ date: key, closed, full });
  }

  return NextResponse.json({ days });
}
