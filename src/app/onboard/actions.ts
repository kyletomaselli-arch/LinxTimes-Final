"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createCourseSession } from "@/lib/session";
import type { Course } from "@/generated/prisma";

export interface OnboardLookup {
  ok: boolean;
  courseName?: string;
  email?: string;
  message?: string;
}

/**
 * Resolve the course an onboarding attempt is eligible to claim, verified
 * entirely server-side. Eligible = approved + not yet claimed (no admin).
 *  - token path: a valid, unused, unexpired OnboardingToken (from an approval
 *    email link).
 *  - email path (whitelist): a course pre-created with status "approved" whose
 *    email matches.
 * Never trusts a courseId from the client.
 */
async function resolveEligibleCourse(
  email: string,
  token: string
): Promise<{ course: Course; tokenId: string | null } | null> {
  if (token) {
    const t = await prisma.onboardingToken.findUnique({ where: { token } });
    if (!t || t.usedAt || t.expiresAt < new Date()) return null;
    const course = await prisma.course.findUnique({ where: { id: t.courseId } });
    if (!course) return null;
    const admins = await prisma.courseAdmin.count({ where: { courseId: course.id } });
    if (admins > 0) return null;
    return { course, tokenId: t.id };
  }

  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const course = await prisma.course.findFirst({
    where: { email: normalized, status: "approved" },
  });
  if (!course) return null;
  const admins = await prisma.courseAdmin.count({ where: { courseId: course.id } });
  if (admins > 0) return null;
  return { course, tokenId: null };
}

export async function lookupOnboarding(email: string, token: string): Promise<OnboardLookup> {
  const eligible = await resolveEligibleCourse(email, token);
  if (!eligible) {
    return {
      ok: false,
      message:
        "We couldn't find an approved course for that. Check your email or request access first.",
    };
  }
  return { ok: true, courseName: eligible.course.name, email: eligible.course.email ?? email };
}

export async function finishOnboarding(formData: FormData): Promise<OnboardLookup> {
  const email = String(formData.get("email") ?? "");
  const token = String(formData.get("token") ?? "");
  const adminName = String(formData.get("adminName") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!adminName) return { ok: false, message: "Enter your name." };
  if (password.length < 8) return { ok: false, message: "Password must be at least 8 characters." };

  const eligible = await resolveEligibleCourse(email, token);
  if (!eligible) return { ok: false, message: "This course is not available to set up." };

  const { course, tokenId } = eligible;
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.courseAdmin.create({
    data: {
      courseId: course.id,
      email: (course.email ?? email).toLowerCase(),
      passwordHash,
      name: adminName,
    },
  });
  await prisma.course.update({ where: { id: course.id }, data: { onboardedAt: new Date() } });
  if (tokenId) {
    await prisma.onboardingToken.update({ where: { id: tokenId }, data: { usedAt: new Date() } });
  }

  await createCourseSession(admin.id, course.id);
  redirect("/dashboard?welcome=1");
}
