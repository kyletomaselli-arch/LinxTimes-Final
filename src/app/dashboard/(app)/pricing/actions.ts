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
