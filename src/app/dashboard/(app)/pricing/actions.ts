"use server";

import { revalidatePath } from "next/cache";
import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { fromDateKey } from "@/lib/datetime";

const toCents = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
};
const toInt = (v: FormDataEntryValue | null, min: number, max: number, dflt: number) => {
  const n = Math.round(Number(String(v ?? "").trim()));
  return Number.isFinite(n) && n >= min && n <= max ? n : dflt;
};

export interface ActionResult {
  ok: boolean;
  message: string;
}

async function loadOwnedPricing(courseId: string, pricingId: string) {
  return prisma.pricing.findFirst({
    where: { id: pricingId, layout: { courseId } },
    include: { bands: { orderBy: { startHour: "asc" } } },
  });
}

/** Create the first (full-day) band for a layout that has none yet. */
export async function createFirstBand(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const { course } = await requireCourseAdmin();
  const layoutId = String(formData.get("layoutId") ?? "");
  const layout = await prisma.layout.findFirst({ where: { id: layoutId, courseId: course.id } });
  if (!layout) return { ok: false, message: "Layout not found." };

  const pricing = await prisma.pricing.upsert({
    where: { layoutId: layout.id },
    update: {},
    create: { layoutId: layout.id },
  });
  const count = await prisma.priceBand.count({ where: { pricingId: pricing.id } });
  if (count === 0) {
    await prisma.priceBand.create({
      data: { pricingId: pricing.id, startHour: 0, endHour: 24, monThuFeeCents: 5000, friFeeCents: 5000, satFeeCents: 7000, sunFeeCents: 7000, sortOrder: 0 },
    });
  }
  revalidatePath("/dashboard/pricing");
  return { ok: true, message: "Time band added." };
}

/**
 * Save everything at once: the non-band settings plus every band's four fees,
 * keyed as band_<id>_monThu / _fri / _sat / _sun. One button, one atomic save.
 */
export async function saveAllPricing(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const { course } = await requireCourseAdmin();
  const layoutId = String(formData.get("layoutId") ?? "");

  const layout = await prisma.layout.findFirst({
    where: { id: layoutId, courseId: course.id },
    include: { pricing: { include: { bands: true } } },
  });
  if (!layout) return { ok: false, message: "Layout not found." };

  const simpleData = {
    memberFee: toCents(formData.get("memberFee")),
    cartFee: toCents(formData.get("cartFee")),
    cartAvailable: formData.get("cartAvailable") === "on",
    nineHoleDiscount: formData.get("nineHoleDiscount") === "on",
  };

  const pricing = await prisma.pricing.upsert({
    where: { layoutId: layout.id },
    update: simpleData,
    create: {
      ...simpleData,
      layoutId: layout.id,
      bands: { create: [{ startHour: 0, endHour: 24, monThuFeeCents: 5000, friFeeCents: 5000, satFeeCents: 7000, sunFeeCents: 7000, sortOrder: 0 }] },
    },
    include: { bands: true },
  });

  // Safety net for a pricing row that predates the band system (or otherwise
  // has none) — give it a starting band rather than silently pricing at $0.
  if (pricing.bands.length === 0) {
    const band = await prisma.priceBand.create({
      data: { pricingId: pricing.id, startHour: 0, endHour: 24, monThuFeeCents: 5000, friFeeCents: 5000, satFeeCents: 7000, sunFeeCents: 7000, sortOrder: 0 },
    });
    pricing.bands.push(band);
  }

  const updates = pricing.bands
    .filter((b) => formData.has(`band_${b.id}_monThu`))
    .map((b) =>
      prisma.priceBand.update({
        where: { id: b.id },
        data: {
          monThuFeeCents: toCents(formData.get(`band_${b.id}_monThu`)),
          friFeeCents: toCents(formData.get(`band_${b.id}_fri`)),
          satFeeCents: toCents(formData.get(`band_${b.id}_sat`)),
          sunFeeCents: toCents(formData.get(`band_${b.id}_sun`)),
        },
      })
    );
  if (updates.length > 0) await prisma.$transaction(updates);

  revalidatePath("/dashboard/pricing");
  revalidatePath(`/${course.slug}`);
  return { ok: true, message: `${layout.name} pricing saved.` };
}

/**
 * Move the boundary between two adjacent bands. Both bands' hours update
 * together, so the set of bands always covers the full day with no gaps.
 */
export async function moveBoundary(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const { course } = await requireCourseAdmin();
  const beforeId = String(formData.get("beforeBandId") ?? "");
  const afterId = String(formData.get("afterBandId") ?? "");
  const newHour = toInt(formData.get("hour"), 1, 23, -1);
  if (newHour < 0) return { ok: false, message: "Invalid time." };

  const before = await prisma.priceBand.findFirst({ where: { id: beforeId, pricing: { layout: { courseId: course.id } } } });
  const after = await prisma.priceBand.findFirst({ where: { id: afterId, pricing: { layout: { courseId: course.id } } } });
  if (!before || !after) return { ok: false, message: "Time band not found." };
  if (newHour <= before.startHour || newHour >= after.endHour) {
    return { ok: false, message: "That time doesn't fit between the bands on either side." };
  }

  await prisma.$transaction([
    prisma.priceBand.update({ where: { id: before.id }, data: { endHour: newHour } }),
    prisma.priceBand.update({ where: { id: after.id }, data: { startHour: newHour } }),
  ]);
  revalidatePath("/dashboard/pricing");
  revalidatePath(`/${course.slug}`);
  return { ok: true, message: "Time updated." };
}

/** Split a band into two at the given hour, both halves starting with the same fees. */
export async function splitBand(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const { course } = await requireCourseAdmin();
  const bandId = String(formData.get("bandId") ?? "");
  const atHour = toInt(formData.get("hour"), 1, 23, -1);

  const band = await prisma.priceBand.findFirst({ where: { id: bandId, pricing: { layout: { courseId: course.id } } } });
  if (!band) return { ok: false, message: "Time band not found." };
  if (atHour <= band.startHour || atHour >= band.endHour) {
    return { ok: false, message: "Pick a time inside that band." };
  }

  await prisma.$transaction([
    prisma.priceBand.update({ where: { id: band.id }, data: { endHour: atHour } }),
    prisma.priceBand.create({
      data: {
        pricingId: band.pricingId,
        startHour: atHour,
        endHour: band.endHour,
        monThuFeeCents: band.monThuFeeCents,
        friFeeCents: band.friFeeCents,
        satFeeCents: band.satFeeCents,
        sunFeeCents: band.sunFeeCents,
        sortOrder: band.sortOrder + 1,
      },
    }),
  ]);
  revalidatePath("/dashboard/pricing");
  revalidatePath(`/${course.slug}`);
  return { ok: true, message: "Time band added." };
}

/** Remove a band by merging it into its neighbor (keeps the day fully covered). */
export async function mergeBand(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const { course } = await requireCourseAdmin();
  const bandId = String(formData.get("bandId") ?? "");

  const band = await prisma.priceBand.findFirst({ where: { id: bandId, pricing: { layout: { courseId: course.id } } } });
  if (!band) return { ok: false, message: "Time band not found." };

  const pricing = await loadOwnedPricing(course.id, band.pricingId);
  if (!pricing || pricing.bands.length <= 1) return { ok: false, message: "You need at least one time band." };

  const idx = pricing.bands.findIndex((b) => b.id === bandId);
  const next = pricing.bands[idx + 1];
  const prev = pricing.bands[idx - 1];

  if (next) {
    // Merge forward: extend this band's neighbor to start where this one did, drop this one.
    await prisma.$transaction([
      prisma.priceBand.update({ where: { id: next.id }, data: { startHour: band.startHour } }),
      prisma.priceBand.delete({ where: { id: band.id } }),
    ]);
  } else if (prev) {
    await prisma.$transaction([
      prisma.priceBand.update({ where: { id: prev.id }, data: { endHour: band.endHour } }),
      prisma.priceBand.delete({ where: { id: band.id } }),
    ]);
  }
  revalidatePath("/dashboard/pricing");
  revalidatePath(`/${course.slug}`);
  return { ok: true, message: "Time band removed." };
}

/** Update the course-wide booking window. */
export async function updateBookingWindow(formData: FormData): Promise<void> {
  const { course } = await requireCourseAdmin();
  const maxDaysAhead = toInt(formData.get("maxDaysAhead"), 1, 365, 14);
  await prisma.course.update({
    where: { id: course.id },
    data: { maxDaysAhead },
  });
  revalidatePath("/dashboard/pricing");
  revalidatePath(`/${course.slug}`);
}

/** Set (or replace) a whole-day flat price for one date — e.g. a holiday rate. */
export async function setDateOverride(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const { course } = await requireCourseAdmin();
  const date = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "Pick a date." };
  const feeCents = toCents(formData.get("fee"));
  if (feeCents <= 0) return { ok: false, message: "Enter a price." };
  const reason = String(formData.get("reason") ?? "").trim() || null;

  const overrideDate = fromDateKey(date);
  const existing = await prisma.dailyOverride.findFirst({
    where: { courseId: course.id, overrideDate, slotTime: null },
  });
  if (existing) {
    await prisma.dailyOverride.update({ where: { id: existing.id }, data: { feeCents, reason, isClosed: false } });
  } else {
    await prisma.dailyOverride.create({
      data: { courseId: course.id, overrideDate, slotTime: null, isClosed: false, feeCents, reason },
    });
  }
  revalidatePath("/dashboard/pricing");
  revalidatePath(`/${course.slug}`);
  return { ok: true, message: "One-day price set." };
}

/** Remove a one-day price override. */
export async function deleteDateOverride(formData: FormData): Promise<void> {
  const { course } = await requireCourseAdmin();
  const id = String(formData.get("overrideId") ?? "");
  const row = await prisma.dailyOverride.findFirst({ where: { id, courseId: course.id } });
  if (!row) return;
  await prisma.dailyOverride.delete({ where: { id } });
  revalidatePath("/dashboard/pricing");
  revalidatePath(`/${course.slug}`);
}

/** Create a membership tier (scoped to the admin's course). */
export async function createMembershipTier(formData: FormData): Promise<void> {
  const { course } = await requireCourseAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const price = toCents(formData.get("price"));

  if (!name || price <= 0) return;

  await prisma.membershipTier.create({
    data: {
      courseId: course.id,
      name,
      priceCents: price,
    },
  });
  revalidatePath("/dashboard/pricing");
}

/** Delete a membership tier (scoped to the admin's course). */
export async function deleteMembershipTier(formData: FormData): Promise<void> {
  const { course } = await requireCourseAdmin();
  const tierId = String(formData.get("tierId") ?? "");

  const tier = await prisma.membershipTier.findFirst({
    where: { id: tierId, courseId: course.id },
  });
  if (!tier) return;

  await prisma.membershipTier.delete({ where: { id: tierId } });
  revalidatePath("/dashboard/pricing");
}
