import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { signToken, verifyToken } from "./signing";
import type { Course, CourseAdmin } from "../generated/prisma";

/**
 * Course-admin sessions. The cookie holds an HMAC-signed token (see signing.ts)
 * carrying the admin + course ids. Cookie is HttpOnly + SameSite=Lax + Secure
 * (in production), 8-hour lifetime per spec. Kept separate from LinxTimes
 * super-admin sessions (different cookie name + token kind).
 */

const COOKIE = "lx_course_session";
const TTL_SECONDS = 8 * 60 * 60; // 8 hours

export async function createCourseSession(adminId: string, courseId: string): Promise<void> {
  const token = signToken({ adminId, courseId, kind: "course_admin" }, TTL_SECONDS);
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function destroyCourseSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getCourseSession(): Promise<{ adminId: string; courseId: string } | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const payload = verifyToken<{ adminId?: string; courseId?: string; kind?: string }>(token);
  if (!payload || payload.kind !== "course_admin" || !payload.adminId || !payload.courseId) {
    return null;
  }
  return { adminId: payload.adminId, courseId: payload.courseId };
}

/**
 * Resolve the signed-in course admin + their course, or redirect to login.
 * Re-checks the DB every request so a disabled admin loses access immediately.
 */
export async function requireCourseAdmin(): Promise<{ admin: CourseAdmin; course: Course }> {
  const session = await getCourseSession();
  if (!session) redirect("/dashboard/login");

  const admin = await prisma.courseAdmin.findUnique({ where: { id: session.adminId } });
  if (!admin || admin.courseId !== session.courseId) redirect("/dashboard/login");

  const course = await prisma.course.findUnique({ where: { id: session.courseId } });
  if (!course) redirect("/dashboard/login");

  return { admin, course };
}
