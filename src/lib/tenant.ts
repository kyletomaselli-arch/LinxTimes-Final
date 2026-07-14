import { notFound } from "next/navigation";
import { prisma } from "./prisma";
import type { Course } from "../generated/prisma";

/**
 * Reserved top-level path segments that are NOT course slugs.
 * Any request to /[course-slug] whose slug is in this list must never be
 * treated as a tenant booking page.
 */
export const RESERVED_SLUGS = new Set<string>([
  "api",
  "onboard",
  "request",
  "dashboard",
  "linxtimes-admin",
  "login",
  "logout",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "globe",
  "about",
  "pricing",
  "contact",
  "terms",
  "privacy",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/**
 * Look up a course by its public slug. Returns null if not found or if the
 * slug is reserved. Does NOT enforce status — callers decide what statuses
 * are acceptable in their context.
 */
export async function getCourseBySlug(slug: string): Promise<Course | null> {
  if (!slug || isReservedSlug(slug)) return null;
  return prisma.course.findUnique({ where: { slug: slug.toLowerCase() } });
}

/**
 * Resolve a tenant for the PUBLIC booking page. Only "active" courses are
 * bookable. Suspended/pending/approved courses 404 on their public page so
 * one course can never expose another's data and disabled courses go dark.
 *
 * Throws Next.js notFound() (which renders the 404 page) when the course is
 * absent or not active.
 */
export async function requireActiveCourse(slug: string): Promise<Course> {
  const course = await getCourseBySlug(slug);
  if (!course || course.status !== "active") {
    notFound();
  }
  return course;
}

/**
 * Resolve a tenant for an API route. Returns a discriminated result instead of
 * throwing so route handlers can return the right HTTP status.
 */
export async function resolveTenant(
  slug: string
): Promise<
  | { ok: true; course: Course }
  | { ok: false; status: 404 | 403; reason: string }
> {
  const course = await getCourseBySlug(slug);
  if (!course) {
    return { ok: false, status: 404, reason: "Course not found" };
  }
  if (course.status === "suspended") {
    return { ok: false, status: 403, reason: "Course is suspended" };
  }
  if (course.status !== "active") {
    return { ok: false, status: 404, reason: "Course not available" };
  }
  return { ok: true, course };
}
