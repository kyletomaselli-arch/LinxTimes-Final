import * as Sentry from "@sentry/nextjs";

// Edge-runtime Sentry (proxy.ts, edge routes). Active only with a DSN.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});
