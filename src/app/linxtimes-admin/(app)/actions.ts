"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/super-session";
import { prisma } from "@/lib/prisma";
import { serverEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { Prisma } from "@/generated/prisma";

export interface AdminActionResult {
  ok: boolean;
  message: string;
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "course";
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let n = 2;
  while (await prisma.course.findUnique({ where: { slug } })) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

/** Approve a pending request: create the course, issue an onboarding link, email it. */
export async function approveRequest(requestId: string): Promise<AdminActionResult> {
  const admin = await requireSuperAdmin();
  const req = await prisma.onboardingRequest.findUnique({ where: { id: requestId } });
  if (!req) return { ok: false, message: "Request not found." };
  if (req.courseId) return { ok: false, message: "Already approved." };

  const slug = await uniqueSlug(slugify(req.courseName));
  const course = await prisma.course.create({
    data: {
      slug,
      name: req.courseName,
      email: req.email,
      city: req.city,
      state: req.state,
      phone: req.phone,
      status: "approved",
      linxtimesFee: 100,
    },
  });

  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const token = await prisma.onboardingToken.create({
    data: { courseId: course.id, email: req.email, expiresAt },
  });

  await prisma.onboardingRequest.update({
    where: { id: requestId },
    data: { status: "approved", courseId: course.id, reviewedAt: new Date(), reviewedBy: admin.id },
  });

  const link = `${serverEnv.APP_URL}/onboard?token=${token.token}`;
  await sendEmail({
    to: req.email,
    subject: `You're approved — set up ${req.courseName} on LinxTimes`,
    html: `<p>Hi ${escape(req.ownerName)},</p>
      <p><b>${escape(req.courseName)}</b> has been approved on LinxTimes. Click below to set up your
      account and booking page:</p>
      <p><a href="${link}" style="display:inline-block;background:#0d3522;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600;">Set up your course</a></p>
      <p>This link expires in 14 days.</p>`,
  });

  revalidatePath("/linxtimes-admin/requests");
  revalidatePath("/linxtimes-admin/courses");
  return { ok: true, message: `Approved — onboarding link emailed to ${req.email}.` };
}

export async function declineRequest(formData: FormData): Promise<AdminActionResult> {
  await requireSuperAdmin();
  const id = String(formData.get("requestId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "Not a fit at this time.";
  const req = await prisma.onboardingRequest.findUnique({ where: { id } });
  if (!req || req.courseId) return { ok: false, message: "Cannot decline." };
  await prisma.onboardingRequest.update({
    where: { id },
    data: { declineReason: reason, reviewedAt: new Date() },
  });
  revalidatePath("/linxtimes-admin/requests");
  return { ok: true, message: "Request declined." };
}

/** Path A: pre-create an approved course so the owner can onboard by email. */
export async function whitelistCourse(formData: FormData): Promise<AdminActionResult> {
  await requireSuperAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const slugInput = String(formData.get("slug") ?? "").trim();
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, message: "Name and a valid email are required." };
  }
  const slug = await uniqueSlug(slugInput ? slugify(slugInput) : slugify(name));
  try {
    await prisma.course.create({
      data: { slug, name, email, status: "approved", linxtimesFee: 100 },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, message: "A course with that slug or email already exists." };
    }
    throw e;
  }
  revalidatePath("/linxtimes-admin/courses");
  return { ok: true, message: `Whitelisted ${name}. They can now onboard at /onboard with ${email}.` };
}

/** Edit a course's platform-controlled fields: online + in-person fee, status. */
export async function updateCourse(formData: FormData): Promise<AdminActionResult> {
  await requireSuperAdmin();
  const id = String(formData.get("courseId") ?? "");
  const status = String(formData.get("status") ?? "");
  const valid = ["pending", "approved", "active", "suspended"];
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) return { ok: false, message: "Course not found." };

  // Fees are entered in dollars; store as integer cents.
  const feeCents = (v: FormDataEntryValue | null, fallback: number) => {
    const n = Number(String(v ?? "").trim());
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : fallback;
  };

  // Tax rate is entered as a percentage; store as integer basis points.
  const taxBps = (v: FormDataEntryValue | null, fallback: number) => {
    const n = Number(String(v ?? "").trim());
    return Number.isFinite(n) && n >= 0 && n <= 30 ? Math.round(n * 100) : fallback;
  };

  await prisma.course.update({
    where: { id },
    data: {
      linxtimesFee: feeCents(formData.get("fee"), course.linxtimesFee),
      linxtimesInPersonFee: feeCents(formData.get("inPersonFee"), course.linxtimesInPersonFee),
      taxRateBps: taxBps(formData.get("taxRate"), course.taxRateBps),
      status: valid.includes(status) ? (status as typeof course.status) : course.status,
    },
  });
  revalidatePath("/linxtimes-admin/courses");
  revalidatePath(`/${course.slug}`);
  return { ok: true, message: "Course updated." };
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
