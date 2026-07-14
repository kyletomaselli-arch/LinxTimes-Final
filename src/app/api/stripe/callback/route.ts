import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { serverEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { verifyConnectState } from "@/lib/stripe-connect";

/**
 * GET /api/stripe/callback
 * Stripe Connect OAuth redirect target. Exchanges the authorization code for
 * the course's connected account id and stores it. The `state` is HMAC-verified
 * to identify the course and block CSRF.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const dashboard = `${serverEnv.APP_URL}/dashboard/settings`;

  if (error || !code || !state) {
    return NextResponse.redirect(`${dashboard}?stripe=error`);
  }

  const verified = verifyConnectState(state);
  if (!verified) {
    return NextResponse.redirect(`${dashboard}?stripe=invalid_state`);
  }

  try {
    const stripe = getStripe();
    const token = await stripe.oauth.token({
      grant_type: "authorization_code",
      code,
    });
    const connectedAccountId = token.stripe_user_id;
    if (!connectedAccountId) {
      return NextResponse.redirect(`${dashboard}?stripe=error`);
    }

    // Confirm the connected account can actually take charges/payouts.
    const account = await stripe.accounts.retrieve(connectedAccountId);
    const onboarded = Boolean(account.charges_enabled && account.payouts_enabled);

    await prisma.course.update({
      where: { id: verified.courseId },
      data: { stripeAccountId: connectedAccountId, stripeOnboarded: onboarded },
    });

    return NextResponse.redirect(`${dashboard}?stripe=connected`);
  } catch {
    return NextResponse.redirect(`${dashboard}?stripe=error`);
  }
}
