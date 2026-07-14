import "server-only";
import Stripe from "stripe";
import { serverEnv } from "./env";

/**
 * Server-only Stripe client. The `server-only` import guarantees the secret key
 * can never be bundled into browser code — importing this file client-side
 * fails the build.
 *
 * We pin the API version so Stripe never silently changes behavior under us.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(serverEnv.STRIPE_SECRET_KEY, {
      apiVersion: "2026-06-24.dahlia",
      typescript: true,
      appInfo: { name: "LinxTimes", version: "0.1.0" },
    });
  }
  return _stripe;
}
