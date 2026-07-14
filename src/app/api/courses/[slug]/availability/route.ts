import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { computeAvailability } from "@/lib/availability";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { availabilityQuerySchema } from "@/lib/validation";

/**
 * GET /api/courses/[slug]/availability?layoutId=...&date=YYYY-MM-DD
 * Public, tenant-scoped tee time availability grid.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/courses/[slug]/availability">
) {
  const limited = rateLimit(request, "availability", 120, 60_000);
  if (limited) return limited;

  const { slug } = await ctx.params;
  const tenant = await resolveTenant(slug);
  if (!tenant.ok) {
    return NextResponse.json({ error: tenant.reason }, { status: tenant.status });
  }

  const { searchParams } = new URL(request.url);
  const parsed = availabilityQuerySchema.safeParse({
    layoutId: searchParams.get("layoutId"),
    date: searchParams.get("date"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }
  const { layoutId, date } = parsed.data;

  // Scope the layout to this tenant — never trust a cross-tenant layoutId.
  const layout = await prisma.layout.findFirst({
    where: { id: layoutId, courseId: tenant.course.id, isActive: true },
    include: { pricing: true },
  });
  if (!layout) {
    return NextResponse.json({ error: "Layout not found" }, { status: 404 });
  }

  const result = await computeAvailability({
    course: tenant.course,
    layout,
    dateKey: date,
  });

  return NextResponse.json(result);
}
