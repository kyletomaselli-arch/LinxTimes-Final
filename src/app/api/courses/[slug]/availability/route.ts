import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenant } from "@/lib/tenant";
import { rateLimit } from "@/lib/rate-limit";
import { availabilityQuerySchema } from "@/lib/validation";
import { computeAvailability } from "@/lib/availability";

/**
 * GET /api/courses/[slug]/availability?layoutId=&date=
 *
 * Public tee-time grid for one layout/date. Tenant-resolved like every other
 * public route (only active courses are served) and rate limited against
 * scraping. The layout must belong to the resolved course.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/courses/[slug]/availability">
) {
  const limited = rateLimit(request, "availability", 60, 60_000);
  if (limited) return limited;

  const { slug } = await ctx.params;
  const tenant = await resolveTenant(slug);
  if (!tenant.ok) {
    return NextResponse.json({ error: tenant.reason }, { status: tenant.status });
  }

  const searchParams = request.nextUrl.searchParams;
  const parsed = availabilityQuerySchema.safeParse({
    layoutId: searchParams.get("layoutId") ?? "",
    date: searchParams.get("date") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid layoutId or date" }, { status: 400 });
  }

  const layout = await prisma.layout.findFirst({
    where: { id: parsed.data.layoutId, courseId: tenant.course.id, isActive: true },
    include: { pricing: true },
  });
  if (!layout) {
    return NextResponse.json({ error: "Layout not found" }, { status: 404 });
  }

  const availability = await computeAvailability({
    course: tenant.course,
    layout,
    dateKey: parsed.data.date,
  });

  return NextResponse.json(availability);
}
