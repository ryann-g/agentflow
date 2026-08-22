import * as Sentry from "@sentry/nextjs";

/**
 * Server-side Sentry initialization for the App Router.
 *
 * Without this file @sentry/nextjs cannot hook server runtimes: captures
 * from route handlers queue into a client that never flushes before the
 * serverless sandbox freezes (observed via /api/debug/sentry-check).
 */
export async function register() {
  await import("./sentry.server.config");
}

export const onRequestError = Sentry.captureRequestError;
