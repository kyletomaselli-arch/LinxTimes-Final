import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { rateLimit } from "@/lib/rate-limit";
import { bookingSchema } from "@/lib/validation";
import { createBooking } from "@/lib/booking-service";

/**
 * POST /api/courses/[slug]/book
 * Creates a booking and (for online payment) a Stripe PaymentIntent.
 * Returns the confirmation number and, when paying online, a client secret for
 * Stripe Elements. The amount is computed server-side and never trusted from
 * the client.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/courses/[slug]/book">
) {
  const limited = rateLimit(request, "book", 20, 60_000);
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

  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid booking details" }, { status: 400 });
  }

  const result = await createBooking(tenant.course, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }

  return NextResponse.json(result);
}
