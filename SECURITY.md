# LinxTimes Security Model

LinxTimes handles payments and personal data. This document records the
controls in place and the rules every future change must follow. Treat it as
binding.

## 1. Cardholder data — we never touch it

**LinxTimes never sees, transmits, or stores raw card numbers, CVCs, or expiry
dates.** Payment is collected with **Stripe Elements / Payment Element**, where
the card fields live inside Stripe-hosted iframes. The card data goes directly
from the customer's browser to Stripe; our server only ever receives a Stripe
token / PaymentIntent identifier.

This keeps LinxTimes in the smallest PCI DSS scope (**SAQ A**). Consequences
that must never be violated:

- ❌ Never accept raw PAN/CVC in any API route, form post, or log.
- ❌ Never store card data in the database — only Stripe IDs
  (`stripePaymentIntentId`, `stripeChargeId`, `stripeTransferId`).
- ❌ Never log full request bodies on payment routes.
- ✅ All payment amounts are computed **server-side** and recomputed at booking
  time; the client can never dictate what is charged.

## 2. Secrets

- All secrets live in `.env`, which is gitignored (`.env*`) and has never been
  committed. Verified with `git ls-files`.
- Secret keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `JWT_SECRET`,
  `DATABASE_URL`) are **server-only** and never imported into client components.
- Only `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is exposed to the browser, which is
  safe by Stripe's design.
- Production secrets are set in the host's environment (Vercel/Railway), not in
  files.
- **Structural guarantee:** all secrets are read through `src/lib/env.ts`, which
  imports `server-only`. If any secret is ever pulled into client/browser code
  by accident, **the build fails** — secrets cannot be bundled into the JS sent
  to a browser. `env.ts` also throws on missing secrets so a misconfigured
  deploy fails fast rather than running insecurely.

## 3. Multi-tenant isolation

- Every tenant-scoped query filters by the resolved `courseId`. A `layoutId` or
  `memberId` supplied by the client is always re-scoped to the tenant before
  use, so one course can never read or affect another's data.
- Tenant resolution (`src/lib/tenant.ts`) rejects reserved slugs and only
  serves `active` courses on public pages; suspended courses return 403/404.

## 4. Input validation

- All network input that affects pricing, availability, or stored data is
  validated with zod schemas (`src/lib/validation.ts`) before use.
- Money is always integer cents — never floats.

## 5. Rate limiting

- Public endpoints (`availability`, `quote`, `member`) are rate limited
  (`src/lib/rate-limit.ts`). The member lookup has the tightest limit and leaks
  no PII beyond a single initial, to blunt member-ID enumeration.
- **Production:** the limiter is currently in-process. Before scaling to
  multiple serverless instances, back it with Upstash Redis / Vercel KV (the
  call sites do not change).

## 6. Transport & browser hardening

- Security headers on every response (`next.config.ts`): HSTS, X-Frame-Options:
  DENY (anti-clickjacking on the payment page), X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy. `poweredByHeader` is disabled.
- A strict Content-Security-Policy allowlisting the Stripe domains is added with
  the Stripe integration step.

## 7. Webhooks (Stripe — added in the payments step)

- The `/api/webhooks/stripe` endpoint **must** verify the `Stripe-Signature`
  header against `STRIPE_WEBHOOK_SECRET` before processing any event.
- All Stripe write calls use **idempotency keys** to prevent double charges or
  double refunds on retry.

## 8. Authentication (added in the dashboard step)

- Passwords hashed with bcrypt (cost 12). Sessions are short-lived (8h),
  HttpOnly + Secure + SameSite cookies. Course admins and LinxTimes
  super-admins are separate auth domains.

## Pre-deploy checklist

- [ ] Rotate any secret that was ever pasted into chat/logs (incl. the dev
      `DATABASE_URL`).
- [ ] All env vars set in host environment, not committed.
- [ ] Stripe webhook signature verification live and tested.
- [ ] CSP enabled and verified against Stripe Elements.
- [ ] Distributed rate-limit store wired if running multi-instance.
- [ ] `npm audit` reviewed.
