import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // Server errors are rarer and higher-signal than client ones.
  tracesSampleRate: 0.05,
});
