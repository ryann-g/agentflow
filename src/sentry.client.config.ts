import * as Sentry from "@sentry/nextjs";

/**
 * PII scrubbing for outbound Sentry events (SEC-016).
 *
 * Without this hook, Sentry captures request URLs (which may include
 * `?redirect=/leads/<uuid>`), breadcrumb messages (which may include
 * user-typed search queries or error text), and exception values — any
 * of which can carry email addresses, phone numbers, or lead IDs that
 * surface PII we don't want in a third-party error tracker.
 *
 * Strategy: walk the mutable string fields of an event and apply a set
 * of regex replacements. We always return the event (possibly with
 * fields replaced by a `[Redacted]` placeholder) so errors still reach
 * Sentry — scrubbing never drops an event entirely.
 */

// Match RFC-5322-ish email addresses. Intentionally permissive on the
// local part so we catch `john.doe+tag@example.co.uk` style addresses.
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Match E.164 / common display phone numbers. `tel:` and `sms:` deep
// links are rendered across the lead detail page, so phone numbers can
// easily leak into breadcrumbs and error strings.
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g;

// Match UUIDv4 (Supabase row IDs for leads, actions, profiles).
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

function scrubString(input: string): string {
  if (!input) return input;
  return input
    .replace(EMAIL_RE, "[redacted-email]")
    .replace(PHONE_RE, "[redacted-phone]")
    .replace(UUID_RE, "[redacted-uuid]");
}

/**
 * Replace `/leads/<uuid>` and similar resource paths in a URL while
 * preserving the query structure (so we can still see `?redirect=...`).
 * Also runs the generic string scrubber to catch emails/phones in query
 * params (e.g. `?email=foo@bar.com`).
 */
function scrubUrl(url: string): string {
  if (!url) return url;
  return scrubString(url);
}

function scrubBreadcrumbs(event: Sentry.ErrorEvent): void {
  if (!event.breadcrumbs) return;
  for (const crumb of event.breadcrumbs) {
    if (typeof crumb.message === "string") {
      crumb.message = scrubString(crumb.message);
    }
    if (typeof crumb.data === "object" && crumb.data) {
      for (const [key, value] of Object.entries(crumb.data)) {
        if (typeof value === "string") {
          crumb.data[key] = scrubString(value);
        }
      }
    }
    // from/to are navigation-specific breadcrumb fields; cast via data
    // to avoid TS errors on the base Breadcrumb type.
    if (typeof crumb.data === "object" && crumb.data) {
      if (typeof (crumb.data as Record<string, unknown>).from === "string") {
        (crumb.data as Record<string, unknown>).from = scrubUrl(
          (crumb.data as Record<string, unknown>).from as string
        );
      }
      if (typeof (crumb.data as Record<string, unknown>).to === "string") {
        (crumb.data as Record<string, unknown>).to = scrubUrl(
          (crumb.data as Record<string, unknown>).to as string
        );
      }
    }
  }
}

function scrubExceptions(event: Sentry.ErrorEvent): void {
  if (!event.exception?.values) return;
  for (const ex of event.exception.values) {
    if (typeof ex.value === "string") {
      ex.value = scrubString(ex.value);
    }
    if (ex.stacktrace?.frames) {
      for (const frame of ex.stacktrace.frames) {
        if (typeof frame.filename === "string") {
          frame.filename = scrubUrl(frame.filename);
        }
      }
    }
  }
}

function scrubRequest(event: Sentry.ErrorEvent): void {
  if (!event.request) return;
  if (typeof event.request.url === "string") {
    event.request.url = scrubUrl(event.request.url);
  }
  if (typeof event.request.headers === "object" && event.request.headers) {
    for (const [key, value] of Object.entries(event.request.headers)) {
      if (typeof value === "string") {
        event.request.headers[key] = scrubString(value);
      }
    }
  }
  if (typeof event.request.query_string === "string") {
    event.request.query_string = scrubString(event.request.query_string);
  }
  if (typeof event.request.data === "string") {
    event.request.data = scrubString(event.request.data);
  }
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  // Session Replay is deliberately NOT enabled.
  //
  // This file used to set `replaysSessionSampleRate: 0` and
  // `replaysOnErrorSampleRate: 1.0`, which reads as "replay every session
  // that hits an error". No replay integration was ever registered —
  // @sentry/nextjs v10 does not add one by default — so those options did
  // nothing at all.
  //
  // What they did do was misrepresent the setup. The `beforeSend` hook below
  // scrubs emails, phone numbers and UUIDs, but Sentry does NOT call
  // `beforeSend` for replay events — replays need their own hook or the
  // integration's masking options. So the day someone registered the
  // integration, an unmasked DOM capture of authenticated pages would have
  // started shipping real client names, email addresses and phone numbers to
  // Sentry, past a scrubber that never applies to them.
  //
  // If you want replay, register the integration with masking on and keep it
  // that way. `maskAllText` is the load-bearing option: it replaces all
  // rendered text with a placeholder. `maskAllInputs` masks input values,
  // `blockAllMedia` blocks images/audio/video, and `networkCaptureBodies`
  // stays false so request payloads are never attached.
  //
  //   integrations: [
  //     replayIntegration({
  //       maskAllText: true,
  //       maskAllInputs: true,
  //       blockAllMedia: true,
  //       networkCaptureBodies: false,
  //     }),
  //   ],
  //   replaysSessionSampleRate: 0,
  //   replaysOnErrorSampleRate: 1.0,
  //
  // Until then, leave the sample rates unset: an inert option that claims a
  // capability is worse than no option at all.
  beforeSend(event) {
    try {
      scrubRequest(event);
      scrubBreadcrumbs(event);
      scrubExceptions(event);
      // Top-level message tag (used by some integrations).
      if (typeof event.message === "string") {
        event.message = scrubString(event.message);
      }
    } catch {
      // If scrubbing itself throws, do NOT drop the event — let it
      // through unscrubbed rather than silently swallowing errors.
    }
    return event;
  },
});
