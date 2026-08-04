import { prisma } from "./prisma";
import {
  dayOfWeek,
  timeToMinutes,
  minutesToTime,
  todayKeyInTz,
  addDays,
  compareDateKeys,
  hourOf,
  isWeekend,
  nowMinutesInTz,
  BOOKING_LEAD_MINUTES,
} from "./datetime";
import { sweepAbandonedBookings } from "./booking-sweep";
import type { Course, Layout, Pricing, PricingTier } from "../generated/prisma";

/** Get the pricing tier for a given time, or undefined if no tier matches. */
function getPricingTier(
  tiers: PricingTier[],
  time: string,
  isWeekend: boolean
): PricingTier | undefined {
  const hour = parseInt(time.split(":")[0]);
  for (const tier of tiers) {
    // Check if tier applies to this day type
    if (tier.applyTo !== "both") {
      const tierIsWeekend = tier.applyTo === "weekend";
      if (tierIsWeekend !== isWeekend) continue;
    }
    // Check if time falls within tier range
    if (hour >= tier.startHour && hour < tier.endHour) {
      return tier;
    }
  }
  return undefined;
}

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
  layout: Layout & { pricing: (Pricing & { tiers: PricingTier[] }) | null };
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
  const weekend = isWeekend(dateKey);

  // On the current day, tee times that have passed (or are within the lead-time
  // cutoff before start) are not bookable.
  const isToday = compareDateKeys(dateKey, today) === 0;
  const cutoffMins = isToday ? nowMinutesInTz(course.timezone) + BOOKING_LEAD_MINUTES : -1;

  const slots: AvailableSlot[] = [];
  const start = timeToMinutes(template.startTime);
  const end = timeToMinutes(template.endTime);
  const interval = Number(template.intervalMin);

  if (template.dayOfWeek === 2) {
    console.log(`[AVAIL] TUE start: ${start}, end: ${end}, interval: ${interval} (typeof: ${typeof interval})`);
  }

  const tuesdayTimes: string[] = [];
  for (let mins = start; mins <= end; mins += interval) {
    const time = minutesToTime(mins);
    if (template.dayOfWeek === 2) {
      tuesdayTimes.push(time);
    }
    const override = slotOverrides.get(time);
    const passed = isToday && mins <= cutoffMins;
    const blocked = (override?.isClosed ?? false) || passed;
    const maxPlayers = override?.maxPlayers ?? template.maxPlayers;
    const playersBooked = bookedMap.get(time) ?? 0;
    const spotsLeft = Math.max(0, maxPlayers - playersBooked);

    // Determine rate type and price: check tiers first, then fall back to legacy pricing
    let rateType: AvailableSlot["rateType"] = "weekday";
    let fromPriceCents = 0;

    if (pricing) {
      // If tiers exist, use them; otherwise fall back to legacy pricing
      if (pricing.tiers && pricing.tiers.length > 0) {
        const tier = getPricingTier(pricing.tiers, time, weekend);
        if (tier) {
          fromPriceCents = tier.feeCents;
          rateType = "weekday"; // tier-based pricing is generic
        } else {
          // No matching tier; use default weekday rate
          fromPriceCents = weekend ? pricing.weekendFee : pricing.weekdayFee;
          rateType = weekend ? "weekend" : "weekday";
        }
      } else {
        // Legacy pricing logic (no tiers defined)
        rateType = pricing.twilightEnabled && hourOf(time) >= pricing.twilightHour
          ? "twilight"
          : weekend
            ? "weekend"
            : "weekday";

        fromPriceCents = rateType === "twilight"
          ? pricing.twilightFee
          : rateType === "weekend"
            ? pricing.weekendFee
            : pricing.weekdayFee;
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

  if (template.dayOfWeek === 2) {
    console.log(`[AVAIL] TUE generated ${tuesdayTimes.length} times: ${tuesdayTimes.join(", ")}`);
  }

  return {
    dateKey,
    layoutId: layout.id,
    bookable: slots.some((s) => s.available),
    slots,
  };
}
