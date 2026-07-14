import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { computePricing } from "@/lib/pricing";
import { resolveMembers } from "@/lib/members";
import { resolvePromo } from "@/lib/promo";
import { resolveRainCheck } from "@/lib/raincheck";
import { rateLimit } from "@/lib/rate-limit";
import { quoteSchema } from "@/lib/validation";

/**
 * POST /api/courses/[slug]/quote
 * Body: { layoutId, date, slotTime, numPlayers, holes, withCart, memberId? }
 *
 * Returns an authoritative price breakdown computed server-side. The client
 * uses this to show the live pricing summary; the booking endpoint will
 * recompute identically so the displayed price can be trusted and the client
 * can never dictate the amount charged.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/courses/[slug]/quote">
) {
  const limited = rateLimit(request, "quote", 60, 60_000);
  if (limited) return limited;

  const { slug } = await ctx.params;
  const tenant = await resolveTenant(slug);
  if (!tenant.ok) {
    return NextResponse.json({ error: tenant.reason }, { status: tenant.status });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = quoteSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
  }
  const { layoutId, date, slotTime, numPlayers, holes, withCart, memberId, memberIds } =
    parsed.data;

  const layout = await prisma.layout.findFirst({
    where: { id: layoutId, courseId: tenant.course.id, isActive: true },
    include: { pricing: true },
  });
  if (!layout || !layout.pricing) {
    return NextResponse.json({ error: "Layout not configured" }, { status: 404 });
  }

  const codes = [...memberIds, ...(memberId ? [memberId] : [])];
  const [members, promoRes, creditRes] = await Promise.all([
    resolveMembers(tenant.course.id, codes),
    resolvePromo(tenant.course.id, codes),
    resolveRainCheck(tenant.course.id, codes),
  ]);
  const validCodes = new Set(members.map((m) => m.memberId.toLowerCase()));

  const breakdown = computePricing({
    course: tenant.course,
    pricing: layout.pricing,
    dateKey: date,
    slotTime,
    numPlayers,
    holes,
    withCart,
    members,
    promo: promoRes?.promo ?? null,
    credit: creditRes ? { code: creditRes.code, amountCents: creditRes.amountCents } : null,
  });

  // Mark the promo code valid for the UI when it actually produced a discount.
  if (promoRes && breakdown.discountCents > 0) validCodes.add(promoRes.promo.code.toLowerCase());
  if (creditRes && breakdown.creditCents > 0) validCodes.add(creditRes.code.toLowerCase());

  return NextResponse.json({
    ...breakdown,
    memberValid: members.length > 0,
    validMemberCount: members.length,
    // Which of the submitted codes matched an active member or a valid promo.
    validCodes: [...validCodes],
    cartAvailable: layout.pricing.cartAvailable,
  });
}
