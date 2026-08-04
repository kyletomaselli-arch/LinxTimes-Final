"use server";

import { revalidatePath } from "next/cache";
import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const toCents = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
};
const toInt = (v: FormDataEntryValue | null, min: number, max: number, dflt: number) => {
  const n = Math.round(Number(String(v ?? "").trim()));
  return Number.isFinite(n) && n >= min && n <= max ? n : dflt;
};

/** Update pricing for one layout (scoped to the admin's course). */
export async function updatePricing(formData: FormData): Promise<void> {
  const { course } = await requireCourseAdmin();
  const layoutId = String(formData.get("layoutId") ?? "");

  const layout = await prisma.layout.findFirst({
    where: { id: layoutId, courseId: course.id },
    include: { pricing: true },
  });
  if (!layout) return;

  const data = {
    weekdayFee: toCents(formData.get("weekdayFee")),
    weekendFee: toCents(formData.get("weekendFee")),
    twilightFee: toCents(formData.get("twilightFee")),
    twilightHour: toInt(formData.get("twilightHour"), 0, 23, 16),
    memberFee: toCents(formData.get("memberFee")),
    cartFee: toCents(formData.get("cartFee")),
    cartAvailable: formData.get("cartAvailable") === "on",
    nineHoleDiscount: formData.get("nineHoleDiscount") === "on",
    twilightEnabled: formData.get("twilightEnabled") === "on",
  };

  await prisma.pricing.upsert({
    where: { layoutId: layout.id },
    update: data,
    create: { ...data, layoutId: layout.id },
  });
  revalidatePath("/dashboard/pricing");
  revalidatePath(`/${course.slug}`);
}

/** Update the course-wide booking window. */
export async function updateBookingWindow(formData: FormData): Promise<void> {
  const { course } = await requireCourseAdmin();
  await prisma.course.update({
    where: { id: course.id },
    data: { maxDaysAhead: toInt(formData.get("maxDaysAhead"), 1, 365, 14) },
  });
  revalidatePath("/dashboard/pricing");
  revalidatePath(`/${course.slug}`);
}

/** Add or update a pricing tier. */
export async function savePricingTier(formData: FormData): Promise<void> {
  const { course } = await requireCourseAdmin();
  const layoutId = String(formData.get("layoutId") ?? "");
  const tierId = String(formData.get("tierId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const startHour = Math.max(0, Math.min(23, Math.round(Number(formData.get("startHour")) || 0)));
  const endHour = Math.max(0, Math.min(23, Math.round(Number(formData.get("endHour")) || 0)));
  const feeCents = toCents(formData.get("fee"));
  const applyTo = ["weekday", "weekend", "both"].includes(String(formData.get("applyTo"))) ? String(formData.get("applyTo")) : "both";

  const layout = await prisma.layout.findFirst({ where: { id: layoutId, courseId: course.id }, include: { pricing: true } });
  if (!layout?.pricing) return;

  if (tierId) {
    await prisma.pricingTier.update({
      where: { id: tierId },
      data: { name, startHour, endHour, feeCents, applyTo },
    });
  } else {
    await prisma.pricingTier.create({
      data: { pricingId: layout.pricing.id, name, startHour, endHour, feeCents, applyTo, sortOrder: 999 },
    });
  }
  revalidatePath("/dashboard/pricing");
  revalidatePath(`/${course.slug}`);
}

/** Delete a pricing tier. */
export async function deletePricingTier(formData: FormData): Promise<void> {
  const { course } = await requireCourseAdmin();
  const tierId = String(formData.get("tierId") ?? "");

  const tier = await prisma.pricingTier.findUnique({ where: { id: tierId }, include: { pricing: { include: { layout: true } } } });
  if (!tier || tier.pricing.layout.courseId !== course.id) return;

  await prisma.pricingTier.delete({ where: { id: tierId } });
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
