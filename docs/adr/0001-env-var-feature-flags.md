# ADR-0001: Env-var feature flag system

## Status

**Accepted** — June 7, 2026

## Context

AgentFlow ships continuously. We need a way to:

1. Hide a feature that is partially built (so we can land the code
   without exposing the UI).
2. Roll back a feature in seconds if it breaks in production, without
   redeploying code.
3. Toggle a feature for a staging environment without affecting
   production.
4. Avoid pulling in a third-party service (LaunchDarkly, PostHog, etc.)
   for what is, today, a 3-flag surface.

Constraints:

- The product is solo-founder scale — a managed feature-flag SaaS adds
  monthly cost, an external dependency, and a privacy review (we'd be
  shipping user identifiers to a third party).
- Next.js + Vercel already provides env vars at build and runtime
  with per-environment scope (`production`, `preview`, `development`).
- A DB-backed flag table was rejected because it requires a network
  round-trip on every page load and a write-path for non-engineers
  (a support burden we don't need yet).

## Decision

We will drive feature flags with **plain `NEXT_PUBLIC_*` environment
variables**, read at call time by a single helper, with the following
rules:

- Each flag has a `label` and a `default` in `src/lib/feature-flags.ts`.
- The env-var name is `NEXT_PUBLIC_FEATURE_<KEY>` (uppercased key).
- **Fail-open semantics**: only the literal string `"false"` kills a
  flag. Any other value — `"FALSE"`, `"0"`, `"no"`, missing var, or
  empty string — falls through to the code default. Rationale: a
  misconfigured env var should never silently turn off a paying
  feature.
- The maintenance banner is the one exception, with **fail-closed
  semantics**: only the literal string `"true"` shows the banner. It
  must never appear in front of new users by accident.
- Flags are evaluated on the client, so a flag flip requires **a
  redeploy** (Next.js inlines `NEXT_PUBLIC_*` at build time). For
  sub-minute rollbacks we add a short note in the decision's
  "Consequences" section below.
- New flags are added in code, not in a dashboard. We treat the
  registry as a version-controlled contract.

The reference implementation lives in:

- `src/lib/feature-flags.ts` — the `FEATURE_FLAGS` const, the
  `isFeatureEnabled(key)` helper, and `isMaintenanceBannerVisible()`.
- `src/components/maintenance-banner.tsx` — the consumer.
- `src/app/(dashboard)/leads/page.tsx` — the first gated feature
  (CSV Import button).
- `docs/FEATURE-FLAGS.md` — the operational reference (per-flag
  status, env-var matrix, how to add a new flag).

## Alternatives considered

### Managed feature-flag service (LaunchDarkly, PostHog, GrowthBook)

- **What it was**: An external SaaS that exposes a dashboard, audit
  log, percentage rollouts, and per-user targeting.
- **Why we rejected it**: Monthly cost, third-party data dependency,
  privacy review burden, and a whole new system to learn for what is
  today a 3-flag surface. Re-evaluate if we cross ~10 flags or need
  per-user targeting.

### DB-backed flag table in Supabase

- **What it was**: A `feature_flags` table read at app startup (or
  per-request) and cached.
- **Why we rejected it**: Adds a network round-trip on every page
  load, requires a write-path for non-engineers, and the value
  changes infrequently (a redeploy cadence is fine). Re-evaluate if
  we need per-user targeting or if flip latency becomes a real
  problem.

### Build-time feature flag via separate code branches

- **What it was**: Git branches per in-progress feature, merged to
  `main` when ready.
- **Why we rejected it**: Doesn't work with trunk-based development
  (we commit to `main` directly) and creates a long-lived branch
  per flag, which makes stale-code cleanup a manual chore.

### Sticky-baked constants in code (no env var override)

- **What it was**: `const FEATURE_CSV_IMPORT = true` directly in
  the code, flipped by editing the constant and redeploying.
- **Why we rejected it**: Requires a commit and a deploy for every
  toggle. No environment differentiation (a flag for staging
  requires a separate env-specific build). No room to grow — adding
  a 4th flag in this style means touching multiple files.

## Consequences

### Positive

- **Zero new infrastructure.** Reuses the env-var system we already
  have.
- **Per-environment flags for free.** Vercel scopes env vars to
  `production` / `preview` / `development`, so we can show a feature
  in staging and hide it in production with no code change.
- **Auditable.** Flag state lives in version control. Every change
  has a commit, an author, and a review.
- **Free rollbacks.** Setting `NEXT_PUBLIC_FEATURE_CSV_IMPORT=false`
  in Vercel and triggering a redeploy reverts a broken feature in
  ~60 seconds (the time it takes Vercel to build and roll out).

### Negative

- **Sub-minute rollbacks require manual work.** Flipping a flag is
  a Vercel dashboard click + redeploy. For a true outage we
  acknowledge the loss of sub-minute "kill switch" capability and
  rely on Vercel's per-deployment instant rollback instead.
- **All-or-nothing toggles.** No percentage rollouts, no per-user
  targeting. If we need either, we move to a managed service.
- **Client-side only.** Flags are baked into the client bundle.
  Server-side code can't check `isFeatureEnabled("csv_import")` —
  it would always return the code default because the server
  bundle doesn't include `NEXT_PUBLIC_*` values. (We don't need
  this today; flag for the day we do.)
- **`false` is the only kill switch string.** Operators must use
  the lowercase string. We considered supporting more (e.g.
  `0`, `off`, `disabled`) but the cognitive overhead of "which
  values are kill switches" outweighs the convenience. One canonical
  kill string keeps the rule simple.

### Neutral

- **Operator dependency on Vercel dashboard.** To add or flip a
  flag, you need Vercel access. This is the same access you'd need
  to flip any other env var, so it's not new.
- **Flag state is not customer-visible.** We have no in-app
  "active features" panel. If a support question comes in about
  "why can't I see X", the answer requires reading the code or
  the Vercel dashboard.

## References

- Implementation: `src/lib/feature-flags.ts`
- Operational reference: [`../FEATURE-FLAGS.md`](../FEATURE-FLAGS.md)
- Env-var matrix: [`../ENVIRONMENT-VARIABLES.md`](../ENVIRONMENT-VARIABLES.md)
- Initial consumer: the maintenance banner in
  `src/components/maintenance-banner.tsx` (gates the banner's
  visibility) and the CSV Import button in
  `src/app/(dashboard)/leads/page.tsx` (gates the first feature).
