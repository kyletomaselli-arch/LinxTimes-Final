import * as Sentry from "@sentry/nextjs";

// Client-side Sentry. Active only when a public DSN is configured.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  // Drop non-fatal noise from the decorative homepage globe: h3-js / three-globe
  // throw inside a setTimeout while hex-tiling some land polygons. The globe
  // still renders; these aren't actionable and shouldn't bury real errors.
  beforeSend(event) {
    const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? [];
    const fromGlobe = frames.some(
      (f) =>
        /h3-js|three-globe/.test(f.filename ?? "") ||
        /polygonToCells|H3Library/.test(f.function ?? "")
    );
    return fromGlobe ? null : event;
  },
});

// Instruments client-side navigations for Sentry tracing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
