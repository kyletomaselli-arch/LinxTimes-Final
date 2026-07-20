import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Content-Security-Policy. Locks down where scripts, styles, frames, and
 * network calls may come from. The allowlisted Stripe origins are exactly what
 * Stripe Elements / Stripe.js require:
 *  - js.stripe.com           → Stripe.js + Elements iframe host
 *  - api.stripe.com          → tokenization / PaymentIntent confirmation
 *  - m.stripe.network        → Stripe fraud/telemetry
 *  - hooks.stripe.com        → 3-D Secure challenge frames
 *
 * 'unsafe-inline' for styles is required by Next.js + Stripe Elements injected
 * styles. Scripts avoid 'unsafe-inline' except where Next needs it; we keep
 * 'unsafe-inline' off script-src is not possible with Next's inline bootstrap,
 * so we allow it but keep object-src 'none' and frame-ancestors 'none'.
 */
const isDev = process.env.NODE_ENV !== "production";

// React/Next require eval() in DEVELOPMENT only (hot reload, better stack
// traces). It is never allowed in production, so the shipped policy stays
// strict. Websocket + localhost connect-src are also dev-only for HMR.
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com"
  : "script-src 'self' 'unsafe-inline' https://js.stripe.com";
const connectSrc = isDev
  ? "connect-src 'self' https://api.stripe.com https://m.stripe.network https://*.ingest.us.sentry.io ws: http://localhost:*"
  : "connect-src 'self' https://api.stripe.com https://m.stripe.network https://*.ingest.us.sentry.io";

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  connectSrc,
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

/**
 * Security headers applied to every response. These are the baseline defenses
 * for an app that handles payments and personal data.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Force HTTPS for 2 years, including subdomains. Browsers refuse plain HTTP.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Don't let the browser MIME-sniff responses into a different type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Clickjacking protection — our pages must never be framed by another site.
  // (Stripe Elements frames live INSIDE our page, which this does not block.)
  { key: "X-Frame-Options", value: "DENY" },
  // Don't leak full URLs (which can contain identifiers) to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable powerful browser features we never use.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self)",
  },
  // Defense-in-depth against cross-origin data leaks.
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  // Never expose the framework version in headers.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
