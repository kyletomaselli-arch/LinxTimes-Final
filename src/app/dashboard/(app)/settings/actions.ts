"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Prisma, type CourseRole } from "@/generated/prisma";

export interface SettingsResult {
  ok: boolean;
  message: string;
}

const ROLES: CourseRole[] = ["owner", "manager", "staff"];
const parseRole = (v: FormDataEntryValue | null): CourseRole =>
  ROLES.includes(String(v) as CourseRole) ? (String(v) as CourseRole) : "staff";

/**
 * Register a Stripe Terminal reader to this course (owner-only). The staff read
 * the 3-word registration code off the reader screen and enter it here. Needs
 * the course's Stripe account connected.
 */
export async function registerReader(_prev: SettingsResult, formData: FormData): Promise<SettingsResult> {
  const { admin, course } = await requireCourseAdmin();
  if (admin.role !== "owner") return { ok: false, message: "Only owners can set up the card reader." };
  if (!course.stripeAccountId || !course.stripeOnboarded) return { ok: false, message: "Connect the course's Stripe account first." };
  const code = String(formData.get("code") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim() || "Pro shop reader";
  if (!code) return { ok: false, message: "Enter the reader's registration code." };
  try {
    const { getStripe } = await import("@/lib/stripe");
    const stripe = getStripe();
    const opts = { stripeAccount: course.stripeAccountId } as const;

    // Every Terminal reader must belong to a Terminal Location. Reuse the
    // course's existing location if it has one, otherwise create it from the
    // course address so the pro shop never has to think about this.
    const locations = await stripe.terminal.locations.list({ limit: 1 }, opts);
    let locationId = locations.data[0]?.id;
    if (!locationId) {
      const location = await stripe.terminal.locations.create(
        {
          display_name: course.name,
          address: {
            line1: course.address ?? course.name,
            city: course.city ?? undefined,
            state: course.state ?? undefined,
            postal_code: course.zip ?? undefined,
            country: "US",
          },
        },
        opts
      );
      locationId = location.id;
    }

    const reader = await stripe.terminal.readers.create(
      { registration_code: code, label, location: locationId },
      opts
    );
    await prisma.course.update({ where: { id: course.id }, data: { stripeTerminalReaderId: reader.id } });
  } catch {
    return { ok: false, message: "Couldn't register that reader — check the code and that Stripe is set up." };
  }
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Card reader connected." };
}

/**
 * Re-check the course's Stripe account and sync `stripeOnboarded`. Needed because
 * a Standard account can finish verification on Stripe's side either just after
 * the OAuth redirect (so the callback saw charges_enabled=false) or minutes later
 * via a Connect `account.updated` event that arrives before we've stored the
 * account id. This gives the course a reliable button to pull the current state.
 */
export async function refreshStripeStatus(): Promise<SettingsResult> {
  const { course } = await requireCourseAdmin();
  if (!course.stripeAccountId) return { ok: false, message: "Connect a Stripe account first." };
  try {
    const { getStripe } = await import("@/lib/stripe");
    const account = await getStripe().accounts.retrieve(course.stripeAccountId);
    const onboarded = Boolean(account.charges_enabled && account.payouts_enabled);
    await prisma.course.update({ where: { id: course.id }, data: { stripeOnboarded: onboarded } });
    revalidatePath("/dashboard/settings");
    return onboarded
      ? { ok: true, message: "Stripe is verified — you can now accept online payments." }
      : { ok: false, message: "Stripe is still finishing verification. Check back in a minute." };
  } catch {
    return { ok: false, message: "Couldn't reach Stripe — try again in a moment." };
  }
}

/** Add a team member login (owner-only). Managers/owners see revenue; staff don't. */
export async function inviteAdmin(_prev: SettingsResult, formData: FormData): Promise<SettingsResult> {
  const { admin, course } = await requireCourseAdmin();
  if (admin.role !== "owner") return { ok: false, message: "Only owners can add team members." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = parseRole(formData.get("role"));
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, message: "Enter a name and valid email." };
  if (password.length < 8) return { ok: false, message: "Password must be at least 8 characters." };

  try {
    await prisma.courseAdmin.create({
      data: { courseId: course.id, name, email, role, passwordHash: await bcrypt.hash(password, 12) },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, message: "That email is already in use." };
    throw e;
  }
  revalidatePath("/dashboard/settings");
  return { ok: true, message: `Added ${name} as ${role}.` };
}

/** Change a team member's role (owner-only; can't demote the last owner). */
export async function setAdminRole(formData: FormData): Promise<SettingsResult> {
  const { admin, course } = await requireCourseAdmin();
  if (admin.role !== "owner") return { ok: false, message: "Only owners can change roles." };
  const id = String(formData.get("id") ?? "");
  const role = parseRole(formData.get("role"));
  const target = await prisma.courseAdmin.findFirst({ where: { id, courseId: course.id } });
  if (!target) return { ok: false, message: "Not found." };
  if (target.role === "owner" && role !== "owner") {
    const owners = await prisma.courseAdmin.count({ where: { courseId: course.id, role: "owner" } });
    if (owners <= 1) return { ok: false, message: "There must be at least one owner." };
  }
  await prisma.courseAdmin.update({ where: { id }, data: { role } });
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Role updated." };
}

/** Remove a team member (owner-only; can't remove yourself or the last owner). */
export async function removeAdmin(formData: FormData): Promise<SettingsResult> {
  const { admin, course } = await requireCourseAdmin();
  if (admin.role !== "owner") return { ok: false, message: "Only owners can remove team members." };
  const id = String(formData.get("id") ?? "");
  if (id === admin.id) return { ok: false, message: "You can't remove yourself." };
  const target = await prisma.courseAdmin.findFirst({ where: { id, courseId: course.id } });
  if (!target) return { ok: false, message: "Not found." };
  if (target.role === "owner") {
    const owners = await prisma.courseAdmin.count({ where: { courseId: course.id, role: "owner" } });
    if (owners <= 1) return { ok: false, message: "There must be at least one owner." };
  }
  await prisma.courseAdmin.delete({ where: { id } });
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Team member removed." };
}

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const hex = (v: FormDataEntryValue | null, dflt: string) => {
  const s = String(v ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : dflt;
};

export async function updateProfile(_prev: SettingsResult, formData: FormData): Promise<SettingsResult> {
  const { course } = await requireCourseAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Course name is required." };

  await prisma.course.update({
    where: { id: course.id },
    data: {
      name,
      address: str(formData.get("address")),
      city: str(formData.get("city")),
      state: str(formData.get("state")),
      zip: str(formData.get("zip")),
      phone: str(formData.get("phone")),
      website: str(formData.get("website")),
      logoUrl: str(formData.get("logoUrl")),
      heroImageUrl: str(formData.get("heroImageUrl")),
      primaryColor: hex(formData.get("primaryColor"), "#0d3522"),
      secondaryColor: hex(formData.get("secondaryColor"), "#c9a84c"),
      notificationEmail: str(formData.get("notificationEmail")),
      timezone: String(formData.get("timezone") ?? "America/Chicago").trim() || "America/Chicago",
      announcement: (() => { const s = String(formData.get("announcement") ?? "").trim(); return s ? s.slice(0, 280) : null; })(),
    },
  });
  revalidatePath("/dashboard/settings");
  revalidatePath(`/${course.slug}`);
  return { ok: true, message: "Profile saved." };
}

export async function changePassword(_prev: SettingsResult, formData: FormData): Promise<SettingsResult> {
  const { admin } = await requireCourseAdmin();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (next.length < 8) return { ok: false, message: "New password must be at least 8 characters." };

  const valid = await bcrypt.compare(current, admin.passwordHash);
  if (!valid) return { ok: false, message: "Current password is incorrect." };

  const passwordHash = await bcrypt.hash(next, 12);
  await prisma.courseAdmin.update({ where: { id: admin.id }, data: { passwordHash } });
  return { ok: true, message: "Password updated." };
}
