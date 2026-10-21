"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { Loader2, AlertCircle, RefreshCw, FlaskConical } from "lucide-react";

const Turnstile = lazy(() =>
  import("@marsidev/react-turnstile").then((mod) => ({
    default: mod.Turnstile,
  }))
);

interface TurnstileWidgetProps {
  onSuccess: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  /**
   * Optional callback fired once the Turnstile iframe has rendered and the
   * verification challenge is visible. Lets the parent page distinguish
   * "widget still loading" from "widget shown, awaiting user interaction"
   * so it can disable submit until verification is complete.
   */
  onLoad?: () => void;
  theme?: "light" | "dark" | "auto";
  /**
   * Width of the Turnstile iframe in pixels. Defaults to 280 so the widget
   * fits inside 320px viewports without horizontal overflow. Pass a larger
   * value for desktop layouts if you have the horizontal space.
   */
  width?: number;
}

/**
 * When the deploy environment sets `NEXT_PUBLIC_TURNSTILE_TEST_BYPASS=true`
 * the widget skips the Turnstile iframe + Cloudflare round-trip entirely
 * and auto-fires onSuccess with a mock token. This is for staging / preview
 * environments only — production Supabase still has `security_captcha_enabled`
 * on, so a fake token will be rejected at the Supabase auth layer. The env
 * var is `NEXT_PUBLIC_` because the widget renders client-side and needs
 * the value at runtime; do NOT set it in production.
 */
const TEST_BYPASS_ENABLED =
  process.env.NEXT_PUBLIC_TURNSTILE_TEST_BYPASS === "true";
const TEST_BYPASS_TOKEN = "test-bypass-token";

/**
 * Emergency kill switch. When `NEXT_PUBLIC_TURNSTILE_DISABLED=true` the
 * widget renders nothing and does not load the Turnstile script. Use this
 * when Cloudflare's verification is failing in production (e.g. on mobile
 * browsers that block 3rd-party cookies). MUST be paired with disabling
 * `security_captcha_enabled` in the Supabase dashboard, otherwise auth
 * requests will be rejected with a captcha-token-missing error.
 */
const TURNSTILE_DISABLED =
  process.env.NEXT_PUBLIC_TURNSTILE_DISABLED === "true";

/**
 * Captured site key. Read once at module load so the empty-key guard
 * below can short-circuit before <Turnstile> mounts (the lib would
 * otherwise silently render a broken iframe and we'd see the "submit
 * button greyed out with no error" failure mode).
 *
 * June 7 2026 incident: Vercel CLI silently accepted `vercel env add`
 * calls but stored empty strings. Next inlined `siteKey: ""` into the
 * JS bundle, the Cloudflare widget never initialized, and the form
 * submit button stayed disabled with no visible error. The guard below
 * turns the silent failure into a clear "Captcha is misconfigured"
 * error so the regression is loud instead of invisible.
 */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Dev-only assertion: if the env var is missing AND we're not in a
 * sanctioned bypass/disabled mode, the build is misconfigured. We only
 * throw in development — in production we render a visible error UI
 * (see the `if (!SITE_KEY) ...` branch in the component) so users see
 * a clear message instead of a permanently-disabled submit button.
 *
 * The throw exists so a developer running `npm run dev` notices the
 * misconfig immediately rather than discovering it from a production
 * incident report.
 */
if (
  !SITE_KEY &&
  !TEST_BYPASS_ENABLED &&
  !TURNSTILE_DISABLED &&
  process.env.NODE_ENV !== "production"
) {
  throw new Error(
    "[TurnstileWidget] NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set. " +
      "Add it to .env.local for local dev, or set " +
      "NEXT_PUBLIC_TURNSTILE_TEST_BYPASS=true / " +
      "NEXT_PUBLIC_TURNSTILE_DISABLED=true if you intentionally want " +
      "to skip captcha in this environment.",
  );
}

/**
 * Visual stand-in rendered when the test bypass is active. Shows a clearly
 * labeled "Test mode" badge so anyone running tests can see at a glance that
 * captcha is not real. Auto-fires onSuccess once on mount so the form
 * becomes submittable the same way it would after a real verification.
 */
function TurnstileTestBypass({
  onSuccess,
  width,
}: {
  onSuccess: (token: string) => void;
  width: number;
}) {
  useEffect(() => {
    // Fire once after mount. The auth page's `captchaVerified` derived
    // value flips to true and the submit button enables. We deliberately
    // skip onLoad — the auth page's "Loading..." → "Complete verification"
    // text transition is meaningless when there's nothing to verify.
    onSuccess(TEST_BYPASS_TOKEN);
  }, [onSuccess]);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="turnstile-widget"
      data-bypass="true"
      data-width={width}
      className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-warning-300 bg-warning-50 px-3 py-3"
      style={{ width, minHeight: 65 }}
    >
      <FlaskConical
        className="h-4 w-4 text-warning-700 shrink-0"
        aria-hidden="true"
      />
      <div className="flex flex-col leading-tight">
        <span className="text-[13px] font-medium text-warning-700">
          Test mode
        </span>
        <span className="text-[11px] text-warning-700/80">
          Captcha bypassed (NEXT_PUBLIC_TURNSTILE_TEST_BYPASS)
        </span>
      </div>
    </div>
  );
}

export function TurnstileWidget({
  onSuccess,
  onExpire,
  onError,
  onLoad,
  theme = "auto",
  width = 280,
}: TurnstileWidgetProps) {
  // Internal error state — when the Turnstile script fails to load or the
  // challenge errors out, we surface a visible message with a retry button
  // instead of letting the page silently submit an empty token.
  const [loadError, setLoadError] = useState<string | null>(null);
  // Tracks whether the Turnstile iframe has rendered at least once. Once
  // the challenge is visible the user is past the "script blocked" stage,
  // so the 10s load-timeout below becomes redundant and would otherwise
  // flash an error after a slow-but-successful load.
  const [hasLoaded, setHasLoaded] = useState(false);
  // Tracks whether the user has completed verification. Cloudflare's
  // managed mode can fire `error-callback` AFTER `success-callback` (e.g.
  // when the session ends, the token expires, or the widget auto-refreshes).
  // Surfacing the error in that case would overwrite a successful verify
  // with a confusing "failed to load" message even though the parent's
  // token is still valid and the form is submittable. We gate the error
  // UI on this flag so post-verify error-callbacks become no-ops.
  const [hasSucceeded, setHasSucceeded] = useState(false);
  // Bumping this key forces React to remount the lazy chunk and re-run
  // the script load — simplest reliable retry for an iframe-based widget.
  const [retryKey, setRetryKey] = useState(0);

  // 10s fallback: if `onLoad` never fires (ad blocker, blocked network,
  // CSP issue, slow first paint on 4G) the Suspense fallback would spin
  // forever and the submit button would stay disabled. After the
  // timeout we surface the same error UI as `onError` so the user gets
  // a clear "refresh or disable ad blocker" message instead of a silent
  // hang. The retry button bumps `retryKey` which remounts the lazy
  // chunk and re-arms the timer. The effect skips scheduling once
  // `hasLoaded` is true so a slow-but-successful load doesn't get a
  // false-positive error at the 10s mark, and skips entirely in
  // test-bypass mode where there's no Turnstile script to time out.
  useEffect(() => {
    if (TEST_BYPASS_ENABLED) return;
    if (loadError || hasLoaded || hasSucceeded) return;
    const timeoutId = window.setTimeout(() => {
      setLoadError(
        "Verification failed to load. Check your connection and retry.",
      );
    }, 10_000);
    return () => window.clearTimeout(timeoutId);
  }, [loadError, hasLoaded, hasSucceeded, retryKey]);

  // Short-circuit before any Turnstile code runs. The bypass renders its
  // own component so the @marsidev/react-turnstile chunk is never fetched
  // in test environments — saves the ~40 KB lazy import and avoids any
  // CSP / network issues with challenges.cloudflare.com in test runners.
  if (TEST_BYPASS_ENABLED) {
    return <TurnstileTestBypass onSuccess={onSuccess} width={width} />;
  }

  // Emergency kill switch. Renders nothing — the parent page must treat
  // `captchaDisabled` as "captcha passed" and Supabase must have its
  // captcha check disabled too, otherwise auth requests will be rejected.
  if (TURNSTILE_DISABLED) {
    return null;
  }

  // Empty-siteKey guard for production. The dev throw above catches the
  // regression class for `npm run dev`; this branch catches it in
  // production where we cannot throw (it would crash the page). Without
  // this, the user sees a submit button that's greyed out with no
  // explanation — a silent failure that was the root cause of the June
  // 7 2026 production outage. The error message names the env var so
  // anyone reading the page knows what to tell the team.
  if (!SITE_KEY) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        data-testid="turnstile-widget-misconfigured"
        className="flex items-start gap-2 rounded-lg border border-destructive-100 bg-destructive-50 px-3 py-2"
      >
        <AlertCircle
          className="h-4 w-4 text-destructive mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <p className="text-[13px] text-destructive leading-snug">
          Captcha is misconfigured. The site key (
          <code className="font-mono text-[12px]">NEXT_PUBLIC_TURNSTILE_SITE_KEY</code>
          ) is missing from this deployment. Please contact support.
        </p>
      </div>
    );
  }

  const handleRetry = () => {
    setLoadError(null);
    setHasLoaded(false);
    setHasSucceeded(false);
    setRetryKey((k) => k + 1);
  };

  if (loadError) {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="flex items-center justify-between gap-3 rounded-lg border border-destructive-100 bg-destructive-50 px-3 py-2 text-left"
      >
        <div className="flex items-start gap-2 min-w-0">
          <AlertCircle
            className="h-4 w-4 text-destructive mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <p className="text-[13px] text-destructive leading-snug">{loadError}</p>
        </div>
        <button
          type="button"
          onClick={handleRetry}
          className="inline-flex items-center gap-1 rounded-md border border-destructive-200 bg-white px-2.5 py-1 text-[12px] font-medium text-destructive hover:bg-destructive-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-1 transition-colors shrink-0"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex justify-center"
      data-testid="turnstile-widget"
      data-width={width}
    >
      <Suspense
        fallback={
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-3 py-3"
            style={{ width, minHeight: 65 }}
          >
            <Loader2
              className="h-4 w-4 animate-spin text-surface-500"
              aria-hidden="true"
            />
            <span className="text-[13px] text-surface-500">
              Loading verification...
            </span>
          </div>
        }
      >
        <Turnstile
          key={retryKey}
          siteKey={SITE_KEY}
          onSuccess={(token: string) => {
            setLoadError(null);
            setHasSucceeded(true);
            onSuccess(token);
          }}
          onExpire={() => {
            onExpire?.();
          }}
          onError={(error: string) => {
            // Post-verify error-callback is a no-op: the parent already has
            // a valid token, the form is submittable, and showing the error
            // banner here would be misleading UX.
            if (hasSucceeded) {
              if (process.env.NODE_ENV !== "production") {
                console.debug(
                  "[Turnstile] post-verify error-callback (ignored):",
                  error,
                );
              }
              return;
            }
            // Pre-verify failure: surface the error so the user knows to
            // retry instead of submitting an empty token. The user-facing
            // message stays generic; the actual Cloudflare error string is
            // already captured by the Sentry `onError` handler in the
            // surrounding app shell.
            setLoadError(
              "Verification failed to load. Check your connection and retry."
            );
            onError?.();
          }}
          onLoad={() => {
            setHasLoaded(true);
            onLoad?.();
          }}
          // We deliberately do NOT override the widget `appearance`. Passing
          // `appearance: "interaction-only"` from the client overrides the
          // site-level "Invisible" mode set in the Cloudflare dashboard and
          // forces a visible challenge — which is the exact UX failure we
          // hit on iOS Safari where the challenge surfaces "No internet
          // connection" instead of a working widget. Letting the dashboard
          // setting win lets operators flip widget modes without a code
          // deploy.
          //
          // `size: "invisible"` applies `{ width: 0, height: 0,
          // overflow: "hidden" }` to the lib's container so the iframe fits
          // inside the 1×1 off-screen wrapper that the auth pages render
          // (see src/app/(auth)/login/page.tsx + signup/page.tsx). The
          // default "flexible" size is 300×65, which the off-screen wrapper
          // clips — preventing the iframe from loading, the `onLoad`
          // callback from firing, and leaving the form submit button
          // disabled. See tests/unit/components/turnstile-widget.test.ts for
          // the regression guard.
          options={{ theme, size: "invisible" }}
        />
      </Suspense>
    </div>
  );
}
