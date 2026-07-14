import "server-only";

/**
 * Server-only environment access.
 *
 * Importing `server-only` at the top makes the build FAIL if any of these
 * secrets are ever pulled into client/browser code by accident. This is a
 * structural guarantee — not a convention — that secret keys can never be
 * bundled into JavaScript sent to a user's browser.
 *
 * Use `serverEnv.X` to read a required secret; it throws clearly if missing so
 * a misconfigured deploy fails fast instead of behaving insecurely.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. Set it in .env (dev) or the host's environment (prod).`
    );
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : undefined;
}

export const serverEnv = {
  // Database
  get DATABASE_URL() {
    return required("DATABASE_URL");
  },

  // Stripe — SECRET values. Never exposed to the browser.
  get STRIPE_SECRET_KEY() {
    return required("STRIPE_SECRET_KEY");
  },
  get STRIPE_WEBHOOK_SECRET() {
    return required("STRIPE_WEBHOOK_SECRET");
  },
  get STRIPE_CLIENT_ID() {
    return required("STRIPE_CLIENT_ID");
  },

  // Auth
  get JWT_SECRET() {
    return required("JWT_SECRET");
  },

  // Email
  get RESEND_API_KEY() {
    return optional("RESEND_API_KEY");
  },
  get EMAIL_FROM() {
    return optional("EMAIL_FROM") ?? "LinxTimes <noreply@linxtimes.com>";
  },

  // Misc
  get LINXTIMES_ADMIN_EMAIL() {
    return optional("LINXTIMES_ADMIN_EMAIL");
  },
  get APP_URL() {
    return optional("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000";
  },
} as const;

/**
 * The ONLY Stripe value safe for the browser. Exposed via the NEXT_PUBLIC_
 * prefix by design (publishable keys are meant to be public).
 */
export const publicEnv = {
  STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
} as const;
