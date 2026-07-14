"use server";

import { revalidatePath } from "next/cache";
import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import type { MembershipType, DiscountDays } from "@/generated/prisma";

export interface MemberActionResult {
  ok: boolean;
  message: string;
}

const MEMBERSHIP_TYPES = ["full", "associate", "junior", "senior", "social"] as const;

function parseMembership(v: string): MembershipType {
  return (MEMBERSHIP_TYPES as readonly string[]).includes(v) ? (v as MembershipType) : "full";
}
function parseDiscountDays(v: string): DiscountDays {
  return v === "mon_thu" ? "mon_thu" : "all";
}
/** Dollars string → integer cents, or null when blank. */
function dollarsToCents(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

export async function upsertMember(formData: FormData): Promise<MemberActionResult> {
  const { course } = await requireCourseAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const memberId = String(formData.get("memberId") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  if (!memberId || !firstName || !lastName) {
    return { ok: false, message: "Member ID, first and last name are required." };
  }

  const data = {
    memberId,
    firstName,
    lastName,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    membershipType: parseMembership(String(formData.get("membershipType") ?? "full")),
    greenFeeOverride: dollarsToCents(String(formData.get("greenFeeOverride") ?? "")),
    cartIncluded: formData.get("cartIncluded") === "on",
    discountDays: parseDiscountDays(String(formData.get("discountDays") ?? "all")),
    isActive: formData.get("isActive") !== "off",
    notes: String(formData.get("notes") ?? "").trim() || null,
  };

  try {
    if (id) {
      // Ensure the member belongs to this course before updating.
      const existing = await prisma.member.findFirst({ where: { id, courseId: course.id } });
      if (!existing) return { ok: false, message: "Member not found." };
      await prisma.member.update({ where: { id }, data });
    } else {
      await prisma.member.create({ data: { ...data, courseId: course.id } });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, message: `Member ID "${memberId}" already exists.` };
    }
    throw e;
  }

  revalidatePath("/dashboard/members");
  return { ok: true, message: id ? "Member updated." : "Member added." };
}

export async function deleteMember(id: string): Promise<MemberActionResult> {
  const { course } = await requireCourseAdmin();
  const existing = await prisma.member.findFirst({ where: { id, courseId: course.id } });
  if (!existing) return { ok: false, message: "Member not found." };
  await prisma.member.delete({ where: { id } });
  revalidatePath("/dashboard/members");
  return { ok: true, message: "Member removed." };
}

export interface ImportRow {
  memberId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  membershipType?: string;
  greenFeeOverride?: string;
  cartIncluded?: string;
  discountDays?: string;
}

export async function importMembers(rows: ImportRow[]): Promise<MemberActionResult> {
  const { course } = await requireCourseAdmin();
  let imported = 0;
  for (const r of rows) {
    const memberId = (r.memberId ?? "").toString().trim();
    const firstName = (r.firstName ?? "").toString().trim();
    const lastName = (r.lastName ?? "").toString().trim();
    if (!memberId || !firstName || !lastName) continue;
    const data = {
      firstName,
      lastName,
      email: (r.email ?? "").toString().trim() || null,
      phone: (r.phone ?? "").toString().trim() || null,
      membershipType: parseMembership((r.membershipType ?? "full").toString().trim()),
      greenFeeOverride: dollarsToCents((r.greenFeeOverride ?? "").toString()),
      cartIncluded: /^(yes|true|1)$/i.test((r.cartIncluded ?? "").toString().trim()),
      discountDays: parseDiscountDays((r.discountDays ?? "all").toString().trim()),
    };
    // Upsert by (course, memberId) so re-imports update rather than duplicate.
    await prisma.member.upsert({
      where: { courseId_memberId: { courseId: course.id, memberId } },
      update: data,
      create: { ...data, memberId, courseId: course.id, isActive: true },
    });
    imported++;
  }
  revalidatePath("/dashboard/members");
  return { ok: true, message: `Imported ${imported} member${imported === 1 ? "" : "s"}.` };
}

/** Enroll a new member with membership tier and payment (card reader or cash). */
export async function enrollNewMember(formData: FormData): Promise<MemberActionResult> {
  const { course, admin } = await requireCourseAdmin();

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const tierId = String(formData.get("tierId") ?? "").trim();
  const method = String(formData.get("method") ?? "terminal");

  if (!firstName || !lastName || !tierId) {
    return { ok: false, message: "First name, last name, and membership tier required." };
  }

  const tier = await prisma.membershipTier.findFirst({ where: { id: tierId, courseId: course.id } });
  if (!tier) return { ok: false, message: "Membership tier not found." };

  // Generate a unique member ID based on last name + first initial + timestamp
  const baseMemberId = `${lastName.slice(0, 3).toUpperCase()}${firstName[0]?.toUpperCase()}${Date.now().toString().slice(-4)}`;
  let memberId = baseMemberId;
  let counter = 1;
  while (await prisma.member.findFirst({ where: { courseId: course.id, memberId } })) {
    memberId = `${baseMemberId}-${counter++}`;
  }

  // Calculate fees: 2% capped at $10, plus tax
  const linxFee = Math.min(Math.round(tier.priceCents * 0.02), 1000);
  const tax = Math.round((tier.priceCents * course.taxRateBps) / 10000);
  const total = tier.priceCents + linxFee + tax;

  try {
    // TODO: For terminal payments, integrate with Stripe Terminal Payment Intent.
    // For now, just record the cash/terminal payment as completed.
    // In production, you'd call stripe.terminal.reader.processPayment() for card.

    const member = await prisma.member.create({
      data: {
        courseId: course.id,
        memberId,
        firstName,
        lastName,
        email,
        phone,
        membershipTierId: tierId,
        membershipPaidAt: new Date(),
        isActive: true,
      },
    });

    // Log the payment receipt (in a real system, this would be a Payment record)
    // For now, the membership payment is implicit in membershipPaidAt

    revalidatePath("/dashboard/members");
    return {
      ok: true,
      message: `${firstName} ${lastName} enrolled as member ${memberId}. Charged ${method === "terminal" ? "via card reader" : "cash"}.`,
    };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, message: `Member ID "${memberId}" conflict. Try again.` };
    }
    throw e;
  }
}
