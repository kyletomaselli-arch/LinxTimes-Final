import { prisma } from "./prisma";
import {
  dayOfWeek,
  timeToMinutes,
  minutesToTime,
  todayKeyInTz,
  addDays,
  compareDateKeys,
  hourOf,
  nowMinutesInTz,
  BOOKING_LEAD_MINUTES,
} from "./datetime";
import { sweepAbandonedBookings } from "./booking-sweep";
import { resolveBand, dayGroupOf } from "./pricing";
import type { Course, Layout, Pricing, PriceBand } from "../generated/prisma";

const dayGroupFeeField = {
  monThu: "monThuFeeCents",
  fri: "friFeeCents",
  sat: "satFeeCents",
  sun: "sunFeeCents",
} as const;

export interface AvailableSlot {
  time: string; // "HH:mm"
  available: boolean; // at least one spot open (and not blocked)
  blocked: boolean; // closed via override
  reason?: string; // override reason if blocked
  maxPlayers: number; // capacity of this tee time
  playersBooked: number; // total players across all groups at this time
  spotsLeft: number; // maxPlayers - playersBooked
  rateType: "weekday" | "weekend" | "twilight" | "member";
  /** Indicative per-player green fee for a default booking (no member). */
  fromPriceCents: number;
}

export interface AvailabilityResult {
  dateKey: string;
  layoutId: string;
  bookable: boolean; // false if date out of range / fully closed
  closedReason?: string;
  slots: AvailableSlot[];
}

interface ComputeArgs {
  course: Course;
  layout: Layout & { pricing: (Pricing & { bands: PriceBand[] }) | null };
  dateKey: string;
}

/**
 * Compute the bookable tee time grid for a layout on a given date.
 * Respects: day-of-week slot template, booking interval, max-days-ahead window,
 * existing (non-cancelled) bookings, and daily overrides (full or per-slot).
 */
export async function computeAvailability({
  course,
  layout,
  dateKey,
}: ComputeArgs): Promise<AvailabilityResult> {
  // Lazily release tee times held by abandoned online checkouts before
  // counting capacity, so a dead unpaid booking can't block the grid.
  await sweepAbandonedBookings(course.id);

  const empty: AvailabilityResult = {
    dateKey,
    layoutId: layout.id,
    bookable: false,
    slots: [],
  };

  // Enforce the booking window: not in the past, not beyond maxDaysAhead.
  const today = todayKeyInTz(course.timezone);
  const lastBookable = addDays(today, course.maxDaysAhead);
  if (compareDateKeys(dateKey, today) < 0) {
    return { ...empty, closedReason: "Date is in the past" };
  }
  if (compareDateKeys(dateKey, lastBookable) > 0) {
    return { ...empty, closedReason: "Date is beyond the booking window" };
  }

  const dow = dayOfWeek(dateKey);
  const template = await prisma.teeTimeSlot.findUnique({
    where: { layoutId_dayOfWeek: { layoutId: layout.id, dayOfWeek: dow } },
  });
  if (!template || !template.isActive) {
    return { ...empty, closedReason: "No tee times scheduled for this day" };
  }

  // Daily overrides for this course/date.
  const overrides = await prisma.dailyOverride.findMany({
    where: { courseId: course.id, overrideDate: new Date(`${dateKey}T00:00:00.000Z`) },
  });
  const fullDayClose = overrides.find((o) => !o.slotTime && o.isClosed);
  if (fullDayClose) {
    return { ...empty, closedReason: fullDayClose.reason ?? "Closed" };
  }
  const slotOverrides = new Map(
    overrides.filter((o) => o.slotTime).map((o) => [o.slotTime as string, o])
  );
  const dateOverrideFeeCents = overrides.find((o) => !o.slotTime && o.feeCents != null)?.feeCents ?? null;

  // Existing active bookings for this layout/date.
  const bookings = await prisma.booking.findMany({
    where: {
      layoutId: layout.id,
      bookingDate: new Date(`${dateKey}T00:00:00.000Z`),
      status: { not: "cancelled" },
    },
    select: { slotTime: true, numPlayers: true },
  });
  // Sum players across ALL groups sharing each tee time (capacity model).
  const bookedMap = new Map<string, number>();
  for (const b of bookings) {
    bookedMap.set(b.slotTime, (bookedMap.get(b.slotTime) ?? 0) + b.numPlayers);
  }

  const pricing = layout.pricing;
  const dayGroup = dayGroupOf(dateKey);

  // On the current day, tee times that have passed (or are within the lead-time
  // cutoff before start) are not bookable.
  const isToday = compareDateKeys(dateKey, today) === 0;
  const cutoffMins = isToday ? nowMinutesInTz(course.timezone) + BOOKING_LEAD_MINUTES : -1;

  const slots: AvailableSlot[] = [];
  const start = timeToMinutes(template.startTime);
  const end = timeToMinutes(template.endTime);
  const interval = Number(template.intervalMin);

  for (let mins = start; mins <= end; mins += interval) {
    const time = minutesToTime(mins);
    const override = slotOverrides.get(time);
    const passed = isToday && mins <= cutoffMins;
    const blocked = (override?.isClosed ?? false) || passed;
    const maxPlayers = override?.maxPlayers ?? template.maxPlayers;
    const playersBooked = bookedMap.get(time) ?? 0;
    const spotsLeft = Math.max(0, maxPlayers - playersBooked);

    // Determine rate type and price from the matching price band (or a
    // whole-day override, e.g. a holiday rate).
    let rateType: AvailableSlot["rateType"] = "weekday";
    let fromPriceCents = 0;
    if (dateOverrideFeeCents != null) {
      rateType = dayGroup === "monThu" ? "weekday" : "weekend";
      fromPriceCents = dateOverrideFeeCents;
    } else if (pricing) {
      const resolved = resolveBand(pricing.bands, hourOf(time));
      if (resolved) {
        rateType = resolved.isLastBand ? "twilight" : dayGroup === "monThu" ? "weekday" : "weekend";
        fromPriceCents = resolved.band[dayGroupFeeField[dayGroup]];
      }
    }

    slots.push({
      time,
      available: !blocked && spotsLeft > 0,
      blocked,
      reason: override?.reason ?? (passed ? "Passed" : undefined),
      maxPlayers,
      playersBooked,
      spotsLeft,
      rateType,
      fromPriceCents,
    });
  }

  return {
    dateKey,
    layoutId: layout.id,
    bookable: slots.some((s) => s.available),
    slots,
  };
}
