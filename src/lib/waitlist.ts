import "server-only";
import { prisma } from "./prisma";
import { serverEnv } from "./env";
import { sendEmail } from "./email";
import { waitlistSpotEmail } from "./email-templates";
import { toDateKey, fromDateKey } from "./datetime";
import type { Course } from "../generated/prisma";

export interface WaitlistInput {
  layoutId: string;
  date: string;
  slotTime: string;
  numPlayers: number;
  name: string;
  email: string;
  phone?: string;
}

/**
 * Clean up waitlist entries for tee times that have already passed. Called lazily
 * from computeAvailability so old entries are purged as staff use the system.
 */
export async function cleanupExpiredWaitlistEntries(courseId: string, courseTimezone: string): Promise<void> {
  const { todayKeyInTz } = await import("./datetime");
  const today = todayKeyInTz(courseTimezone);
  const { fromDateKey } = await import("./datetime");
  const cutoffDate = fromDateKey(today);

  await prisma.waitlist.deleteMany({
    where: {
      courseId,
      bookingDate: { lt: cutoffDate },
    },
  });
}

/** Add a golfer to the waitlist for a specific (full) tee time. Idempotent per email+slot. */
export async function joinWaitlist(
  course: Course,
  input: WaitlistInput
): Promise<{ ok: true } | { ok: false; status: 404 | 409; reason: string }> {
  const layout = await prisma.layout.findFirst({
    where: { id: input.layoutId, courseId: course.id, isActive: true },
    select: { id: true },
  });
  if (!layout) return { ok: false, status: 404, reason: "Layout not found" };

  const bookingDate = fromDateKey(input.date);
  const existing = await prisma.waitlist.findFirst({
    where: {
      courseId: course.id, layoutId: layout.id, bookingDate, slotTime: input.slotTime,
      email: input.email, notifiedAt: null,
    },
    select: { id: true },
  });
  if (existing) return { ok: false, status: 409, reason: "You're already on the waitlist for this time." };

  await prisma.waitlist.create({
    data: {
      courseId: course.id, layoutId: layout.id, bookingDate, slotTime: input.slotTime,
      name: input.name, email: input.email, phone: input.phone || null, numPlayers: input.numPlayers,
    },
  });
  return { ok: true };
}

/**
 * A spot may have freed up for this tee time (e.g. after a cancellation): email
 * everyone waiting who hasn't been notified yet, then mark them notified. Never
 * throws — a failed notification must not fail the cancellation.
 */
export async function notifyWaitlistForSlot(
  courseId: string,
  layoutId: string,
  bookingDate: Date,
  slotTime: string
): Promise<void> {
  try {
    const waiting = await prisma.waitlist.findMany({
      where: { courseId, layoutId, bookingDate, slotTime, notifiedAt: null },
    });
    if (waiting.length === 0) return;

    const [course, layout] = await Promise.all([
      prisma.course.findUnique({ where: { id: courseId } }),
      prisma.layout.findUnique({ where: { id: layoutId } }),
    ]);
    if (!course || !layout) return;

    const dateKey = toDateKey(bookingDate);
    const bookUrl = `${serverEnv.APP_URL}/${course.slug}`;
    for (const w of waiting) {
      const email = waitlistSpotEmail({
        courseName: course.name,
        primaryColor: course.primaryColor || "#0d3522",
        layoutName: layout.name,
        dateKey,
        slotTime,
        name: w.name,
        bookUrl,
      });
      await sendEmail({ to: w.email, subject: email.subject, html: email.html });
    }
    await prisma.waitlist.updateMany({
      where: { id: { in: waiting.map((w) => w.id) } },
      data: { notifiedAt: new Date() },
    });
  } catch (err) {
    console.error("[waitlist] notify failed", err);
  }
}
