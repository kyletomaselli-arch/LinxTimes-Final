"use server";

import { revalidatePath } from "next/cache";
import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { fromDateKey, timeToMinutes, minutesToTime } from "@/lib/datetime";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

async function revalidate(slug: string) {
  revalidatePath("/dashboard/tee-times");
  revalidatePath(`/${slug}`);
}

/** Add a layout with sensible default pricing + a 7am–6pm/10-min slot on every day. */
export async function addLayout(formData: FormData): Promise<void> {
  const { course } = await requireCourseAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const holes = Number(formData.get("holes")) === 9 ? 9 : 18;
  if (!name) return;

  const layout = await prisma.layout.create({
    data: { courseId: course.id, name, holes, isActive: true },
  });
  await prisma.pricing.create({ data: { layoutId: layout.id } });
  for (let day = 0; day <= 6; day++) {
    await prisma.teeTimeSlot.create({
      data: { layoutId: layout.id, dayOfWeek: day, startTime: "07:00", endTime: "18:00", intervalMin: 10, maxPlayers: 4, isActive: true },
    });
  }
  await revalidate(course.slug);
}

export async function updateLayout(formData: FormData): Promise<void> {
  const { course } = await requireCourseAdmin();
  const id = String(formData.get("id") ?? "");
  const layout = await prisma.layout.findFirst({ where: { id, courseId: course.id } });
  if (!layout) return;
  await prisma.layout.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? layout.name).trim() || layout.name,
      holes: Number(formData.get("holes")) === 9 ? 9 : 18,
      isActive: formData.get("isActive") === "on",
    },
  });
  await revalidate(course.slug);
}

/** Save all 7 day-of-week slot templates for a layout at once. */
export async function saveSlots(formData: FormData): Promise<void> {
  const { course } = await requireCourseAdmin();
  const layoutId = String(formData.get("layoutId") ?? "");
  const layout = await prisma.layout.findFirst({ where: { id: layoutId, courseId: course.id } });
  if (!layout) return;

  for (let day = 0; day <= 6; day++) {
    const start = String(formData.get(`start_${day}`) ?? "07:00");
    const end = String(formData.get(`end_${day}`) ?? "18:00");
    const interval = Math.max(5, Math.min(60, Math.round(Number(formData.get(`interval_${day}`)) || 10)));
    const maxPlayers = Math.max(1, Math.min(6, Math.round(Number(formData.get(`max_${day}`)) || 4)));
    const isActive = formData.get(`active_${day}`) === "on";
    if (!HHMM.test(start) || !HHMM.test(end)) continue;

    await prisma.teeTimeSlot.upsert({
      where: { layoutId_dayOfWeek: { layoutId, dayOfWeek: day } },
      update: { startTime: start, endTime: end, intervalMin: interval, maxPlayers, isActive },
      create: { layoutId, dayOfWeek: day, startTime: start, endTime: end, intervalMin: interval, maxPlayers, isActive },
    });
  }
  await revalidate(course.slug);
}

export async function addOverride(formData: FormData): Promise<void> {
  const { course } = await requireCourseAdmin();
  const date = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const slotTime = String(formData.get("slotTime") ?? "").trim();
  await prisma.dailyOverride.create({
    data: {
      courseId: course.id,
      overrideDate: fromDateKey(date),
      slotTime: HHMM.test(slotTime) ? slotTime : null,
      isClosed: true,
      reason: String(formData.get("reason") ?? "").trim() || null,
    },
  });
  await revalidate(course.slug);
}

/**
 * Close every tee time in a start–end range on a date (e.g. a tournament or
 * outing). Generates a per-slot closure for each template time in range across
 * the course's active layouts, replacing any existing closures in that range.
 */
export async function blockRange(formData: FormData): Promise<void> {
  const { course } = await requireCourseAdmin();
  const date = String(formData.get("date") ?? "");
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !HHMM.test(start) || !HHMM.test(end)) return;
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (e < s) return;

  const dow = fromDateKey(date).getUTCDay();
  const layouts = await prisma.layout.findMany({
    where: { courseId: course.id, isActive: true },
    include: { teeTimeSlots: true },
  });
  const times = new Set<string>();
  for (const l of layouts) {
    const t = l.teeTimeSlots.find((x) => x.dayOfWeek === dow && x.isActive);
    if (!t) continue;
    for (let m = timeToMinutes(t.startTime); m <= timeToMinutes(t.endTime); m += t.intervalMin) {
      if (m >= s && m <= e) times.add(minutesToTime(m));
    }
  }
  if (times.size === 0) return;

  const od = fromDateKey(date);
  await prisma.dailyOverride.deleteMany({
    where: { courseId: course.id, overrideDate: od, slotTime: { in: [...times] } },
  });
  await prisma.dailyOverride.createMany({
    data: [...times].map((slotTime) => ({
      courseId: course.id, overrideDate: od, slotTime, isClosed: true, reason,
    })),
  });
  await revalidate(course.slug);
}

export async function deleteOverride(formData: FormData): Promise<void> {
  const { course } = await requireCourseAdmin();
  const id = String(formData.get("id") ?? "");
  const ov = await prisma.dailyOverride.findFirst({ where: { id, courseId: course.id } });
  if (!ov) return;
  await prisma.dailyOverride.delete({ where: { id } });
  await revalidate(course.slug);
}
