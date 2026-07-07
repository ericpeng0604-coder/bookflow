import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  enabled: Boolean(dsn),
  dsn,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
