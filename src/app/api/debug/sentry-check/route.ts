import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/timing-safe-equal";

/**
 * POST /api/debug/sentry-check
 *
 * Delivery proof for the error-tracking pipeline: emits one message + one
 * synthetic exception to Sentry so an operator can confirm events actually
 * reach the dashboard (and alert routing works). Gated by CRON_SECRET.
 *
 * Returns the event ids only after @sentry/nextjs reports a successful
 * transport send from the server runtime.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { captureMessage, captureException, flush } = await import(
    "@sentry/nextjs"
  );

  const stamp = new Date().toISOString();
  const messageId = captureMessage(`[ops] sentry delivery check ${stamp}`, "info");
  const errorId = captureException(
    new Error(`[ops] sentry delivery check ${stamp}`)
  );

  const ok = await flush(5000);

  return NextResponse.json({
    ok,
    messageId,
    errorId,
    hint: ok
      ? "Transport accepted both events — verify they appear in the Sentry dashboard."
      : "Transport did not confirm within 5s — check DSN/env config.",
  });
}
