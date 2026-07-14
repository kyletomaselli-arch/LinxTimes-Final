import * as Sentry from "@sentry/nextjs";

// Server-side Sentry. Only active when a DSN is configured.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0.1,
  // Don't send events in local dev unless you want to; flip to true to test.
  environment: process.env.NODE_ENV,
});
