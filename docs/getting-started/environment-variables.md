# Environment Variables

The full env-var matrix. Variables are grouped by service. The
**Where** column points to every code location that reads the
variable.

## Quick reference

| Variable | Public? | Required in prod? | Set where |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | yes | Vercel + local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | yes | Vercel + local |
| `SUPABASE_SERVICE_ROLE_KEY` | no | yes | Vercel only (never client) |
| `NEXT_PUBLIC_APP_URL` | yes | yes | Vercel only (see note) |
| `PAYMONGO_SECRET_KEY` | no | yes | Vercel only |
| `PAYMONGO_WEBHOOK_SECRET` | no | yes | Vercel only |
| `NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY` | yes | yes | Vercel + local |
| `PAYMONGO_CURRENCY` | no | yes | Vercel only — plan currency (default `usd`; PHP-first platform) |
| `PAYMONGO_MONTHLY_AMOUNT` | no | yes | Vercel only — monthly price in smallest unit (default `800`) |
| `PAYMONGO_ANNUAL_AMOUNT` | no | yes | Vercel only — annual price in smallest unit (default `8000`) |
| `RESEND_API_KEY` | no | yes | Vercel only |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | yes | yes | Vercel + local |
| `NEXT_PUBLIC_TURNSTILE_TEST_BYPASS` | yes | no | Vercel Preview only |
| `NEXT_PUBLIC_TURNSTILE_DISABLED` | yes | no | (kill switch, see below) |
| `NEXT_PUBLIC_SENTRY_DSN` | yes | yes | Vercel only |
| `SENTRY_AUTH_TOKEN` | no | yes | GitHub Actions only (release upload) |
| `SENTRY_ORG` | no | yes | Vercel + GitHub Actions |
| `SENTRY_PROJECT` | no | yes | Vercel + GitHub Actions |
| `CRON_SECRET` | no | yes | Vercel only |
| `SUPABASE_ACCESS_TOKEN` | no | n/a | GitHub Actions (staging workflow) |
| `STAGING_SUPABASE_DB_URL` | no | n/a | GitHub Actions only |
| `PREVIEW_SUPABASE_DB_URL` | no | n/a | GitHub Actions only |
| `VERCEL_TOKEN` | no | n/a | GitHub Actions only |
| `PRODUCTION_APP_URL` | no | n/a | GitHub Actions (production release smoke) |
| `NEXT_PUBLIC_MAINTENANCE_BANNER` | yes | no | Vercel (fail-closed kill switch — see [FEATURE-FLAGS.md](../guides/feature-flags.md)) |
| `NEXT_PUBLIC_FEATURE_CSV_IMPORT` | yes | no | Vercel + local (fail-open kill switch) |
| `NEXT_PUBLIC_FEATURE_PIPELINE` | yes | no | Vercel + local (fail-open kill switch) |
| `NEXT_PUBLIC_FEATURE_BULK_ACTIONS` | yes | no | Vercel + local (fail-open kill switch) |

> **Public variables** have the `NEXT_PUBLIC_` prefix and are
> inlined into the browser bundle. Treat them as public — never
> put a secret in a `NEXT_PUBLIC_` var.

## Supabase

### `NEXT_PUBLIC_SUPABASE_URL`

**Where:** `src/lib/supabase/{client,server,middleware}.ts` —
the Supabase project URL (e.g. `https://fsxdduvwshirrheenmag.supabase.co`).

**Required:** yes (every runtime).

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Where:** Same three files — the public anon key. RLS is the
guarantee that this key can't read other users' data; never rely
on the anon key being secret.

**Required:** yes.

### `SUPABASE_SERVICE_ROLE_KEY`

**Where:** `src/lib/paymongo.ts` (for updating `profiles.plan` and
`subscription_status` via webhook), `src/lib/resend.ts` (for the daily digest
to query all users), `src/app/api/cron/daily-digest/route.ts`,
`tests/e2e/fixtures/auth.ts` (test-only).

**Required:** yes (server-only).

**Security:** this key bypasses RLS. It must never reach the
browser. Vercel will refuse to inline it in the client bundle
since it lacks the `NEXT_PUBLIC_` prefix.

### `SUPABASE_ACCESS_TOKEN`

**Where:** `.github/workflows/staging-promotion.yml`,
`.github/workflows/pr-gatekeeper.yml` (for the `supabase`
CLI to `link` the project).

**Required:** CI only. A personal access token from
https://supabase.com/dashboard/account/tokens.

### `STAGING_SUPABASE_DB_URL`

**Where:** `.github/workflows/staging-promotion.yml`,
`.github/workflows/pr-gatekeeper.yml` (for `supabase db push` and
`supabase gen types`). Uses the **session-mode** pooler
(`aws-1-ap-southeast-1.pooler.supabase.com:5432`) to avoid
prepared-statement leaks from the transaction-mode pooler.

**Required:** CI only.

### `PREVIEW_SUPABASE_DB_URL`

**Where:** `.github/workflows/pr-gatekeeper.yml` (for the
`preview-deploy` job to apply migrations to a per-PR preview DB).

**Required:** CI only.

## App URL

### `NEXT_PUBLIC_APP_URL`

**Where:** `src/lib/auth.ts` (`getBrowserOrigin` SSR fallback).

**Required:** yes, **but only on the server.** The browser
prefers `window.location.origin`, so a Vercel preview deploy
correctly uses its own URL even with this set to the production
domain.

The standard pattern is:
- **Vercel Production:** set to `https://agent-flow.app`.
- **Vercel Preview:** leave unset (so the SSR fallback is empty
  and `window.location.origin` wins).
- **Local:** set in `.env.local` to `http://localhost:3000`.

> A common bug: setting `NEXT_PUBLIC_APP_URL` to the production
> domain in `.env.local`. This breaks magic-link emails from local
> dev (they'd link to production). Keep `.env.local` pointing at
> `localhost`.

## PayMongo

### `PAYMONGO_SECRET_KEY`

**Where:** `src/lib/paymongo.ts` (lazy-init). Used for customer,
plan, subscription, and checkout-session creation.

**Required:** yes (production). The lazy init means the absence of
this var in dev only causes runtime errors on first call, not build
failures.

Format: `sk_live_...` in production, `sk_test_...` in dev.

### `PAYMONGO_WEBHOOK_SECRET`

**Where:** `src/app/api/paymongo/webhook/route.ts`. Used for
HMAC-SHA256 signature verification on incoming webhooks.

**Required:** yes (production). Get this from
https://dashboard.paymongo.com/webhooks after creating a webhook
endpoint that points to `<origin>/api/paymongo/webhook`.

### `NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY`

**Where:** `src/lib/paymongo.ts` (lazy-init). Currently only the
secret key is used server-side; the public key is exposed for any
future client-side PayMongo widgets (e.g., inline card tokenization).

**Required:** no. Safe to leave empty until client-side PayMongo
components are added.

Format: `pk_live_...` in production, `pk_test_...` in dev.

## Email (Resend)

### `RESEND_API_KEY`

**Where:** `src/lib/resend.ts` (lazy-init). Used by
`sendDailyDigest()`.

**Required:** yes (production). The domain `agent-flow.app` must
be verified in the Resend dashboard before the digest emails
will deliver; the sender address is
`AgentFlow <daily@agentflow.app>`.

## Cloudflare Turnstile

### `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

**Where:** `src/components/turnstile-widget.tsx` — passed to
`<Turnstile siteKey={...} />`.

**Required:** yes (production). Get from
https://dash.cloudflare.com/?to=/:account/turnstile.

### `NEXT_PUBLIC_TURNSTILE_TEST_BYPASS`

**Where:** `src/components/turnstile-widget.tsx`. When set to
`"true"`, the widget renders a fake that auto-fires
`onSuccess("test-bypass-token")`. Used in Vercel preview
deploys so e2e tests don't need to interact with the real
Cloudflare challenge.

**Required:** no. Set to `"true"` on the Vercel **Preview**
environment only. **Never set on Production** — Supabase's
captcha verification would either reject the test token (good)
or, if the test bypass token happens to be valid for the
project's secret key, skip the captcha check (bad).

### `NEXT_PUBLIC_TURNSTILE_DISABLED`

**Where:** `src/components/turnstile-widget.tsx`. When set to
`"true"`, the widget renders nothing and never calls `onSuccess`.
The submit button stays disabled because the page uses
`captchaVerified` to gate submission.

**Required:** no. **Emergency kill switch** — use only if
Cloudflare is having an outage and Supabase is rejecting all
auth requests due to missing/invalid captcha tokens. Never set
in production unless you're OK with no bot protection on the
auth pages.

## Feature flags

The env-var feature flag system is described in detail in
[FEATURE-FLAGS.md](../guides/feature-flags.md) (operational reference) and
[ADR-0001](../architecture/adr/0001-env-var-feature-flags.md) (the decision and
alternatives). This section is a quick lookup.

**All four vars are fail-OPEN by default** (a missing var, an
unknown value, or `""` falls through to the code default) — **except
the maintenance banner**, which is fail-CLOSED (must be the literal
`"true"` to show).

### `NEXT_PUBLIC_MAINTENANCE_BANNER`

**Where:** `src/components/maintenance-banner.tsx` (via
`isMaintenanceBannerVisible()`).

**Required:** no.

**Values:**
- `"true"` — banner is visible on all dashboard pages
- anything else (including missing) — banner is hidden

**Default:** hidden. Set this to `"true"` when you want users to
see "AgentFlow is in active development" + a link to `/changelog`.

### `NEXT_PUBLIC_FEATURE_CSV_IMPORT`

**Where:** `src/app/(dashboard)/leads/page.tsx` (gates the "Import"
button).

**Required:** no.

**Values:**
- `"false"` — CSV Import button is hidden
- anything else (including missing) — button is shown

**Default:** shown. Set to `"false"` to hide the button without
removing the underlying import page.

### `NEXT_PUBLIC_FEATURE_PIPELINE`

**Where:** reserved — no consumer yet. Adding the pipeline view's
gating is the natural next step.

**Required:** no.

**Values:**
- `"false"` — pipeline view is hidden
- anything else (including missing) — pipeline is shown

**Default:** shown.

### `NEXT_PUBLIC_FEATURE_BULK_ACTIONS`

**Where:** reserved — no consumer yet. Bulk select / bulk delete on
the leads list is the natural next step.

**Required:** no.

**Values:**
- `"false"` — bulk-actions UI is hidden
- anything else (including missing) — bulk actions are shown

**Default:** shown.

## Sentry

### `NEXT_PUBLIC_SENTRY_DSN`

**Where:** `src/sentry.client.config.ts`. Public DSN. The
Sentry SDK is initialized only in production (`enabled:
process.env.NODE_ENV === "production"`).

**Required:** yes (production).

### `SENTRY_AUTH_TOKEN`

**Where:** `.github/workflows/production-release.yml` —
`npx @sentry/cli releases new ...` and `sentry-cli upload-sourcemaps`.

**Required:** CI only. Create at
https://sentry.io/settings/account/api/auth-tokens/ with
`project:releases` and `org:read` scopes.

### `SENTRY_ORG`, `SENTRY_PROJECT`

**Where:** `next.config.mjs` — `withSentryConfig()` is wrapped
conditionally. Both must be set for the Sentry build plugin to
run; otherwise the build falls through to plain `next build`.

**Required:** yes (production). Set on Vercel.

## Cron

### `CRON_SECRET`

**Where:** `src/app/api/cron/daily-digest/route.ts` — checked
against the `Authorization: Bearer <secret>` header on incoming
requests. Returned 401 if missing or wrong.

**Required:** yes (production). The cron is invoked by Vercel
Cron (or an external scheduler) with the secret in the header.

## Vercel deployment

### `VERCEL_TOKEN`

**Where:** `.github/workflows/staging-promotion.yml` —
`vercel pull --environment=preview && vercel build && vercel deploy --prebuilt`.

**Required:** CI only. A Vercel classic token from
https://vercel.com/account/tokens. (OAuth-session logins cannot
create tokens via the CLI.)

### `PRODUCTION_APP_URL`

**Where:** `.github/workflows/production-release.yml` — used
by the `smoke-tests` job to hit the deployed app and verify it
returned 200. If unset, the job is skipped (this is why the
local `agent-flow.app` URL smoke tests were disabled in early
runs).

**Required:** CI only. Set to `https://agent-flow.app`.

## Local development

The `.env.local.example` file is the template. Copy it to
`.env.local` and fill in real values. `.env.local` is gitignored.

```bash
# .env.local (template, do not commit)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
PAYMONGO_SECRET_KEY=
PAYMONGO_WEBHOOK_SECRET=
NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY=
RESEND_API_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
```

The actual `.env.local` typically also has:

```bash
NEXT_PUBLIC_TURNSTILE_TEST_BYPASS=true   # for local e2e
```

## Vercel environment topology

There are three Vercel environments. Each gets a different set of
secrets.

| Env | Domain | Has `APP_URL`? | Captcha | Sentry |
| --- | --- | --- | --- | --- |
| Production | `agent-flow.app` | `https://agent-flow.app` | real site key | enabled |
| Preview | `*.vercel.app` (per PR) | **unset** (let `window.location.origin` win) | real + TEST_BYPASS=true | disabled |
| Development | local / vercel dev | `http://localhost:3000` | real | disabled |

The **Preview** env is the only one with
`NEXT_PUBLIC_TURNSTILE_TEST_BYPASS=true`. This is what allows the
staging workflow's e2e tests to mint Supabase sessions without
interacting with the Cloudflare challenge.

## Validation behavior on missing vars

The app uses **lazy init** for third-party SDKs and **throws** for
infrastructure vars.

| SDK | Behavior on missing var |
| --- | --- |
| PayMongo (`src/lib/paymongo.ts`) | Lazy. First call throws if secret key is missing. Build succeeds. |
| Resend (`src/lib/resend.ts`) | Lazy. First call throws. Build succeeds. |
| Supabase browser client | Returns `{}` cast to `SupabaseClient` (safe on SSR). |
| Supabase server client | **Throws on module load.** |
| Supabase middleware client | **Throws on module load.** |
| Sentry | No-op in development; in production, if DSN is missing, Sentry console-warns and continues. |
| Turnstile | Component returns `null` if `NEXT_PUBLIC_TURNSTILE_DISABLED=true`; otherwise renders the real widget, which will display Cloudflare's own error if the site key is invalid. |

## What to read next

- [DEPLOYMENT.md](../guides/deployment.md) — where each env var is set in
  CI and on Vercel.
- [AUTHENTICATION.md](../guides/authentication.md) — how the Turnstile
  bypass and kill switch are wired.
- [SECURITY.md](../guides/security.md) — why `NEXT_PUBLIC_*` doesn't mean
  "public to anyone but the app's own users."
