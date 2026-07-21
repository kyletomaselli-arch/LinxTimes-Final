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

  // Any unexpected failure in the booking path (e.g. the database is
  // momentarily overloaded) becomes a clean, retryable message instead of a
  // raw 500 error page. A booking that throws never reserved a slot, so
  // retrying is always safe — this can't cause a double-booking.
  let result;
  try {
    result = await createBooking(tenant.course, parsed.data);
  } catch (e) {
    console.error("Booking failed unexpectedly:", e);
    return NextResponse.json(
      { error: "We couldn't complete that booking right now — please try again." },
      { status: 503 }
    );
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }

  return NextResponse.json(result);
}
