import "server-only";
import { serverEnv } from "./env";
import { signToken, verifyToken } from "./signing";

/**
 * Stripe Connect (Standard accounts) OAuth helpers.
 *
 * Courses connect their own Stripe account via OAuth. We carry the courseId in
 * a short-lived, HMAC-signed `state` parameter so the callback knows which
 * course connected and so the value can't be forged (CSRF protection).
 */

export function buildConnectUrl(courseId: string): string {
  const state = signToken({ courseId, kind: "stripe_connect" }, 900);
  const redirectUri = `${serverEnv.APP_URL}/api/stripe/callback`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: serverEnv.STRIPE_CLIENT_ID,
    scope: "read_write",
    redirect_uri: redirectUri,
    state,
    "stripe_user[business_type]": "company",
  });
  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}

export function verifyConnectState(state: string): { courseId: string } | null {
  const payload = verifyToken<{ courseId?: string; kind?: string }>(state);
  if (!payload || payload.kind !== "stripe_connect" || !payload.courseId) {
    return null;
  }
  return { courseId: payload.courseId };
}
