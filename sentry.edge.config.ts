import * as Sentry from "@sentry/nextjs";

Sentry.init({
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
});
