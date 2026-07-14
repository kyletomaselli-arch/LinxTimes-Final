"use server";

import { revalidatePath } from "next/cache";
import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cancelBooking } from "@/lib/cancellation";
import { computePricing } from "@/lib/pricing";
import { computeAvailability } from "@/lib/availability";
import { buildConfirmationNo } from "@/lib/confirmation";
import { fromDateKey, toDateKey } from "@/lib/datetime";
import { planCharge, withAddons, recordManualPayment, startTerminalPayment, type ChargeMode } from "@/lib/inperson-payment";
import { Prisma } from "@/generated/prisma";

export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * Collect an in-person payment for a booking. Any pro-shop worker can do this
 * (no role gate). Supports: whole remaining, split per player, pay for N
 * players, or a custom amount — via the card reader (Stripe Terminal) or cash.
 */
export async function collectPayment(formData: FormData): Promise<ActionResult> {
  const { admin, course } = await requireCourseAdmin();
  const bookingId = String(formData.get("bookingId") ?? "");
  const mode = (["full", "players", "custom"].includes(String(formData.get("mode"))) ? String(formData.get("mode")) : "full") as ChargeMode;
  const method = String(formData.get("method")) === "cash" ? "cash" : "terminal";
  const players = Math.max(1, Math.round(Number(formData.get("players")) || 1));
  const customCents = Math.round((Number(formData.get("customAmount")) || 0) * 100);

  const booking = await prisma.booking.findFirst({ where: { id: bookingId, courseId: course.id } });
  if (!booking) return { ok: false, message: "Booking not found." };

  // Pro-shop add-ons: form sends `item_<shopItemId>` = quantity.
  const itemQtys = new Map<string, number>();
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("item_")) {
      const qty = Math.max(0, Math.round(Number(v) || 0));
      if (qty > 0) itemQtys.set(k.slice(5), qty);
    }
  }
  let addonsCents = 0;
  const summaryParts: string[] = [];
  if (itemQtys.size > 0) {
    const items = await prisma.shopItem.findMany({
      where: { courseId: course.id, id: { in: [...itemQtys.keys()] }, isActive: true },
    });
    for (const it of items) {
      const qty = itemQtys.get(it.id) ?? 0;
      addonsCents += it.priceCents * qty;
      summaryParts.push(`${qty}× ${it.name}`);
    }
  }

  const base = planCharge(booking, course.linxtimesInPersonFee, { mode, players, customCents, isCard: method === "terminal" });
  const plan = withAddons(base, {
    addonsCents,
    addonSummary: summaryParts.join(", ") || null,
    taxRateBps: course.taxRateBps,
    bookingAlreadyTaxed: booking.taxCents > 0,
  });
  if (plan.chargeTotalCents <= 0) return { ok: false, message: "Enter an amount or add items to charge." };
  const dollars = `$${(plan.chargeTotalCents / 100).toFixed(2)}`;

  if (method === "cash") {
    await recordManualPayment({ booking, plan, method: "cash", adminId: admin.id });
    revalidatePath("/dashboard");
    return { ok: true, message: `Recorded ${dollars} cash.` };
  }

  const receiptEmail = String(formData.get("receiptEmail") ?? "").trim() || undefined;
  const res = await startTerminalPayment({ booking, course, plan, adminId: admin.id, receiptEmail });
  if (!res.ok) return res;
  revalidatePath("/dashboard");
  return { ok: true, message: `Sent ${dollars} to the reader — golfer can tap now.` };
}

/** Mark a booking checked-in / no-show (or reset to confirmed) from the tee sheet. */
export async function setBookingStatus(
  bookingId: string,
  status: "confirmed" | "checked_in" | "no_show"
): Promise<ActionResult> {
  const { course } = await requireCourseAdmin();
  const b = await prisma.booking.findFirst({
    where: { id: bookingId, courseId: course.id },
    select: { id: true, status: true },
  });
  if (!b) return { ok: false, message: "Booking not found." };
  if (b.status === "cancelled") return { ok: false, message: "Booking is cancelled." };
  await prisma.booking.update({ where: { id: bookingId }, data: { status } });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  return {
    ok: true,
    message: status === "checked_in" ? "Checked in." : status === "no_show" ? "Marked no-show." : "Status reset.",
  };
}

/** Flip a course live (status → active), making its public booking page open. */
export async function goLive(): Promise<void> {
  const { course } = await requireCourseAdmin();
  await prisma.course.update({
    where: { id: course.id },
    data: { status: "active", onboardedAt: course.onboardedAt ?? new Date() },
  });
  revalidatePath("/dashboard");
  revalidatePath(`/${course.slug}`);
}

/**
 * Available tee times for the admin booking form — scoped to the admin's course
 * and NOT gated on course status (unlike the public API), so staff can add
 * bookings even before going live. Returns only open (bookable) times.
 */
export async function adminAvailableSlots(
  layoutId: string,
  date: string
): Promise<{ time: string; label: string }[]> {
  const { course } = await requireCourseAdmin();
  if (!layoutId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const layout = await prisma.layout.findFirst({
    where: { id: layoutId, courseId: course.id },
    include: { pricing: true },
  });
  if (!layout) return [];
  const { computeAvailability } = await import("@/lib/availability");
  const { formatTimeLabel } = await import("@/lib/datetime");
  const result = await computeAvailability({ course, layout, dateKey: date });
  return result.slots
    .filter((s) => s.available)
    .map((s) => ({ time: s.time, label: formatTimeLabel(s.time) }));
}

/**
 * Create a walk-in or phone booking from the dashboard. These are staff-entered,
 * paid in person (no online charge) and carry NO LinxTimes fee — the golfer paid
 * the course directly. Slot availability + the double-booking guard still apply.
 */
export async function createWalkIn(formData: FormData): Promise<ActionResult> {
  const { course } = await requireCourseAdmin();

  const layoutId = String(formData.get("layoutId") ?? "");
  const date = String(formData.get("date") ?? "");
  const slotTime = String(formData.get("slotTime") ?? "");
  const numPlayers = Math.max(1, Math.min(4, Math.round(Number(formData.get("numPlayers")) || 1)));
  const holes = Number(formData.get("holes")) === 9 ? 9 : 18;
  const withCart = formData.get("withCart") === "on";
  const source = formData.get("source") === "phone" ? "phone" : "walkin";
  const golferName = String(formData.get("golferName") ?? "").trim();
  const golferPhone = String(formData.get("golferPhone") ?? "").trim() || null;
  const golferEmail = String(formData.get("golferEmail") ?? "").trim().toLowerCase();

  if (!layoutId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(slotTime)) {
    return { ok: false, message: "Layout, date and time are required." };
  }
  if (!golferName) return { ok: false, message: "Golfer name is required." };

  const layout = await prisma.layout.findFirst({
    where: { id: layoutId, courseId: course.id, isActive: true },
    include: { pricing: true },
  });
  if (!layout || !layout.pricing) return { ok: false, message: "Layout not configured." };

  const availability = await computeAvailability({ course, layout, dateKey: date });
  const slot = availability.slots.find((s) => s.time === slotTime);
  if (!slot) return { ok: false, message: "That time isn't on the schedule for this date." };
  if (slot.blocked) return { ok: false, message: slot.reason ?? "That time is closed." };

  const breakdown = computePricing({
    course, pricing: layout.pricing, dateKey: date, slotTime,
    numPlayers, holes, withCart, members: [],
  });
  // No LinxTimes fee on manual bookings.
  const totalCents = breakdown.greenFeeCents + breakdown.cartFeeCents;
  const bookingDate = fromDateKey(date);
  const lockKey = `${layout.id}|${date}|${slotTime}`;

  // Capacity-safe insert: lock the slot, recount players, allow adding a group
  // only if it fits within maxPlayers.
  const outcome: { conflict: number } | { ok: boolean } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    const agg = await tx.booking.aggregate({
      where: { layoutId: layout.id, bookingDate, slotTime, status: { not: "cancelled" } },
      _sum: { numPlayers: true },
    });
    const remaining = slot.maxPlayers - (agg._sum.numPlayers ?? 0);
    if (numPlayers > remaining) return { conflict: remaining } as const;

    const existingCount = await tx.booking.count({ where: { courseId: course.id, bookingDate } });
    for (let attempt = 0; attempt < 5; attempt++) {
      const confirmationNo = buildConfirmationNo(course.slug, date, existingCount + 1 + attempt);
      try {
        await tx.booking.create({
          data: {
            confirmationNo, courseId: course.id, layoutId: layout.id,
            bookingDate, slotTime, numPlayers, withCart, holes,
            golferName, golferEmail: golferEmail || "walkin@" + course.slug + ".local", golferPhone,
            rateType: breakdown.rateType,
            greenFeeCents: breakdown.greenFeeCents, cartFeeCents: breakdown.cartFeeCents,
            bookingFeeCents: 0, totalCents,
            paymentStatus: "pay_at_course", status: "confirmed", source,
          },
        });
        return { ok: true } as const;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }
    }
    return { ok: false } as const;
  });

  if ("conflict" in outcome) {
    return { ok: false, message: outcome.conflict <= 0 ? "That tee time is full." : `Only ${outcome.conflict} spot${outcome.conflict === 1 ? "" : "s"} left at this time.` };
  }
  if (!outcome.ok) return { ok: false, message: "Could not add booking, please retry." };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  return { ok: true, message: `${source === "phone" ? "Phone" : "Walk-in"} booking added.` };
}

/**
 * Edit an existing booking. Name/phone are always editable. For manual
 * (walk-in/phone) bookings, players/holes/cart can be changed and the price is
 * recomputed (capacity-checked). For online bookings the group size is locked,
 * since it's tied to the payment — only contact details can change.
 */
export async function editBooking(formData: FormData): Promise<ActionResult> {
  const { course } = await requireCourseAdmin();
  const id = String(formData.get("bookingId") ?? "");
  const golferName = String(formData.get("golferName") ?? "").trim();
  const golferPhone = String(formData.get("golferPhone") ?? "").trim() || null;
  const numPlayers = Math.max(1, Math.min(4, Math.round(Number(formData.get("numPlayers")) || 1)));
  const holes = Number(formData.get("holes")) === 9 ? 9 : 18;
  const withCart = formData.get("withCart") === "on";

  if (!golferName) return { ok: false, message: "Golfer name is required." };

  const booking = await prisma.booking.findFirst({
    where: { id, courseId: course.id },
    include: { layout: { include: { pricing: true } } },
  });
  if (!booking) return { ok: false, message: "Booking not found." };

  // Online bookings: contact details only (group size is tied to payment).
  if (booking.source === "online") {
    await prisma.booking.update({ where: { id }, data: { golferName, golferPhone } });
    revalidatePath("/dashboard");
    return { ok: true, message: "Booking updated." };
  }

  // Manual bookings: recompute price + capacity-check the new group size.
  const pricing = booking.layout.pricing;
  if (!pricing) return { ok: false, message: "Layout not configured." };
  const lockKey = `${booking.layoutId}|${toDateKey(booking.bookingDate)}|${booking.slotTime}`;

  const outcome: { conflict: number } | { ok: boolean } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    const template = await tx.teeTimeSlot.findUnique({
      where: { layoutId_dayOfWeek: { layoutId: booking.layoutId, dayOfWeek: booking.bookingDate.getUTCDay() } },
    });
    const override = await tx.dailyOverride.findFirst({ where: { courseId: course.id, overrideDate: booking.bookingDate, slotTime: booking.slotTime } });
    const maxPlayers = override?.maxPlayers ?? template?.maxPlayers ?? 4;
    const agg = await tx.booking.aggregate({
      where: { layoutId: booking.layoutId, bookingDate: booking.bookingDate, slotTime: booking.slotTime, status: { not: "cancelled" }, id: { not: id } },
      _sum: { numPlayers: true },
    });
    const remaining = maxPlayers - (agg._sum.numPlayers ?? 0);
    if (numPlayers > remaining) return { conflict: remaining } as const;

    const bd = computePricing({ course, pricing, dateKey: toDateKey(booking.bookingDate), slotTime: booking.slotTime, numPlayers, holes, withCart, members: [] });
    await tx.booking.update({
      where: { id },
      data: { golferName, golferPhone, numPlayers, holes, withCart, greenFeeCents: bd.greenFeeCents, cartFeeCents: bd.cartFeeCents, totalCents: bd.greenFeeCents + bd.cartFeeCents },
    });
    return { ok: true } as const;
  });

  if ("conflict" in outcome) {
    return { ok: false, message: `Only ${Math.max(0, outcome.conflict)} spot(s) available for this group.` };
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  return { ok: true, message: "Booking updated." };
}

/**
 * Admin-authenticated cancellation. Verifies the booking belongs to the signed
 * in admin's course (tenant isolation) before invoking the cancellation service
 * that enforces the 24-hour rule and issues the partial refund.
 */
export async function cancelBookingAction(
  bookingId: string,
  reason: string,
  override: boolean
): Promise<ActionResult> {
  const { admin, course } = await requireCourseAdmin();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { courseId: true },
  });
  if (!booking || booking.courseId !== course.id) {
    return { ok: false, message: "Booking not found." };
  }

  const res = await cancelBooking({
    bookingId,
    cancelledBy: admin.id,
    reason: reason.trim() || undefined,
    override,
  });

  if (!res.ok) {
    return { ok: false, message: res.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  return {
    ok: true,
    message: res.refunded
      ? `Cancelled — refunded $${(res.refundedCents / 100).toFixed(2)} (LinxTimes fee kept).`
      : "Booking cancelled.",
  };
}
