import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { memberIdSchema } from "@/lib/validation";

/**
 * GET /api/courses/[slug]/member/[memberId]
 *
 * Non-sensitive member validation for real-time pricing on the booking page.
 * Returns ONLY what the pricing engine needs plus a first-name initial for a
 * friendly "Welcome back" — never the member's contact details.
 *
 * This endpoint can be probed to test member IDs, so it is rate limited and
 * deliberately leaks no PII (no name, email, or phone) beyond a single initial.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/courses/[slug]/member/[memberId]">
) {
  // Tighter limit — this is the enumeration-sensitive endpoint.
  const limited = rateLimit(request, "member", 30, 60_000);
  if (limited) return limited;

  const { slug, memberId } = await ctx.params;
  const tenant = await resolveTenant(slug);
  if (!tenant.ok) {
    return NextResponse.json({ error: tenant.reason }, { status: tenant.status });
  }

  const parsed = memberIdSchema.safeParse(decodeURIComponent(memberId));
  if (!parsed.success) {
    return NextResponse.json({ valid: false }, { status: 200 });
  }

  const member = await prisma.member.findFirst({
    where: {
      courseId: tenant.course.id,
      memberId: { equals: parsed.data, mode: "insensitive" },
      isActive: true,
    },
    select: {
      memberId: true,
      firstName: true,
      cartIncluded: true,
      discountDays: true,
    },
  });

  if (!member) {
    return NextResponse.json({ valid: false }, { status: 200 });
  }

  return NextResponse.json({
    valid: true,
    memberId: member.memberId,
    firstNameInitial: member.firstName?.[0]?.toUpperCase() ?? "",
    cartIncluded: member.cartIncluded,
    discountDays: member.discountDays,
  });
}
