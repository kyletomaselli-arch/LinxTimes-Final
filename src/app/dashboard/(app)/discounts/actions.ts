"use server";

import { revalidatePath } from "next/cache";
import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Prisma, type DiscountKind } from "@/generated/prisma";
import { generateRainCheckCode } from "@/lib/raincheck";

export interface DiscountResult {
  ok: boolean;
  message: string;
}

/** Create a promo/discount code for the course. */
export async function createPromo(_prev: DiscountResult, formData: FormData): Promise<DiscountResult> {
  const { course } = await requireCourseAdmin();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const kind: DiscountKind = String(formData.get("kind")) === "amount" ? "amount" : "percent";
  const rawValue = Number(String(formData.get("value") ?? "").trim());
  const expiresRaw = String(formData.get("expiresAt") ?? "").trim();
  const maxRaw = String(formData.get("maxRedemptions") ?? "").trim();

  if (!/^[A-Z0-9_-]{2,40}$/.test(code)) {
    return { ok: false, message: "Code must be 2–40 letters/numbers (no spaces)." };
  }
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return { ok: false, message: "Enter a discount amount greater than 0." };
  }
  // percent stored as 1–100; amount stored as cents.
  const value = kind === "percent" ? Math.min(100, Math.round(rawValue)) : Math.round(rawValue * 100);
  const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(expiresRaw) ? new Date(`${expiresRaw}T23:59:59.000Z`) : null;
  const maxRedemptions = maxRaw && Number.isFinite(Number(maxRaw)) && Number(maxRaw) > 0 ? Math.round(Number(maxRaw)) : null;

  try {
    await prisma.promoCode.create({
      data: { courseId: course.id, code, kind, value, expiresAt, maxRedemptions },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, message: "That code already exists." };
    }
    throw e;
  }
  revalidatePath("/dashboard/discounts");
  return { ok: true, message: `Created ${code}.` };
}

/** Activate/deactivate a code. */
export async function togglePromo(formData: FormData): Promise<void> {
  const { course } = await requireCourseAdmin();
  const id = String(formData.get("id") ?? "");
  const p = await prisma.promoCode.findFirst({ where: { id, courseId: course.id } });
  if (!p) return;
  await prisma.promoCode.update({ where: { id }, data: { isActive: !p.isActive } });
  revalidatePath("/dashboard/discounts");
}

/** Delete a code. */
export async function deletePromo(formData: FormData): Promise<void> {
  const { course } = await requireCourseAdmin();
  const id = String(formData.get("id") ?? "");
  const p = await prisma.promoCode.findFirst({ where: { id, courseId: course.id } });
  if (!p) return;
  await prisma.promoCode.delete({ where: { id } });
  revalidatePath("/dashboard/discounts");
}

/** Issue a rain-check credit; returns the generated code in the message. */
export async function issueRainCheck(_prev: DiscountResult, formData: FormData): Promise<DiscountResult> {
  const { admin, course } = await requireCourseAdmin();
  const dollars = Number(String(formData.get("amount") ?? "").trim());
  const note = String(formData.get("note") ?? "").trim() || null;
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!Number.isFinite(dollars) || dollars <= 0) {
    return { ok: false, message: "Enter a credit amount greater than 0." };
  }
  const amountCents = Math.round(dollars * 100);

  // Generate a unique code (retry on the rare collision).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRainCheckCode();
    try {
      await prisma.rainCheck.create({
        data: { courseId: course.id, code, amountCents, note, reason, createdBy: admin.id },
      });
      revalidatePath("/dashboard/discounts");
      return { ok: true, message: `Issued rain check ${code} for $${dollars.toFixed(2)} — give this code to the golfer.` };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  return { ok: false, message: "Could not generate a code, please retry." };
}

/** Void an unredeemed rain check. */
export async function voidRainCheck(formData: FormData): Promise<void> {
  const { course } = await requireCourseAdmin();
  const id = String(formData.get("id") ?? "");
  const rc = await prisma.rainCheck.findFirst({ where: { id, courseId: course.id } });
  if (!rc || rc.redeemedAt) return;
  await prisma.rainCheck.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/dashboard/discounts");
}
