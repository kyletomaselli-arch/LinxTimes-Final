import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { rateLimit } from "@/lib/rate-limit";
import { waitlistSchema } from "@/lib/validation";
import { joinWaitlist } from "@/lib/waitlist";

/**
 * POST /api/courses/[slug]/waitlist
 * Adds a golfer to the waitlist for a full tee time. They'll be emailed if a
 * spot frees up.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/courses/[slug]/waitlist">
) {
  const limited = rateLimit(request, "waitlist", 20, 60_000);
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

  const parsed = waitlistSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid details" }, { status: 400 });
  }

  const result = await joinWaitlist(tenant.course, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
