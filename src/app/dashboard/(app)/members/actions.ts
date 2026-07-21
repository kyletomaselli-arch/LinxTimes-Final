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

/** Start membership enrollment and initiate payment. Returns paymentId to poll. */
export async function enrollNewMember(formData: FormData): Promise<MemberActionResult & { paymentId?: string }> {
  const { course, admin } = await requireCourseAdmin();

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const tierId = String(formData.get("tierId") ?? "").trim();
  const method = String(formData.get("method") ?? "terminal") as "terminal" | "cash";

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
  const taxesAndFees = linxFee + Math.round((tier.priceCents * course.taxRateBps) / 10000);
  const totalCents = tier.priceCents + taxesAndFees;

  try {
    if (method === "cash") {
      // Cash payment: create member immediately
      await prisma.member.create({
        data: {
          courseId: course.id, memberId, firstName, lastName, email, phone,
          membershipTierId: tierId, membershipPaidAt: new Date(), isActive: true,
        },
      });
      // Log cash payment
      await prisma.payment.create({
        data: {
          courseId: course.id, method: "cash", state: "succeeded",
          amountCents: tier.priceCents, feeCents: 0, taxCents: taxesAndFees - linxFee,
          description: `Membership ${memberId} - ${tier.name}`,
          createdBy: admin.id,
        },
      });
      revalidatePath("/dashboard/members");
      return { ok: true, message: `${firstName} ${lastName} enrolled as member ${memberId}. Cash payment recorded.` };
    }

    // Terminal payment: start payment intent, create member placeholder
    if (!course.stripeAccountId || !course.stripeOnboarded) {
      return { ok: false, message: "Connect the course's Stripe account first (Settings → Payments)." };
    }
    if (!course.stripeTerminalReaderId) {
      return { ok: false, message: "Register a card reader first (Settings → Payments)." };
    }

    // Double-submit guard: one enrollment charge on the reader at a time.
    const inFlight = await prisma.payment.findFirst({
      where: {
        courseId: course.id, method: "terminal", state: "pending", bookingId: null,
        description: { startsWith: "Membership " },
        createdAt: { gt: new Date(Date.now() - 2 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (inFlight) {
      return { ok: false, message: "A membership payment is already in progress on the reader — finish or cancel it first." };
    }

    const { getStripe } = await import("@/lib/stripe");
    const stripe = getStripe();

    // Create payment record in pending state
    const payment = await prisma.payment.create({
      data: {
        courseId: course.id,
        method: "terminal",
        state: "pending",
        amountCents: tier.priceCents,
        feeCents: linxFee,
        taxCents: taxesAndFees - linxFee,
        description: `Membership ${memberId} - ${tier.name}`,
        createdBy: admin.id,
        metadata: { kind: "membership", firstName, lastName, email: email || "", phone: phone || "", tierId, memberId, courseId: course.id },
      },
    });

    try {
      // Create PaymentIntent
      const intent = await stripe.paymentIntents.create(
        {
          amount: totalCents,
          currency: "usd",
          payment_method_types: ["card_present"],
          capture_method: "automatic",
          application_fee_amount: linxFee,
          description: `Membership ${memberId} - ${tier.name}`,
          receipt_email: email || undefined,
          metadata: { kind: "membership", paymentId: payment.id, courseId: course.id },
        },
        { stripeAccount: course.stripeAccountId }
      );
      await prisma.payment.update({ where: { id: payment.id }, data: { stripePaymentIntentId: intent.id } });

      // Push to reader
      await stripe.terminal.readers.processPaymentIntent(
        course.stripeTerminalReaderId,
        { payment_intent: intent.id },
        { stripeAccount: course.stripeAccountId }
      );

      revalidatePath("/dashboard/members");
      return { ok: true, message: "Processing payment on terminal...", paymentId: payment.id };
    } catch (e) {
      // Don't leave a stuck pending row blocking the next enrollment.
      await prisma.payment.update({ where: { id: payment.id }, data: { state: "failed" } });
      throw e;
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, message: `Member ID "${memberId}" conflict. Try again.` };
    }
    console.error("Enrollment error:", e);
    return { ok: false, message: "Payment processing failed. Check reader is online." };
  }
}

/** Check membership payment status by payment ID. */
export async function checkMembershipPaymentStatus(
  paymentId: string
): Promise<{ status: "pending" | "succeeded" | "failed"; message?: string }> {
  const { course } = await requireCourseAdmin();
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, courseId: course.id },
  });

  if (!payment) return { status: "failed", message: "Payment not found" };

  if (payment.state === "succeeded") {
    return { status: "succeeded", message: "Payment successful" };
  }
  if (payment.state === "failed") {
    return { status: "failed", message: "Payment failed" };
  }
  return { status: "pending", message: "Waiting for payment..." };
}

/** Renew an existing member's membership and charge them. */
export async function renewMembership(memberId: string): Promise<MemberActionResult & { paymentId?: string }> {
  const { course, admin } = await requireCourseAdmin();

  const member = await prisma.member.findFirst({
    where: { id: memberId, courseId: course.id },
    include: { membershipTier: true },
  });
  if (!member) return { ok: false, message: "Member not found." };
  if (!member.membershipTier) return { ok: false, message: "Member has no membership tier." };

  const tier = member.membershipTier;

  // Calculate fees: 2% capped at $10, plus tax
  const linxFee = Math.min(Math.round(tier.priceCents * 0.02), 1000);
  const taxesAndFees = linxFee + Math.round((tier.priceCents * course.taxRateBps) / 10000);
  const totalCents = tier.priceCents + taxesAndFees;

  try {
    if (!course.stripeAccountId || !course.stripeOnboarded) {
      return { ok: false, message: "Connect the course's Stripe account first (Settings → Payments)." };
    }
    if (!course.stripeTerminalReaderId) {
      return { ok: false, message: "Register a card reader first (Settings → Payments)." };
    }

    // Double-submit guard: one renewal charge on the reader at a time.
    const inFlight = await prisma.payment.findFirst({
      where: {
        courseId: course.id,
        method: "terminal",
        state: "pending",
        bookingId: null,
        description: { startsWith: `Renewal ${member.memberId}` },
        createdAt: { gt: new Date(Date.now() - 2 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (inFlight) {
      return { ok: false, message: "A renewal payment is already in progress on the reader — finish or cancel it first." };
    }

    const { getStripe } = await import("@/lib/stripe");
    const stripe = getStripe();

    // Create payment record in pending state
    const payment = await prisma.payment.create({
      data: {
        courseId: course.id,
        method: "terminal",
        state: "pending",
        amountCents: tier.priceCents,
        feeCents: linxFee,
        taxCents: taxesAndFees - linxFee,
        description: `Renewal ${member.memberId} - ${tier.name}`,
        createdBy: admin.id,
        metadata: {
          kind: "renewal",
          memberId: member.id,
          tierId: tier.id,
          courseId: course.id,
          firstName: member.firstName,
          lastName: member.lastName,
        },
      },
    });

    try {
      // Create PaymentIntent
      const intent = await stripe.paymentIntents.create(
        {
          amount: totalCents,
          currency: "usd",
          payment_method_types: ["card_present"],
          capture_method: "automatic",
          application_fee_amount: linxFee,
          description: `Renewal ${member.memberId} - ${tier.name}`,
          receipt_email: member.email || undefined,
          metadata: { kind: "renewal", paymentId: payment.id, courseId: course.id },
        },
        { stripeAccount: course.stripeAccountId }
      );
      await prisma.payment.update({ where: { id: payment.id }, data: { stripePaymentIntentId: intent.id } });

      // Push to reader
      await stripe.terminal.readers.processPaymentIntent(
        course.stripeTerminalReaderId,
        { payment_intent: intent.id },
        { stripeAccount: course.stripeAccountId }
      );

      revalidatePath("/dashboard/members");
      return { ok: true, message: "Processing renewal payment on terminal...", paymentId: payment.id };
    } catch (e) {
      // Don't leave a stuck pending row blocking the next renewal.
      await prisma.payment.update({ where: { id: payment.id }, data: { state: "failed" } });
      throw e;
    }
  } catch (e) {
    console.error("Renewal error:", e);
    return { ok: false, message: "Payment processing failed. Check reader is online." };
  }
}
