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
 * Log payment errors for LinxTimes monitoring — console for dev, Sentry for
 * production alerting across all courses.
 */
async function logPaymentError(courseId: string, bookingId: string, errorType: string, details: string) {
  try {
    console.error(`[PAYMENT ERROR] Course: ${courseId} | Booking: ${bookingId} | Type: ${errorType} | Details: ${details}`);
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureMessage(`[PAYMENT ERROR] ${errorType}: ${details}`, {
      level: "error",
      tags: { courseId, bookingId, errorType },
    });
  } catch (err) {
    console.error("Failed to log payment error", err);
  }
}

/**
 * Collect an in-person payment for a booking. Any pro-shop worker can do this
 * (no role gate). Supports: whole remaining, split per player, pay for N
 * players, or a custom amount — via the card reader (Stripe Terminal) or cash.
 */
export async function collectPayment(formData: FormData): Promise<ActionResult & { paymentId?: string }> {
  const { admin, course } = await requireCourseAdmin();
  const bookingId = String(formData.get("bookingId") ?? "");
  const modeStr = String(formData.get("mode") ?? "full");
  const isMemberMode = modeStr === "member";
  const mode = (["full", "players", "custom"].includes(modeStr) ? modeStr : "full") as ChargeMode;
  const method = String(formData.get("method")) === "cash" ? "cash" : "terminal";
  const players = Math.max(1, Math.round(Number(formData.get("players")) || 1));
  const customCents = Math.round((Number(formData.get("customAmount")) || 0) * 100);
  const memberId = isMemberMode ? String(formData.get("memberId") ?? "") : null;

  const booking = await prisma.booking.findFirst({ where: { id: bookingId, courseId: course.id } });
  if (!booking) return { ok: false, message: "Booking not found." };

  // Server-side guard against double-charging: an online-paid booking has
  // nothing left to collect (amountPaidCents only tracks in-person payments,
  // so planCharge would otherwise see the full total as "remaining").
  if (booking.paymentStatus === "paid_online") {
    return { ok: false, message: "This booking was already paid online. Use Quick charge for add-on purchases." };
  }

  // If member mode, validate member and calculate their share
  let memberShareCents = 0;
  if (isMemberMode) {
    if (!memberId) return { ok: false, message: "Select a member first." };
    const member = await prisma.member.findFirst({ where: { id: memberId, courseId: course.id } });
    if (!member) return { ok: false, message: "Member not found." };

    const layout = await prisma.layout.findUnique({
      where: { id: booking.layoutId },
      include: { pricing: true },
    });
    if (!layout?.pricing) return { ok: false, message: "Pricing not found." };

    const memberRate = member.greenFeeOverride ?? layout.pricing.memberFee;
    // Members whose membership includes a cart don't pay the cart fee —
    // matches calculateMemberShare below.
    const cartFee = booking.withCart && !member.cartIncluded ? layout.pricing.cartFee : 0;
    memberShareCents = memberRate + cartFee;
  }

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

  // When paying for a member, charge only their share with their pricing.
  // This must apply even when the share is $0 (comp member) — falling through
  // to "full" mode would charge the member the whole remaining balance.
  let chargeMode = mode;
  let chargeCustomCents = customCents;
  if (isMemberMode) {
    chargeMode = "custom";
    chargeCustomCents = memberShareCents;
  }

  const base = planCharge(booking, course.linxtimesInPersonFee, { mode: chargeMode, players, customCents: chargeCustomCents, isCard: method === "terminal" });
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
  if (!res.ok) {
    await logPaymentError(course.id, booking.id, "TERMINAL_PAYMENT_ERROR", res.message);
    return res;
  }
  revalidatePath("/dashboard");
  // NOT success yet — the golfer still has to tap. The client polls
  // checkPaymentStatus with this paymentId until the webhook settles it.
  return { ok: true, message: `Sent ${dollars} to the reader — golfer can tap now.`, paymentId: res.paymentId };
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
  if (!slot.available) return { ok: false, message: "That tee time is full." };
  if (numPlayers > slot.spotsLeft) return { ok: false, message: `Only ${slot.spotsLeft} spot${slot.spotsLeft === 1 ? "" : "s"} left at this time.` };

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

/**
 * Check the status of a payment for a booking. When paymentId is provided the
 * exact payment row is polled (so an older succeeded payment on the same
 * booking can never masquerade as the in-flight one); otherwise falls back to
 * the most recent payment.
 */
export async function checkPaymentStatus(bookingId: string, paymentId?: string): Promise<{ status: "pending" | "succeeded" | "failed"; amountCents?: number; errorMessage?: string }> {
  const { course } = await requireCourseAdmin();
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, courseId: course.id } });
  if (!booking) return { status: "failed", errorMessage: "Booking not found" };

  const payment = await prisma.payment.findFirst({
    where: { bookingId, courseId: course.id, ...(paymentId ? { id: paymentId } : {}) },
    orderBy: { createdAt: "desc" },
    select: { state: true, amountCents: true, feeCents: true, addonsCents: true, taxCents: true },
  });

  if (!payment) return { status: "failed", errorMessage: "No payment record found" };

  return {
    status: payment.state === "succeeded" ? "succeeded" : payment.state === "failed" ? "failed" : "pending",
    amountCents: payment.amountCents + (payment.feeCents ?? 0) + (payment.addonsCents ?? 0) + (payment.taxCents ?? 0),
    errorMessage: payment.state === "failed" ? "Card reader offline or card declined. Try again or use cash." : undefined,
  };
}

// TODO: Re-enable after launch
// /**
//  * Get the last payment for a booking (for payment status display).
//  */
// export async function getLastPayment(bookingId: string): Promise<{ state: string; amountCents: number; method: string; createdAt: string; createdByName?: string } | null> {
//   const { course } = await requireCourseAdmin();
//   const booking = await prisma.booking.findFirst({ where: { id: bookingId, courseId: course.id } });
//   if (!booking) return null;
//
//   const payment = await prisma.payment.findFirst({
//     where: { bookingId, courseId: course.id },
//     orderBy: { createdAt: "desc" },
//     select: { state: true, amountCents: true, method: true, createdAt: true, createdBy: true },
//   });
//
//   if (!payment) return null;
//
//   return {
//     state: payment.state,
//     amountCents: payment.amountCents,
//     method: payment.method,
//     createdAt: payment.createdAt.toISOString(),
//     createdByName: payment.createdBy || "Unknown",
//   };
// }

/**
 * Cancel a pending card payment — staff hit "Cancel payment" because the golfer
 * is taking too long, the reader is stuck, or they want to switch to cash.
 *
 * This tells Stripe to stop the reader prompting and voids the PaymentIntent so
 * it can never capture later, THEN marks our row failed. If the golfer tapped in
 * the same instant and the charge already succeeded, the Stripe cancels throw
 * (caught) and the payment_intent.succeeded webhook still flips the row back to
 * succeeded — the webhook stays authoritative, so we never lose a real charge.
 */
export async function cancelPendingPayment(bookingId: string): Promise<ActionResult> {
  const { course } = await requireCourseAdmin();
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, courseId: course.id } });
  if (!booking) return { ok: false, message: "Booking not found." };

  const payment = await prisma.payment.findFirst({
    where: { bookingId, courseId: course.id, method: "terminal", state: "pending" },
  });

  if (!payment) {
    return { ok: false, message: "No pending card payment to cancel." };
  }

  // Best-effort: stop the physical reader and void the intent on Stripe.
  if (course.stripeAccountId) {
    try {
      const { getStripe } = await import("@/lib/stripe");
      const stripe = getStripe();
      const opts = { stripeAccount: course.stripeAccountId } as const;
      if (course.stripeTerminalReaderId) {
        await stripe.terminal.readers.cancelAction(course.stripeTerminalReaderId, {}, opts).catch(() => {});
      }
      if (payment.stripePaymentIntentId) {
        await stripe.paymentIntents.cancel(payment.stripePaymentIntentId, {}, opts).catch(() => {});
      }
    } catch (err) {
      console.error("[cancelPendingPayment] Stripe cancel failed", err);
    }
  }

  // Clear the lock. A succeeded webhook can still override this back to succeeded.
  await prisma.payment.updateMany({
    where: { id: payment.id, state: "pending" },
    data: { state: "failed" },
  });

  revalidatePath("/dashboard");
  return { ok: true, message: "Payment cancelled. You can try again or take cash." };
}

/**
 * Calculate what a member's individual share would be if linked to a booking.
 * Returns the per-player amount with member pricing applied.
 */
export async function calculateMemberShare(bookingId: string, memberId: string): Promise<{ memberCents: number; groupTotalCents: number; memberName: string } | null> {
  const { course } = await requireCourseAdmin();
  const [booking, member] = await Promise.all([
    prisma.booking.findFirst({ where: { id: bookingId, courseId: course.id } }),
    prisma.member.findFirst({ where: { id: memberId, courseId: course.id } }),
  ]);

  if (!booking || !member) return null;

  // Member's per-player amount is their override rate or the layout's member rate
  const layout = await prisma.layout.findUnique({
    where: { id: booking.layoutId },
    include: { pricing: true },
  });
  if (!layout?.pricing) return null;

  const memberRate = member.greenFeeOverride ?? layout.pricing.memberFee;
  // Only charge cart fee if member doesn't have cart included with membership
  const cartFee = (booking.withCart && !member.cartIncluded) ? layout.pricing.cartFee : 0;
  const memberCents = memberRate + cartFee;

  // Calculate the recalculated group total with member discount
  // Original per-player rate = booking.totalCents / booking.numPlayers
  const originalPerPlayer = booking.numPlayers > 0 ? Math.round(booking.totalCents / booking.numPlayers) : 0;
  // New total = member's cost + (other players × original per-player rate)
  const groupTotalCents = memberCents + ((booking.numPlayers - 1) * originalPerPlayer);

  return {
    memberCents,
    groupTotalCents,
    memberName: `${member.firstName} ${member.lastName}`,
  };
}

/**
 * Get the waitlist for a specific day and course.
 */
export async function getWaitlistForDay(date: string): Promise<Array<{ id: string; layoutId: string; slotTime: string; name: string; email: string; phone: string | null; numPlayers: number }>> {
  const { course } = await requireCourseAdmin();
  const bookingDate = fromDateKey(date);

  const waitlist = await prisma.waitlist.findMany({
    where: {
      courseId: course.id,
      bookingDate,
      notifiedAt: null, // only show people who haven't been notified yet
    },
    select: { id: true, layoutId: true, slotTime: true, name: true, email: true, phone: true, numPlayers: true },
    orderBy: [{ slotTime: "asc" }, { createdAt: "asc" }],
  });

  return waitlist;
}

/**
 * Search members by name for linking during payment.
 */
export async function searchMembersForLinking(query: string): Promise<Array<{ id: string; name: string }>> {
  const { course } = await requireCourseAdmin();
  if (!query.trim()) return [];

  const q = query.toLowerCase().trim();
  const members = await prisma.member.findMany({
    where: {
      courseId: course.id,
      isActive: true,
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { memberId: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, firstName: true, lastName: true },
    take: 10,
  });

  return members.map((m) => ({
    id: m.id,
    name: `${m.firstName} ${m.lastName}`,
  }));
}

export interface DashboardSearchResult {
  bookings: Array<{
    id: string;
    golferName: string;
    confirmationNo: string;
    dateKey: string;
    slotTime: string;
    numPlayers: number;
    paymentStatus: string;
    status: string;
  }>;
  members: Array<{ id: string; name: string; memberId: string }>;
}

/**
 * Live search for the dashboard top bar: bookings by golfer name, email, or
 * confirmation number, plus members by name or member ID. Scoped to the
 * admin's course; upcoming bookings surface first.
 */
export async function searchDashboard(query: string): Promise<DashboardSearchResult> {
  const { course } = await requireCourseAdmin();
  const q = query.trim();
  if (q.length < 2) return { bookings: [], members: [] };

  const [bookings, members] = await Promise.all([
    prisma.booking.findMany({
      where: {
        courseId: course.id,
        OR: [
          { golferName: { contains: q, mode: "insensitive" } },
          { golferEmail: { contains: q, mode: "insensitive" } },
          { confirmationNo: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: [{ bookingDate: "desc" }, { slotTime: "asc" }],
      take: 6,
      select: {
        id: true, golferName: true, confirmationNo: true, bookingDate: true,
        slotTime: true, numPlayers: true, paymentStatus: true, status: true,
      },
    }),
    prisma.member.findMany({
      where: {
        courseId: course.id,
        isActive: true,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { memberId: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 4,
      select: { id: true, firstName: true, lastName: true, memberId: true },
    }),
  ]);

  return {
    bookings: bookings.map((b) => ({
      id: b.id,
      golferName: b.golferName,
      confirmationNo: b.confirmationNo,
      dateKey: toDateKey(b.bookingDate),
      slotTime: b.slotTime,
      numPlayers: b.numPlayers,
      paymentStatus: b.paymentStatus,
      status: b.status,
    })),
    members: members.map((m) => ({ id: m.id, name: `${m.firstName} ${m.lastName}`, memberId: m.memberId })),
  };
}

/** Charge for add-ons or custom amount without a booking (Quick Charge). */
export async function chargeQuick(formData: FormData): Promise<ActionResult & { paymentId?: string }> {
  const { course, admin } = await requireCourseAdmin();
  const email = String(formData.get("email") ?? "").trim();
  const method = String(formData.get("method")) === "cash" ? "cash" : "terminal";
  const amountCents = Math.max(0, Math.round(Number(formData.get("amountCents") ?? 0)));

  if (!email || !amountCents) {
    return { ok: false, message: "Email and amount are required." };
  }

  // $0.50 fee if charge is over $5
  const feeCents = amountCents > 500 ? 50 : 0;
  // Calculate tax on the amount (fee is not taxed)
  const taxCents = Math.round((amountCents * course.taxRateBps) / 10000);
  const totalCents = amountCents + feeCents + taxCents;

  try {
    if (method === "cash") {
      // Cash: create payment immediately as succeeded
      await prisma.payment.create({
        data: {
          courseId: course.id,
          method: "cash",
          state: "succeeded",
          amountCents,
          feeCents: 0, // no platform fee on cash
          taxCents,
          addonsCents: 0,
          description: `Quick charge`,
          createdBy: admin.id,
          metadata: { kind: "quick_charge", email },
        },
      });
      return { ok: true, message: "Cash payment recorded." };
    }

    // Terminal payment
    if (!course.stripeAccountId || !course.stripeOnboarded) {
      return { ok: false, message: "Connect the course's Stripe account first (Settings → Payments)." };
    }
    if (!course.stripeTerminalReaderId) {
      return { ok: false, message: "Register a card reader first (Settings → Payments)." };
    }

    // Double-submit guard: one quick charge on the reader at a time.
    const inFlight = await prisma.payment.findFirst({
      where: {
        courseId: course.id, method: "terminal", state: "pending", bookingId: null,
        description: "Quick charge",
        createdAt: { gt: new Date(Date.now() - 2 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (inFlight) {
      return { ok: false, message: "A card payment is already in progress on the reader — finish or cancel it first." };
    }

    const { getStripe } = await import("@/lib/stripe");
    const stripe = getStripe();

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        courseId: course.id,
        method: "terminal",
        state: "pending",
        amountCents,
        feeCents,
        taxCents,
        addonsCents: 0,
        description: "Quick charge",
        createdBy: admin.id,
        metadata: { kind: "quick_charge", email },
      },
    });

    try {
      // Create PaymentIntent
      const intent = await stripe.paymentIntents.create(
        {
          amount: totalCents,
          currency: "usd",
          payment_method_types: ["card_present"],
          capture_method: "automatic",
          application_fee_amount: feeCents,
          description: "Quick charge",
          ...(email ? { receipt_email: email } : {}),
          metadata: { kind: "quick_charge", paymentId: payment.id, courseId: course.id },
        },
        { stripeAccount: course.stripeAccountId }
      );
      await prisma.payment.update({ where: { id: payment.id }, data: { stripePaymentIntentId: intent.id } });

      // Push to reader
      await stripe.terminal.readers.processPaymentIntent(
        course.stripeTerminalReaderId,
        { payment_intent: intent.id },
        { stripeAccount: course.stripeAccountId }
      );

      return { ok: true, message: "Processing payment on terminal...", paymentId: payment.id };
    } catch (err) {
      // Don't leave a stuck pending row blocking the next quick charge.
      await prisma.payment.update({ where: { id: payment.id }, data: { state: "failed" } });
      throw err;
    }
  } catch (err) {
    console.error("Quick charge error:", err);
    return { ok: false, message: "Payment processing failed. Check reader is online." };
  }
}

/** Check quick charge payment status. */
export async function checkQuickChargeStatus(paymentId: string): Promise<{ status: "pending" | "succeeded" | "failed"; message?: string }> {
  const { course } = await requireCourseAdmin();
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, courseId: course.id },
  });

  if (!payment) return { status: "failed", message: "Payment not found" };

  if (payment.state === "succeeded") {
    return { status: "succeeded", message: "Payment successful" };
  }
  if (payment.state === "failed") {
    return { status: "failed", message: "Payment failed" };
  }
  return { status: "pending", message: "Waiting for payment..." };
}
