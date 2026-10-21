# Comprehensive Audit Prompt v2 — Security, Leaks, Dead Code, Redundancy

> A ready-to-paste prompt for a fresh agent session. Paste the whole block under
> "PROMPT START" as a single user message.
>
> **Target:** AgentFlow — Next.js 16.3.2 (App Router, Turbopack) · React 19 ·
> TypeScript strict · Tailwind 3.4 · Supabase (Postgres + RLS + Auth) ·
> PayMongo Subscriptions · Resend · Cloudflare Turnstile · Sentry ·
> Vercel Analytics/Speed Insights · Vitest + Playwright.
>
> **Working directory:** repo root, branch `main`.
>
> **v3 changelog:** v2 was a competent checklist. This run found the checks that
> actually mattered were the ones v1 did not ask for — the ones that require
> **proving a control actually runs** rather than reading that it exists. v2 added
> five new analysis classes (parallel write paths, live privilege verification,
> enforcement-layer coverage, RLS-exposure probing, third-party PII surfaces)
> and Phase 5, an empirical probe phase.
>
> **v3** adds the classes that only appear once you start fixing: retry-loop
> fall-through (1.13), lockfile integrity across npm versions (1.12), the
> coverage gate as an artifact in its own right (3.8), tables with no writer
> (3.9), values duplicated across units (3.10), and open redirects on
> server-provided URLs (2.6). It also corrects one v2 assumption: an inert
> session-replay sample rate is a **landmine**, not a live leak (2.5).

---

## PROMPT START

You are auditing the AgentFlow codebase for four classes of defect:

1. **Security** — exploitable weaknesses in auth, authz, input handling, payments, and infrastructure.
2. **Leaks** — secrets, PII, and internal data escaping their intended boundary (repo, bundle, logs, email, cache, third parties).
3. **Dead code** — files, exports, routes, dependencies, scripts, and configuration that nothing uses anymore — **including security controls that nothing reaches.**
4. **Redundancy** — duplication, overlapping responsibilities, stale configuration, and drift between what the code says and what it does.

### The core principle

> **A control that no code path reaches is not a control. A policy that only
> exists in a migration file is not a policy. A privilege you have not tested
> is an assumption.**

Most audits of this codebase read code and conclude a control exists. This
audit must prove the control **executes on the path that matters**, in the
runtime that ships. Where that is not provable from the repo, you must either
prove it empirically (Phase 5) or mark it *Needs Verification* — never assume.

### Non-negotiable rules

- **Evidence or it doesn't exist.** Every finding must cite `file:line` and quote the offending code, or show the exact command/probe output that proves it. No finding may be based on a hunch, a filename pattern, a tool's default severity label, or a comment that claims something works.
- **Read before you judge.** A file's name, path, comment, or JSDoc is not evidence of what it does. Open it and read the implementation. This repo contains at least one accurate and several inaccurate comments — treat all of them as unverified until you read the code.
- **Verify the whole path.** A fix in one file does not close a finding if the same guard is missing in a sibling route. Trace every sibling before concluding a class of bug is closed.
- **Prove reachability.** Before crediting any guard (rate limit, schema, plan check, ownership filter, RLS policy, DB trigger), find the **caller** that invokes it. If the only callers are tests, the guard does not run in production.
- **Report first, then fix.** Produce the full findings report before changing any code. Then apply fixes in the order given in "Fix Policy".
- **Never weaken a guard to make something pass.** If a test fails because a security check works, the check is correct and the test is wrong. Say so.
- **Green locally is not "done".** A fix is done when `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, and (for behavior changes) the relevant Playwright spec all pass — and you state the actual output.
- **Do not touch:** `.env*`, `node_modules/`, `.next/`, `supabase/.temp/`, `coverage/`, `test-results/`, `playwright-report/`, `brag-output/`, or anything under `.agents/`, `.opencode/`, `.impeccable/`.
- **Do not run:** `git push`, `git reset --hard`, `git clean -fd`, `git filter-repo`, `vercel deploy`, `vercel env rm`, or any command that mutates a remote or deletes untracked work.
- **Do not** create a commit, branch, or PR unless asked.
- **Probe hygiene (Phase 5).** Live probes must be read-only by default. If a probe must write (to prove a write-privilege gap), it must (a) use a namespaced id that can never collide with production data — e.g. `audit-probe-<epoch>-<purpose>`, (b) be deleted in the same script, (c) verify the cleanup returned success, and (d) never touch a real user's row. Do not probe a table you cannot clean up.

### Output language

Match the codebase's existing conventions. Code comments in English, sentence case, explaining *why* rather than *what*. Match the surrounding comment density — do not comment a file that has no comments.

---

## Phase 0 — Baseline (record before changing anything)

```bash
npm ci                 # if node_modules is empty — use `ci`, not `install`, so the lockfile is not rewritten
npm run lint
npx tsc --noEmit
npm test
npm run build
npm audit --omit=dev --audit-level=high
git status --short
git log --oneline -5
```

Also record:
- Tracked files: `git ls-files | wc -l`; source files: `find src -name '*.ts' -o -name '*.tsx' | wc -l`
- 15 largest source files: `wc -l $(find src -name '*.ts' -o -name '*.tsx') | sort -rn | head -15`
- Every route the app serves: `find src/app -name 'page.tsx' -o -name 'route.ts' -o -name 'layout.tsx' | sort`
- Every env var referenced in source: `grep -rn "process\.env\." src/ | sort -u`
- Node/npm versions: `node -v; npm -v` (a local/CI npm major mismatch is a known lockfile-desync risk in this repo)

**Report the baseline verbatim.** If lint/tests already fail at baseline, that is a finding, not a blocker — note it and continue.

---

## Phase 1 — Security

Read every file below before writing a single finding. Quote the code.

### 1.1 Authentication & session handling
- `src/lib/supabase/middleware.ts` — the central auth gate. Confirm it **fails closed** on every error path (thrown `getUser()`, missing env, malformed cookie). Cross-check `PROTECTED_PATHS` against the live route list: a path with no matching route is a stale entry; a live protected route missing from the list is only safe if it self-guards — if it does not, that is an auth bypass.
- `src/app/auth/callback/route.ts` — OAuth/magic-link callback. Confirm no full-URL logging (tokens live in the query string), no unvalidated reflection, and that the redirect target is validated against a **same-origin** rule (check `//evil.com` and absolute-URL cases).
- `src/app/(auth)/login/page.tsx`, `signup/page.tsx`, `reset-password/page.tsx` — no secret in client state, no internal error leakage.
- Cookie flags: `SameSite`, `HttpOnly`, `Secure`, and cookie deletion on sign-out.

### 1.2 Parallel write paths — **the highest-value class in this codebase**

This app can write the same data two ways: through a Next.js route handler
(`src/app/api/**`) or **directly from the browser to Supabase** via the anon
client + the user's JWT. Every write in `src/hooks/`, `src/app/(dashboard)/`,
and `src/components/` must be classified.

Build this table before writing any other security finding:

| Write | Path | Server validation | Rate limit | Plan limit | Enforcement that actually fires |
|---|---|---|---|---|---|

For every `.insert(`, `.update(`, `.upsert(`, `.delete()`, and `.rpc(` in client
code, determine:
1. Does it go through an API route, or straight to PostgREST?
2. If direct: **every check that route would have performed is bypassed** — Zod schema, rate limit, plan limit, ownership filter, sanitization.
3. Find the callers of each API route. **If the only callers are tests, the route is not a security control.** State this explicitly for each route.

Routes to check for zero production callers: `/api/leads` (GET+POST),
`/api/leads/[id]` (GET+PUT+DELETE), `/api/leads/import` (POST), `/api/export`,
`/api/paymongo/*`, `/api/cron/*`, `/api/debug/*`, `/api/health`.

Enumerate exhaustively — do not sample:

| Surface | Files |
|---|---|
| API routes | `src/app/api/leads/route.ts`, `src/app/api/leads/[id]/route.ts`, `src/app/api/leads/import/route.ts`, `src/app/api/export/route.ts` |
| Payment routes | `src/app/api/paymongo/checkout/route.ts`, `cancel/route.ts`, `payment-method-url/route.ts`, `webhook/route.ts` |
| Cron routes | `src/app/api/cron/daily-digest/route.ts`, `billing-check/route.ts` |
| Debug route | `src/app/api/debug/sentry-check/route.ts` |
| Client writers | `src/hooks/useLeads.ts`, `useProfile.ts`, `src/app/(dashboard)/leads/new/page.tsx`, `leads/[id]/edit/page.tsx`, `leads/[id]/lead-detail-client.tsx`, `pipeline/pipeline-client.tsx`, `follow-ups/follow-ups-client.tsx` |
| Server hooks | `src/hooks/useLeadsServer.ts`, `useLead.ts`, `useDashboard.ts` |

### 1.3 Authorization & IDOR
For every route handler and every server-side fetch, determine:
- Does it authenticate the caller?
- Does it scope the query to the caller's `user_id` (or equivalent ownership predicate)?
- Is the ownership predicate applied to **read, update, and delete** identically?
- Does the row-level policy have a `WITH CHECK` clause (so a row cannot be re-pointed at another owner)?

Confirm the service-role client (`src/lib/supabase/service.ts`) is never reachable from a request path that lacks an explicit auth check. A service-role query without a `user_id` filter leaks every user's rows.

### 1.4 Enforcement-layer coverage matrix — **new in v2**

For each business rule (free-tier lead cap, plan value, ownership), list **every**
layer that could enforce it and mark whether it fires for **each operation**
(create / update / soft-delete / re-activate / bulk):

| Rule | Layer | Operation | Fires? | Evidence |
|---|---|---|---|---|

Layers to enumerate:
- Client-side check (e.g. `checkPlanLimit()`)
- API route check
- Postgres trigger (`supabase/migrations/**`)
- Postgres CHECK constraint
- Postgres column-level GRANT
- Postgres RLS policy

**A trigger on INSERT does not cover UPDATE.** A trigger on INSERT does not
cover a soft-delete-then-reactivate cycle. A CHECK constraint on one column
does not constrain another. Prove each cell; do not infer it from the SQL.

### 1.5 Payments (PayMongo) — highest financial risk
- `src/lib/paymongo.ts` — read it end to end.
  - **Signature verification**: confirm the HMAC is computed over the **raw request body** (not a re-serialized object), comparison is constant-time, all documented signature modes are accepted, a missing/malformed header is rejected, and there is a replay window (timestamp tolerance).
  - **Event routing**: the handled event set must match PayMongo's real event catalog; unknown events must be acknowledged without touching business state.
  - **Idempotency**: replaying an event id must not double-apply a state change. Verify the dedup store's integrity assumptions (see 1.6).
  - **Amount/currency**: prices must come from a single source of truth, never from client input, never negative/zero.
- The webhook route must verify the signature **before** parsing the body or touching the database.
- Confirm no client-controlled price, plan, or `user_id` reaches a checkout call.

### 1.6 Database exposure — RLS-disabled tables and privilege grants
Enumerate every table in the `public` schema that the app uses. For each, determine:
- Is RLS enabled?
- Are `anon` and `authenticated` granted table-level access? (Supabase's default privileges grant `ALL` on new `public` tables to both roles.)
- If RLS is disabled **and** the table is reachable through PostgREST, the table is world-readable and world-writable to anyone holding the public anon key.

Check every migration for `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` and for
whether a matching `REVOKE ... FROM anon, authenticated` exists. A table that
holds **security-relevant state** (dedup tables, audit trails, queue tables)
must be service-role-only.

Also verify that the repo's migrations can actually rebuild the schema. If
`001_initial_schema.sql` is a comment-only placeholder, then **every RLS
policy, trigger, and CHECK constraint lives only on the remote database** and
is unreviewable, unreproducible, and invisible to CI. Report that as an
assurance finding, not a style note.

### 1.7 Input validation & injection
- Every request body: parsed with **Zod** (`src/lib/validations.ts`) or ad hoc? Ad hoc is a finding.
- SQL injection: Supabase queries are parameterized by construction — but check for string-built filters, `.or()`/`.filter()` with concatenated input, and `rpc()` calls with interpolated values.
- CSV import (`src/app/api/leads/import/route.ts`, `src/app/(dashboard)/leads/import/page.tsx`): confirm the **server** enforces size limit, row limit, binary/null-byte rejection, and formula-injection sanitization (`src/lib/csv-sanitize.ts`). Client-side checks are not a trust boundary.
- **Body-size / buffering DoS**: a size check placed *after* `await request.formData()` or `await request.json()` does not prevent the allocation. Check for a `Content-Length` guard *before* the body is read, and check whether alternate input channels (a JSON field inside a multipart body) have their own size cap.
- **Runtime type assertions**: `as File`, `as string`, `as PlanType` on externally-supplied data are unchecked. Verify with `instanceof` / a schema / a runtime guard, and verify that a wrong type produces a controlled 4xx rather than an unhandled `TypeError` → 500.
- Path traversal, SSRF, open redirect. For the middleware's `?redirect=` parameter and the callback's `?next=`, confirm the destination cannot be `//evil.com` or an absolute off-site URL.
- XSS: `src/app/layout.tsx` uses `dangerouslySetInnerHTML` for JSON-LD. Confirm only static app metadata is interpolated and that no value can break out of the `<script>` context via a `</script>` sequence.

### 1.8 Rate limiting & abuse
- Confirm **every** state-changing and expensive route is covered: leads create/update/delete, CSV import, **data export**, PayMongo checkout/cancel/payment-method-url, cron routes, the debug route, and — critically — **any direct client write that bypasses those routes** (see 1.2).
- State the real limitation of an in-memory limiter on serverless (per-instance state does not enforce a global limit) rather than claiming the limit is enforced.
- Confirm limits are keyed by authenticated user where possible, not only by IP.
- Check the limiter's store for unbounded growth (entries that expire but are never evicted).

### 1.9 Secrets handling
- List every `NEXT_PUBLIC_*` variable and classify it as public-by-design or leaked. Any `NEXT_PUBLIC_*` holding a non-public value is Critical.
- Confirm `SUPABASE_SERVICE_ROLE_KEY`, `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`, `RESEND_API_KEY`, `CRON_SECRET` are read only in server-only modules, and that those modules are not imported by any `"use client"` file.
- Confirm the lazy-init pattern (PayMongo/Resend/Supabase) cannot throw at build time.

### 1.10 Infrastructure & headers
- `next.config.mjs` — audit the CSP: `script-src` must not contain `'unsafe-eval'` in production; flag `'unsafe-inline'` in `script-src` (and note the nonce alternative); confirm `object-src 'none'` is present; flag wildcard sources (`img-src https:`); flag any origin listed but unused; flag any used origin missing.
- Confirm `frame-ancestors`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and HSTS are set.
- `src/app/api/health/route.ts` — confirm it exposes **no** internal detail (no DB version, env values, stack traces). A health endpoint that leaks configuration is a finding even without auth.

### 1.11 Supply chain
- `npm audit --omit=dev --audit-level=high` — record exact output. Compare the affected version ranges against `package.json`; an advisory whose range includes the installed version is a finding regardless of what a status file claims.
- **Separate production risk from build-time risk.** After `npm audit`, resolve the dependency path of each remaining advisory (`npm ls <pkg> --omit=dev`) and classify it: a package reachable only through a bundler plugin, a CSS compiler or a test runner is a build-time concern, not a runtime one. Say which it is — do not report build-time advisories as runtime risk, and do not dismiss them silently either.
- For each direct dependency, confirm it is imported. An unused direct dependency is both leak surface and dead weight (Phase 3).
- Confirm no dependency that should be server-only is reachable from a client bundle.

### 1.12 Lockfile integrity — **new in v3**
The lockfile is a build input, and a lockfile that one npm version writes and another rejects breaks CI in a way that looks like a flaky network error.

- Determine the npm version CI uses (`node -version` in the workflow → the bundled npm major) and the npm version you are running locally. **If they differ, the lockfile must be regenerated with CI's npm**, not yours.
- Prove it, don't assume it:
  ```bash
  npx --yes -p npm@10 npm ci     # substitute CI's major
  ```
  A failure here with `EUSAGE ... Missing: <pkg> from lock file` is a real finding: the lockfile was written by a different npm and CI will fail identically.
- After any dependency change, re-run that check **and** re-check `git diff --stat package-lock.json`. Large churn that is not explained by the package you added or removed is a desync, not a resolution.
- Keep the version field in `package.json` in step with the release tag. If the release workflow derives the version from a git tag, it must also bump `package.json`, or the two drift permanently.

### 1.13 Error-path fall-through in retry loops — **new in v3**
A retry loop that falls through to its success return on the last attempt hands the **error body** back to the caller as a valid response. In the payment path this means a cancellation reports success while the subscription stays live.

- For every retry/backoff loop in the codebase, trace the **last** iteration: after the final attempt fails, does control reach the success path or does it throw?
- Look for the shape:
  ```ts
  if (attempt < MAX_RETRIES) { await sleep(delay); continue; }
  return (await response.json()) as T;   // ← the error body, returned as success
  ```
- The fix is an explicit `throw lastError` before the success return.
- Assert it with a test: mock the transport to fail on every attempt and assert the call **rejects**. A test that only covers the "succeeds on the second attempt" path will not catch this.


---

## Phase 2 — Leaks

"Leak" = data crossing a boundary it should not cross. For each, name the boundary and the mechanism.

### 2.1 Secret leaks
- **Tracked files**: `git ls-files` — any tracked file containing a key-shaped string. Check `.env.local.example`, `supabase/config.toml`, `supabase/.temp/**`, `types/supabase.ts`.
- **Git history**: scan all history for secret-shaped strings and **classify each hit as live-shaped or placeholder**:
  ```bash
  git log --all -p -S 'sk_test_' -- . | grep -oE 'sk_(test|live)_[A-Za-z0-9_]+' | sort -u
  git log --all -p -S 'whsec_'   -- . | grep -oE 'whsec_[A-Za-z0-9_]+' | sort -u
  git log --all -p -S 're_'      -- . | grep -oE 're_[A-Za-z0-9]{20,}' | sort -u
  git log --all -p -S 'eyJhbGciOi' -- . | grep -oE 'eyJ[A-Za-z0-9_-]{40,}' | sort -u
  git log --all -p -S 'vcp_'     -- . | grep -oE 'vcp_[A-Za-z0-9]+' | sort -u
  git log --all -p -S 'postgres://' -- . | grep -oE 'postgres(ql)?://[^ "]+' | sort -u
  ```
  A hit is only a leak if the string is **live-shaped**. `sk_live_your` and `whsec_test` are placeholders — say so in the report so the reader knows the scan ran, and do not inflate the finding.
- **Ignored-but-present files**: `.env.local`, `production`, `preview`, `development`, `vercel-env-*.env`, `.sb-pentest-*`. Confirm `.gitignore` covers each (`git check-ignore -v <path>`) and that none is tracked.
- **Local knowledge files**: any file containing live operational secrets. Confirm it is ignored AND that no tool can push it outward. If the repo has a guard script for this (e.g. stashing the file during media generation), verify the guard actually works byte-identically, and check whether **other** tools (screen capture, video render, share, upload) can read the project directory unfiltered.

### 2.2 PII & data leaks
- Confirm any data-export route returns **only** the caller's rows, and does not include internal columns (billing identifiers, plan internals, service-role fields) — a `select("*")` on an internal table is a data-minimization finding even when the caller owns the row.
- Confirm outbound email contains only the recipient's own data, with the recipient derived from the authenticated user — not a request parameter.
- Confirm error responses never contain a library error message, stack trace, or raw Postgres error that reveals schema.
- Confirm Sentry payloads do not carry PII. **Check replay separately** — see 2.5.
- Confirm analytics/consent components do not fire before consent in a way that records the visitor.

### 2.3 Log & telemetry leaks
- `grep -rn "console\." src/` — confirm no `console.log`/`console.debug` in production code.
- Confirm cron routes do not log the full `authorization` header.
- Confirm the auth callback does not log the full request URL, and does not log **whole error objects** (an error object can carry a response body).
- Confirm error logs do not include `error.details` / `error.hint` from a database driver — those describe schema.

### 2.4 Third-party boundary leaks
Enumerate every outbound call to a third party (Supabase, PayMongo, Resend, Cloudflare Turnstile, Sentry, Vercel Analytics/Speed Insights, OAuth providers, external links). For each, state **what data leaves**: which fields, to which country, on what trigger. Flag any request that sends PII to a service that does not need it.

### 2.5 Client-bundle and cache leaks — **new in v2**
- **Session replay / recording SDKs**: if a session-replay SDK is enabled, determine the sample rate and whether replay events are scrubbed. **A `beforeSend` hook does not run for replay events** — replay needs its own hook (`beforeSendReplay`) or masking options (`maskAllText`, `maskAllInputs`, `blockAllMedia`). If replay is enabled and unmasked, the replay captures rendered DOM — which for this app means client names, emails, phone numbers, and notes — and uploads it on error. This is a PII leak that a thorough error-event scrubber does not cover.
  - **But first check whether the integration is even registered.** A `replaysOnErrorSampleRate` option on its own does nothing — Sentry only records if the replay integration is added. `grep -rn "replayIntegration(" node_modules/@sentry/nextjs/` and the built client chunk tell you whether it is wired up. An inert sample rate is not a leak; it is a **landmine** — configuration that misrepresents the setup and would leak the moment someone registers the integration. Report it as such and remove it, or register it with masking on.
- **Service worker cache**: for every URL in the app-shell list and every response the SW caches, ask:
  - Is the route **authenticated**? If so, its HTML contains user data.
  - Is the cache **partitioned per user**? A single shared `CacheStorage` entry keyed only by URL means user A's cached page is served to user B, or to user A after sign-out, on an offline/cached response.
  - Does the cache **expire**? A constant cache name with no version bump means stale entries live forever across deploys.
  - Does the SW skip cross-origin requests on the **read** path, not just the write path?
  - **Does bumping the cache name purge what was already cached?** Changing the rules without changing the name leaves the old, PII-bearing entries on every device that already installed the service worker. Bump the name in the same change.
- **Client-bundle leaks**: confirm every `NEXT_PUBLIC_*` inlined value is publishable by definition, and that no server-only module is reachable from a `"use client"` import chain.

### 2.6 Open redirects on server-provided URLs — **new in v3**
A URL that the server sends to the browser to navigate to is an open redirect the moment the response is tampered with, misconfigured, or served from a compromised upstream.

- Find every `window.location.href = <value>` / `<a href={<value>}>` where the value came from an API response.
- Validate the **host**, not just that the value is a string. A same-origin check is wrong here — the checkout legitimately lives on another host — so allow-list the expected hosts explicitly.
- Keep the helper client-safe: a module that imports `node:crypto` or the service-role client cannot be imported by a browser component. Split it out rather than importing the server module.


---

## Phase 3 — Dead code

Produce a table: `path` · `kind` · `evidence it is unused` · `safe to delete?` · `risk if deleted`.

### 3.1 Unused files and routes
- For every file under `src/`, `tests/`, `scripts/`, `supabase/`, and `docs/`, determine whether anything imports, requires, or references it. Prove it by grepping the module path **and** the exported symbol **and** the file's distinctive strings.
- **Exclude framework entry points** from "dead": `src/app/**/page.tsx|layout.tsx|route.ts|error.tsx|loading.tsx|not-found.tsx|global-error.tsx|sitemap.ts`, `src/instrumentation.ts`, `src/middleware.ts`, `src/sentry.*.config.ts`. These are consumed by Next.js/Sentry conventions, not by imports. Reporting them as dead is a false positive.
- Enumerate every route the app serves and confirm each is reachable from a nav link, sidebar, bottom-nav, link in markup, redirect, sitemap, email, or documented webhook. An unreachable route is dead weight **and** an attack surface.
- `src/app/api/debug/sentry-check/route.ts` — decide: legitimate operator tool (then it must be documented, secret-gated, and rate-limited) or a leftover debug endpoint (then it should not ship to production).

### 3.2 Unused exports, functions, and components
- Every exported symbol in `src/lib/**`, `src/hooks/**`, `src/components/**`, `src/data/**`. Flag exports with zero importers.
- Distinguish **DEAD** (zero references anywhere) from **SELF-ONLY** (referenced only inside its own file → the `export` keyword is unnecessary). Self-only is a Low finding, not dead code.
- Watch for overlap between similarly-named modules (e.g. `useLeads` vs `useLeadsServer` vs `useLead` vs `useDashboard`) — determine whether all are live and whether any two could be one.

### 3.3 Unreachable security controls — **new in v2**
The most dangerous kind of dead code is a control that reads as protection but never executes. For every guard in the codebase — rate limit, Zod schema, plan check, ownership filter, sanitization, capability gate — find its **production caller**.

Report as a finding:
> Guard at `path:line` is not reachable in production — its only callers are `tests/...`. The equivalent client path (`path:line`) writes directly and skips it.

### 3.4 Dead configuration
- `src/lib/feature-flags.ts` — for each flag, state whether any code path consumes it. A flag that gates nothing is dead config.
- `src/lib/constants.ts` (`PLAN_LIMITS`) — confirm every value is enforced somewhere, and note which layer.
- `next.config.mjs`, `vercel.json`, `tailwind.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts` — flag config keys no code path reads, and any referenced script path, secret, or env var that does not exist.
- `tailwind.config.ts` — list every custom color token and every shadow/radius/borderWidth utility and report the ones with zero usages. (A partially-used palette is normal design-system practice — do not report individual unused shades as findings.)

### 3.5 Dead dependencies
- Every direct dependency in `package.json` (both `dependencies` and `devDependencies`): confirm it is imported. Report only the ones with zero usage. Distinguish a genuinely unused package from a CLI-only tool invoked through a `package.json` script or a GitHub workflow (e.g. `lhci` is used via its binary, not its package name).

### 3.6 Dead local scripts and artifacts
- `scripts/` is gitignored (local-only). For each file, decide: does it still serve a purpose (is it referenced by a doc, skill, or workflow), and does its output still exist?
- Confirm `coverage/`, `test-results/`, `playwright-report/`, `brag-output/`, `.sb-pentest-*` are gitignored and untracked.

### 3.7 Stale database & migration code
- `supabase/migrations/**` — confirm the file set matches what the remote database has applied. A comment-only placeholder migration is a **finding**: it makes `supabase db push` a no-op while appearing to manage the schema, and it hides the fact that the real schema exists only on the remote.
- Confirm generated types are regenerated from truth and not hand-maintained drift.

### 3.8 The coverage gate itself — **new in v3**
A coverage threshold is only meaningful if it is currently satisfied. This repo's gate had been failing on `main` for an unknown number of releases, so every pull request would have been blocked at the unit-tests step.

- Run the coverage command the CI runs (`npx vitest run --coverage --reporter=verbose`) and record the numbers **before** changing anything.
- If it fails, establish whether it is pre-existing: `git stash push -u`, re-run, `git stash pop`. A gate that was already red is a finding in its own right, not a blocker for the rest of the audit.
- Compare the vitest thresholds against the workflow's own gate. They are often two different numbers — a config threshold of 80 and a CI threshold of 75 means the suite fails locally while CI passes. Both must be stated.
- For every file excluded from the coverage denominator, ask: **does it have tests?** A route excluded because "the logic is complex" is the route most likely to contain a bug. Move it back into the denominator and write behavioural tests for it, or state plainly that it is uncovered.
- Prefer a behavioural test over a source-assertion test. A test that reads the file and matches a string proves the text exists, not that the code runs. Source assertions are appropriate for *shape* invariants (which transport a write travels over) and inappropriate for *behaviour* (does it reject an oversized body).

### 3.9 Tables with no writer — **new in v3**
For every table the app reads, confirm something writes to it.

```bash
grep -rn 'from("actions")' src/ -A3 | grep -E "insert|update|delete"
```

A table that is read but never written is always empty. That is not dead code — it is a **feature that was never wired up**: the UI renders an action history that can never have any entries, and the export ships an empty array. Report it as a product gap requiring a decision (wire the writer, or drop the surface), not as something to quietly delete.

### 3.10 Values duplicated across units — **new in v3**
A value written in two different units (cents vs dollars, seconds vs milliseconds, bytes vs megabytes) in several places is a live billing bug waiting for the wrong edit.

- For every price, limit, size or duration, find every location it appears and compare the **units**, not just the digits.
- The fix is a canonical module that both the server and the client import, with the display values derived from the stored values rather than written out again:
  ```ts
  export const PRO_PRICE_AMOUNTS = { monthly: 800, annual: 8000 } as const;
  export const proPriceLabel = (i) => `$${PRO_PRICE_AMOUNTS[i] / 100}/${i === "annual" ? "yr" : "mo"}`;
  ```
- Add a test that asserts no surface reintroduces a hardcoded literal — the regression is a grep away.


---

## Phase 4 — Redundancy

### 4.1 Duplicated logic
- Find logic implemented twice. For each, name the single source of truth and the call sites that should use it.
- Check whether a shared module is *actually* the single source of truth, or whether call sites re-implement parts of it.
- Stage/label formatting, lead scoring, date formatting, plan pricing, email formatting: confirm each has exactly one home.

### 4.2 Overlapping responsibility
- Identify pairs of modules that both "own" the same decision, and say which should own it.
- Review the layout chain (`src/app/layout.tsx` → `src/app/(dashboard)/layout.tsx` → `src/components/layout/dashboard-layout.tsx`) — is each layer pulling its weight, or is one a pass-through wrapper adding indirection?
- Review client/server hook overlap: does a `useX` (browser) and `useXServer` (server) pair duplicate logic that should live in one place?

### 4.3 Stale / contradictory configuration
- Cross-check every value that appears in more than one place and confirm they agree. **A disagreement is a finding.** List every disagreeing location.
  - **Price and plan** — note the unit: PayMongo amounts are in cents, UI strings are in dollars. A `800` next to a `$8` is correct; a `8` next to `800` is a bug. Check every surface: the payment lib, pricing data, landing page, billing page, settings page, JSON-LD, terms, README, changelog.
  - **Free-tier limits** — the constant, the client helper, the DB trigger, and the marketing copy.
  - **Contact email and canonical domain** — every variant, including personal addresses published in a public repo.
  - **Effective dates** in legal pages.
  - **Feature-flag env var names** vs the operator docs.
  - **Version numbers** — `package.json` vs the latest git tag vs the latest changelog entry. Also check tag-format consistency (`v0.41.4` vs `v2026.05.29-<hash>`).
  - **Navigation and routes** — a route referenced from an email or service worker but absent from the nav is a stale-IA finding; a route in the nav but not in the sitemap is another.
- GitHub Actions: confirm every referenced script path, secret name, and env var still exists. A workflow referencing a deleted script is a silent CI break.

### 4.4 Oversized / over-complex modules
- Report every file over 400 lines, and over 800 as a hard violation of the repo convention. For each, propose a **concrete** split with named modules and the functions that would move where. Do not write "consider refactoring".

### 4.5 Accessibility & consistency debt
- Every interactive element has an accessible name; icon-only controls have `aria-label`; every form input has a `<label>`.
- No raw Tailwind palette class (`red-500`, `green-50`, `blue-600`) remains in `src/` — the standard is semantic tokens (`destructive-*`, `success-*`, `accent-*`, `warning-*`).

---

## Phase 5 — Live verification (empirical proof) — **new in v2**

For every claim you cannot settle from the repo, **prove it against the live
environment** using the project's own public credentials. This is a read-mostly
phase; follow the probe hygiene rules above.

### 5.1 Privilege probe with the public anon key
The anon key is public by design (it ships in the client bundle). Use it to test
what the `anon` role can do against each table:

```bash
set -a && . ./.env.local && set +a
URL="$NEXT_PUBLIC_SUPABASE_URL"; KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY"

# READ: HTTP 200 + rows  => anon can read. HTTP 200 + [] => allowed but no visible rows.
#       401/403          => privilege denied.
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  "$URL/rest/v1/<table>?select=*&limit=3" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Compare each result against the intended posture. A table that returns `200`
(with rows visible, or with `[]` because the table is simply empty) is
**reachable**; only a `401`/`403` proves a deny. Do not confuse "empty result"
with "denied".

### 5.2 Write-privilege probe (namespaced, self-cleaning)
To test INSERT/UPDATE/DELETE on a table the anon role should not touch:

```bash
PROBE="audit-probe-$(date +%s)-<purpose>"   # can never collide with real data
curl -s -w "HTTP %{http_code}\n" -X POST "$URL/rest/v1/<table>" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"<col>\":\"$PROBE\", ...}"
# ... then DELETE it and VERIFY the delete returned 2xx and the row is gone.
```

Report the exact HTTP codes. `201`/`204` = the write succeeded. Always clean up
and state the cleanup result in the report.

### 5.3 Authenticated-privilege probe (mint a real session)
To test what a **signed-in user** can do, mint a session using the service-role
key, exactly as the e2e fixture does (`tests/e2e/fixtures/auth.ts`):

1. `POST {URL}/auth/v1/admin/users` with the service key → create a throwaway user; capture its `id`.
2. `POST {URL}/auth/v1/admin/generate_link` (type `magiclink`) → get `email_otp`.
3. `POST {URL}/auth/v1/verify` with the anon key → get `access_token`.
4. Use that `access_token` as `Authorization: Bearer` for the probe.
5. **Always delete the throwaway user afterwards** (`DELETE {URL}/auth/v1/admin/users/{id}`) and report the cleanup status.

This is how you settle column-level GRANT questions, RLS `WITH CHECK` behavior,
and whether a user can re-point a row at another owner.

### 5.4 Enforcement-trigger probe
For each DB trigger/constraint you suspect is incomplete, **test the operation
the trigger does not cover**:

1. Create a throwaway user + profile.
2. Drive the resource to the limit through the path that *is* covered (e.g. insert N rows).
3. Perform the **uncovered** operation (soft-delete, re-activate, bulk update).
4. Count the resulting rows.
5. Compare against the limit.
6. Delete the throwaway user; report the cleanup.

**A trigger on INSERT does not cover UPDATE.** A trigger that counts `is_active = true`
at INSERT time does not constrain a later re-activation. Always test the
second path, not just the first.

### 5.5 What Phase 5 can and cannot settle
- ✅ Table-level and column-level privileges; RLS enablement and `WITH CHECK`; trigger coverage; CHECK constraints; default grants; RPC function bodies (via behavior).
- ❌ Anything requiring a real payment (do not place a live PayMongo order). Verify payment code by reading + unit tests, and state the limit.
- ❌ Anything behind a browser-only control (client-side JS gates) — those are provably bypassable and should be reported as such without probing.

**Every Phase 5 probe must appear in the report with its HTTP codes and its cleanup result.** A probe whose cleanup failed is a finding in its own right.

---

## Severity taxonomy

| Severity | Bar | Examples |
|---|---|---|
| **Critical** | Exploitable now, or a live secret is exposed | Table with RLS disabled reachable via the anon key; a control that never runs on the path that matters; live secret in a tracked file or git history; unauthenticated write endpoint; webhook accepting unsigned payloads; free-tier/business-rule bypass proven live |
| **High** | Real risk with a realistic path | Missing auth on a route; unbounded request body buffered before the size check; PII shipped to a third party unmasked; secret in the client bundle; a schema that cannot rebuild the database |
| **Medium** | Needs another condition, or real drift | Unsafe runtime type assertion causing a 500; wrong price in one surface; plan limit enforced in only one of three layers; stale route in the protected list; version drift |
| **Low** | Hygiene | Unused export; unused dependency; oversized file; unused Tailwind token; stale comment |
| **Info** | Worth knowing, no action required | Observation, tradeoff note, coverage gap |

Rules: one root cause = one finding, even if it appears in five files (list all five locations). Do not inflate severity. A finding without a concrete exploit path, consequence, and fix is at most Low.

---

## Output format

### Section 1 — Baseline
Verbatim Phase 0 output (trimmed to decisive lines) + the recorded metrics.

### Section 2 — Findings
One table, sorted by severity:

| # | Sev | Area | Location | Finding | Evidence | Fix |
|---|-----|------|----------|---------|----------|-----|
| F1 | Critical | AuthZ | `src/app/api/leads/[id]/route.ts:42` | UPDATE does not scope by `user_id`; any authenticated user can rewrite any lead | code quote | add `.eq("user_id", user.id)` before `.update()` |

Then a detail block for Critical and High only:

```
### F1 — [Critical] Title
**Where:** path:line (plus every other affected location)
**What:** the defect, in plain language
**Evidence:** the quoted code, and the command/probe output that proves it
**Impact:** who can do what they shouldn't, and what it costs
**Fix:** the specific change — file, function, and the exact shape of the correction
**Verify:** the command or test that proves the fix works
```

### Section 3 — Phase 5 probe log
Every probe: purpose · request · HTTP code(s) · response excerpt · cleanup status. This section must be present even if every probe passed — it is the evidence that the checks ran.

### Section 4 — Needs Verification
Things you suspect but could not prove, each with the exact command that would prove it.

### Section 5 — Dead code inventory
| path | kind | evidence | safe to delete? | notes |

### Section 6 — Redundancy map
| concern | locations | verdict (single source of truth / duplicated / contradictory) | proposed consolidation |

### Section 7 — Fix plan
Ordered fix batches. Each: what changes, which files, whether behavior changes (and therefore needs a test), and the verification command. Order = security → leaks → dead code → redundancy. Small independent batches; each must leave the tree green.

### Section 8 — What I did not check
Explicit list of skipped scope and why. No silent gaps.

---

## Fix Policy

Apply fixes **only after** presenting the full report, and only in the order the report recommends.

- **Batch size:** one concern per batch. Never mix a security fix with a refactor.
- **Every batch must leave the tree green:** `npm run lint && npx tsc --noEmit && npm test && npm run build`.
- **Behavior changes need a test.** Add or update a Vitest test (units/logic) or Playwright spec (flows) in the same batch. A fix with no test can regress silently.
- **A test that asserts an unreachable guard must be rewritten to assert the reachable path.** If a test proves `/api/leads/[id]` is rate-limited but the app never calls that route, the test is security theater — say so, and replace it with a test against the path that actually runs.
- **Deletions:** remove the file AND its references in one batch. Never leave an import pointing at a deleted path.
- **No silent behavior changes.** If a fix requires a product decision (which price is correct, which plan names are canonical), stop and ask.
- **Guardrail rule:** if a test fails after a security fix, check whether the test was asserting the vulnerable behavior. If so, fix the test and say so. Never disable a test or loosen an assertion to make a batch pass.
- **If a fix requires a DB change**, write it as a new numbered migration in `supabase/migrations/` with a comment explaining the vulnerability it closes — never edit an already-applied migration.

---

## Agent delegation

Run the four workstreams in parallel where the tools allow:

| Workstream | Agent | Focus |
|---|---|---|
| Security (1.1–1.11) | `security-reviewer` | Auth, authz, parallel write paths, payments, injection, headers |
| Leaks (Phase 2) | `security-reviewer` | Secrets, PII, logs, third-party boundaries, replay, service-worker cache |
| Dead code (Phase 3) | `refactor-cleaner` | Unused files/exports/deps/config, unreachable controls |
| Redundancy (Phase 4) | `explore` (very thorough) | Duplication, drift, cross-file consistency |

Before spawning, give each agent the **Non-negotiable rules** and the **Severity taxonomy** verbatim, plus the specific file lists above. Insist on `file:line` evidence from every agent — **do not relay a sub-agent's conclusion without checking its cited lines yourself.**

Reconcile: a finding reported by two agents is one finding; one confirmed by you is a finding; one you could not confirm goes to "Needs Verification".

**Phase 5 is never delegated** — run it yourself, sequentially, so probe cleanup is guaranteed.

---

## Definition of done

- [ ] Baseline recorded verbatim
- [ ] All 11 security sub-sections read end to end — no sampling
- [ ] Parallel write-path table built for every client write
- [ ] Enforcement-layer coverage matrix built for every business rule
- [ ] Every route handler and server hook enumerated in the authz matrix
- [ ] Every RLS-disabled / ungranted table identified
- [ ] Git history scanned for each secret shape, hits classified as live vs placeholder
- [ ] Every file in `src/`, `scripts/`, `supabase/`, `docs/` classified live or dead
- [ ] Every direct dependency and every custom Tailwind token accounted for
- [ ] Every duplicated value cross-checked across all its locations, disagreements listed
- [ ] Phase 5 probes run with HTTP codes recorded and **cleanup verified**
- [ ] Every finding has `file:line` + quoted evidence + a specific fix
- [ ] Unconfirmed suspicions are in "Needs Verification", not in Findings
- [ ] Fix batches applied in order, each green
- [ ] Final `lint` / `tsc` / `test` / `build` output shown
- [ ] Working tree diff explained; no commit, branch, or push performed
- [ ] "What I did not check" filled in

## PROMPT END

---

## Appendix A — Verified findings from the reference run

These were produced by running this exact method against `main` @ `6b4e382`
(Oct 21 2026). Treat them as **leads to re-verify**, not as pre-verified facts —
the environment may have changed. Each cites its evidence.

### Critical

| # | Finding | Evidence |
|---|---|---|
| C1 | **`webhook_events` has RLS disabled and no grant restriction → full anon CRUD with the public anon key.** The table is the dedup anchor for payment state transitions. `supabase/migrations/006_create_webhook_events.sql:20` runs `ALTER TABLE webhook_events DISABLE ROW LEVEL SECURITY;` with no matching `REVOKE ... FROM anon, authenticated`. Probed live: SELECT → 200, INSERT → **201**, UPDATE → **204**, DELETE → **204**. Consequence: an attacker can pre-insert a row with `status='processed'` for a `paymongo_event_id`, so when PayMongo delivers that event `src/app/api/paymongo/webhook/route.ts:92-94` treats it as a duplicate and **never processes it** (a paid subscription never activates, a cancellation is never recorded); or flip a `failed`/`pending` event to `processed` to permanently suppress PayMongo's retry; or read the whole billing event trail including `error_message`. Fix: `REVOKE ALL ON TABLE public.webhook_events FROM anon, authenticated;` (service_role keeps its grants — service_role bypasses RLS regardless). | Phase 5.2 probe |
| C2 | **The server-side security layer for leads is unreachable.** `POST /api/leads`, `PUT /api/leads/[id]`, `DELETE /api/leads/[id]` are **never called by the app** — the only callers are tests. The browser writes directly to PostgREST: `src/app/(dashboard)/leads/new/page.tsx:69` (insert), `src/app/(dashboard)/leads/[id]/edit/page.tsx:103` (update), `src/app/(dashboard)/leads/[id]/lead-detail-client.tsx:26` (soft-delete), `src/hooks/useLeads.ts:65` (`updateLead`). Therefore the Zod schemas, the rate limits (100/30/30 per min), the plan-limit enforcement, and the SEC-004 re-activation guard on those routes **never execute in production**. Only `/api/leads/import` and `/api/paymongo/*` are actually called. | `grep -rn '"/api/leads' src/` → 1 hit, the import page only |
| C3 | **The free-tier cap can be exceeded, proven live.** The DB trigger covers INSERT only. Probed: 10 active leads → soft-delete 5 → create 5 new (back to 10) → `PATCH is_active=true` on the 5 soft-deleted → **204, final active count 15** (limit is 10). The DB has no trigger on UPDATE. The app's SEC-004 guard in `src/app/api/leads/[id]/route.ts:75-117` would catch it — but per C2 the app never calls that route. Fix: add an `AFTER UPDATE` trigger enforcing the cap, or route all writes through a server-side path. | Phase 5.4 probe |

### High

| # | Finding | Evidence |
|---|---|---|
| H1 | **CSV import buffers an unbounded body before validating it.** `src/app/api/leads/import/route.ts:43` calls `await request.formData()` — the entire body is already in memory — and only then checks `file.size > MAX_FILE_SIZE` at line 81. The alternate channel (the `leads` JSON field, lines 53-73) has **no size check at all**, only a 10,000-row count check. Memory-exhaustion DoS from one authenticated request; the rate limiter is 5/min and per-instance. | read of route |
| H2 | **The `leads` JSON channel is never schema-validated.** `JSON.parse(leadsJson)` at line 56, then `lead.full_name.trim()` (line 131) and `lead.email.trim()` (line 140) on untyped data. A non-string `email` (e.g. `123`) or a `null` element throws an unhandled `TypeError` → 500. | read of route |
| H3 | **`formData.get("file")` is cast to `File` without a runtime check.** Line 76: `as File | null`. A string field named `file` yields `file.size === undefined`, which passes the size check, then `await file.text()` throws → 500. | read of route |
| H4 | **Sentry Session Replay ships PII to a third party, and the repo's scrubber does not cover it.** `src/sentry.client.config.ts:120` sets `replaysOnErrorSampleRate: 1.0` with **no** `beforeSendReplay`, no `maskAllText`, and no input masking. Sentry does **not** run `beforeSend` for replay events, so the thorough SEC-016 scrubber at lines 121-133 never touches them. A DOM replay of an authenticated leads page contains client names, emails, phone numbers, and notes. | read of config |
| H5 | **The repo cannot rebuild the schema; every RLS policy, trigger, and CHECK constraint lives only on the remote database.** `supabase/migrations/001_initial_schema.sql` is a 923-byte comment-only placeholder. The policies are therefore unreviewable from the repo, invisible to CI, and lost on any rebuild. | read of migration |

### Medium

| # | Finding | Evidence |
|---|---|---|
| M1 | **`PLAN_LIMITS[plan]` is indexed with an unchecked cast in 4 places.** `src/app/api/leads/route.ts:117-118`, `src/app/api/leads/[id]/route.ts:96-97`, `src/app/api/leads/import/route.ts:181-182`, `src/lib/plan-limit.ts:33-34`. `const plan: PlanType = (profile.plan as PlanType) \|\| "free"` is a type-level lie: any plan value outside `free\|pro\|team` makes `PLAN_LIMITS[plan]` `undefined` and `limits.maxActiveLeads` throws → 500. | read + `grep -rn "PLAN_LIMITS\["` |
| M2 | **`updateProfile`'s type permits billing columns.** `src/hooks/useProfile.ts:26` takes `ProfileUpdate` = `profiles.Update`, which includes `plan`, `subscription_status`, `paymongo_customer_id`. The DB column lockdown **does** block it (probed: authenticated `PATCH profiles.plan` → **403**), so the type is the only unguarded layer — and it is the layer a future caller will read. | Phase 5.3 probe |
| M3 | **The service worker caches authenticated, PII-bearing HTML in a shared, unpartitioned, non-expiring cache.** `public/sw.js:7-19` lists `/dashboard`, `/leads`, `/pipeline`, `/settings`, `/follow-ups` in `APP_SHELL`; the navigation handler (lines 55-70) caches every same-origin navigation response keyed only by URL. After sign-out — or for a second account on the same device — an offline load of `/leads` serves the previous user's cached HTML with names, emails, and phone numbers. `caches.match("/")` can serve a cached dashboard. | read of sw.js |
| M4 | **The service worker cache name is never versioned** (`CACHE_NAME = "agentflow-v1"`), so stale authenticated HTML persists indefinitely across deploys. | read of sw.js |
| M5 | **Three different version numbers.** `package.json` = `0.1.0`; latest git tag = `v0.41.4` (with inconsistent `v2026.05.29-<hash>` tags); latest changelog entry = `0.28.0`. | `git tag`, `package.json`, `src/data/changelog.ts` |
| M6 | **A personal Gmail is published in the public README** (`ryan.gabrielle01@gmail.com`, 2 places) while the product uses `support@agent-flow.app` everywhere. Personal data in a public repo, a spam magnet, and drift from the support address. | `grep` |
| M7 | **CSP allows `'unsafe-inline'` in `script-src` in production** (`next.config.mjs:8`); no `object-src 'none'`; `img-src 'self' data: blob: https:` is a wildcard. | read of config |
| M8 | **The price is duplicated in five places with a dollars/cents split.** `src/lib/paymongo.ts:101-102` (800 / 8000 cents), `src/lib/pricing-data.ts` (`monthlyPrice: 8`, `annualPrice: 80` dollars), `src/app/(dashboard)/settings/billing/page.tsx:201,238,251,263` (`"$8/mo"`, `"$80/yr"` strings), `src/app/(dashboard)/settings/page.tsx:108`, `src/app/layout.tsx:101,114,120` (JSON-LD `"8"`). No shared constant — a unit mistake is one edit away. | `grep` across surfaces |
| M9 | **Two of three feature flags gate nothing.** `isFeatureEnabled` is called exactly once in the app (`src/app/(dashboard)/leads/leads-client.tsx:223`, for `csv_import`). `pipeline` and `bulk_actions` are never consulted. | `grep -rn isFeatureEnabled src/` |
| M10 | **`npm audit` reports a CRITICAL advisory on the installed `next`.** `next@16.3.2` falls in the affected range `16.0.0 - 16.3.7` (GHSA-p293-qw3h-jr36, unauthenticated RCE), plus 4 high. Any status file claiming "0 vulnerabilities" is stale. | `npm audit --omit=dev` |
| M11 | **Lead create/edit on the client path has no schema validation.** `src/app/(dashboard)/leads/new/page.tsx:69` and `src/app/(dashboard)/leads/[id]/edit/page.tsx:101-113` write `full_name`, `email`, `phone`, `notes` with no Zod and no length caps — the `leadSchema` limits (name ≤ 100, notes ≤ 1000, email format) exist only on the unreachable API route. | read of both pages |

### Low

| # | Finding | Evidence |
|---|---|---|
| L1 | **Dead exports:** `createLead`, `deleteLead` (`src/hooks/useLeads.ts`); `ActionInput`, `ActionUpdateInput`, `CheckoutBodyInput`, `LeadInput`, `LeadUpdateInput` (`src/lib/validations.ts`); `Json` re-export (`src/types/index.ts`); `export { getResendClient as resend }` (`src/lib/resend.ts`). | dead-export scan |
| L2 | **Self-only exports (the `export` keyword is unnecessary):** 13 symbols across `paymongo.ts`, `utils.ts`, `pricing-data.ts`, `feature-flags.ts`, `resend.ts`, `cookie-consent.tsx`. | dead-export scan |
| L3 | **`@vitejs/plugin-react` is an unused devDependency** — `vitest.config.ts` declares no `plugins` array and never imports it. | read of config |
| L4 | **`PROTECTED_PATHS` contains a stale entry.** `src/lib/supabase/middleware.ts:16` lists `/api/pipeline`; no such route exists. | route list vs constant |
| L5 | **`src/app/(dashboard)/layout.tsx` is a pure pass-through wrapper** adding an indirection layer between the route group and `DashboardLayout`. | read |
| L6 | **The rate limiter's Map never evicts expired entries** — `src/lib/rate-limiter.ts:25` only resets a key when that key is touched again. | read |
| L7 | **The coverage denominator excludes the two most security-sensitive routes.** `vitest.config.ts` excludes `src/app/api/leads/import/route.ts` and `src/app/api/export/route.ts`, and only measures `src/lib/**` + `src/app/api/**` — components, hooks, and pages are outside it entirely. The 80% threshold therefore says little about the app. | read of config |
| L8 | **Off-by-one truncation in the import route.** `full_name` is sliced to 101 while the schema caps it at 100; `email` to 256 while the message says "exceeds 255". | read of route |
| L9 | **The auth callback logs whole error objects.** `src/app/auth/callback/route.ts` — `console.error("...", exchangeError)` and `console.error("...", err)`; a driver error object can carry a response body. | read |
| L10 | **`resetRateLimiter` is referenced only in test mocks**, never in app code. | `grep` |
| L11 | **The digest cron logs `error?.details`**, which describes database schema. `src/app/api/cron/daily-digest/route.ts:29`. | read |
| L12 | **The digest sends emails serially** in a `for` loop (`src/app/api/cron/daily-digest/route.ts:48-51`) — beyond the cron time budget, users silently receive nothing and the route still reports a partial count. | read |
| L13 | **The digest email links to `/follow-ups`, which is not in the sidebar nav** (`src/lib/resend.ts:56`), while the dashboard still links to it 3 times. Inconsistent IA. | `grep` |

### Verified-clean (spot-check only)

| Check | Result |
|---|---|
| Auth gate | `src/lib/supabase/middleware.ts` fails **closed** on missing env and on thrown `getUser()` |
| PayMongo signature | Raw body read before parsing; HMAC over `<timestamp>.<body>`; constant-time compare; replay window enforced |
| `profiles` plan lockdown | migration 007 — probed live: `PATCH profiles.plan` → **403**; `full_name`/`brokerage` → **200** |
| `profiles` INSERT | anon → **401** "new row violates row-level security policy" |
| `leads` ownership | `PATCH leads.user_id` to another owner → **403** RLS `WITH CHECK` |
| `leads.pipeline_stage` | DB CHECK constraint `leads_pipeline_stage_check` rejects arbitrary values — the RPC path is **not** a validation gap |
| Free-tier INSERT | DB trigger rejects the 11th active lead (`P0001`) |
| Sentry error scrubbing | `beforeSend` scrubs request, breadcrumbs, exceptions (emails/phones/UUIDs) |
| Service worker cross-origin | Cross-origin requests are skipped on both read and write paths |
| `console.*` in `src/` | 0 matches in production code (only `console.error` in middleware/crons) |
| `: any` / `as any` | 0 matches |
| `dangerouslySetInnerHTML` | 1 site only — `src/app/layout.tsx` JSON-LD, static app metadata |
| Health endpoint | Returns only `{status, timestamp}` — no internal detail |
| Auth redirect | `src/app/auth/callback/route.ts` validates same-origin (`resolved.origin === origin`) — `//evil.com` is rejected |
| Dead files | Every file in `src/components`, `src/hooks`, `src/lib`, `src/data` has an importer |
| Route reachability | Every app route is linked from nav, footer, dashboard, sitemap, or email |

---

## Appendix B — Command reference

```bash
# Baseline
npm ci && npm run lint && npx tsc --noEmit && npm test && npm run build
npm audit --omit=dev --audit-level=high

# Reachability (no network)
grep -rn "process\.env\." src/ | sort -u
grep -rn "console\." src/ | wc -l
find src -name '*.ts' -o -name '*.tsx' | xargs wc -l | sort -rn | head -20

# Parallel write paths — the highest-value single command in this audit
grep -rn '\.update(\|\.insert(\|\.upsert(\|\.delete()\|\.rpc(' src/hooks/ 'src/app/(dashboard)' src/components/ | grep -v 'select('
grep -rn '"/api/' src/ | grep -v 'app/api'

# Unused-export discovery (primary — TS-aware)
npx --yes knip@latest --no-progress

# Fallback without knip (tested)
cat > /tmp/deadexports.sh <<'EOF'
#!/usr/bin/env bash
cd "$(git rev-parse --show-toplevel)" || exit 1
FILES=$(find src -name '*.ts' -o -name '*.tsx')
for f in $FILES; do
  names=$( { grep -oE '^export (async )?(function|const|let|class|type|interface|enum) [A-Za-z0-9_]+' "$f" \
             | sed -E 's/^export (async )?(function|const|let|class|type|interface|enum) //'
             grep -oE '^export (type )?\{[^}]*\}' "$f" \
             | sed -E 's/^export (type )?\{//; s/\}//' | tr ',' '\n' \
             | sed -E 's/^ *//; s/ *$//; s/ .*//' | grep -E '^[A-Za-z0-9_]+$'
           } | sort -u )
  for sym in $names; do
    ext=$(grep -rl "\b$sym\b" $FILES tests/ 2>/dev/null | grep -v "^$f$" | wc -l)
    own=$(grep -c "\b$sym\b" "$f" 2>/dev/null)
    if [ "$ext" -eq 0 ]; then
      if [ "$own" -le 1 ]; then echo "DEAD      $f :: $sym"
      else echo "SELF-ONLY $f :: $sym (own-file refs: $own)"; fi
    fi
  done
done
EOF
bash /tmp/deadexports.sh
# Exclude Next.js framework entry points (src/app/** default exports, instrumentation.ts,
# middleware.ts, sentry.*.config.ts) — they are consumed by convention, not by imports.

# Secret-shape scan (working tree)
git ls-files | xargs grep -lnE "sk_(test|live)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|vcp_[A-Za-z0-9]+|re_[A-Za-z0-9]{20,}|eyJhbGciOiJ[A-Za-z0-9_-]{20,}" 2>/dev/null

# Secret-shape scan (full history) — classify live vs placeholder
git log --all -p -S 'sk_live_' -- . | grep -oE 'sk_live_[A-Za-z0-9_]+' | sort -u
git log --all -p -S 'whsec_'   -- . | grep -oE 'whsec_[A-Za-z0-9_]+' | sort -u
git log --all -p -S 'postgres://' -- . | grep -oE 'postgres(ql)?://[^ "]+' | sort -u

# Ignore correctness
git check-ignore -v .env.local AGENTS.md scripts/ brag-output/ 2>/dev/null
git ls-files | xargs grep -ln "SUPABASE_SERVICE_ROLE_KEY" 2>/dev/null

# Phase 5.1 — anon privilege probe (read)
set -a && . ./.env.local && set +a
curl -s -o /dev/null -w "HTTP %{http_code}\n" "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/<table>?select=*&limit=3" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"

# Phase 5.3 — mint an authenticated session (see tests/e2e/fixtures/auth.ts)
#  1) POST /auth/v1/admin/users           (service key)  -> user.id
#  2) POST /auth/v1/admin/generate_link  (service key)  -> email_otp
#  3) POST /auth/v1/verify                (anon key)     -> access_token
#  4) probe with Authorization: Bearer <access_token>
#  5) DELETE /auth/v1/admin/users/{id}    (service key)  -> CLEANUP, always
```

---

## Appendix C — Reference-run baseline

| Check | Result |
|---|---|
| Branch / HEAD | `main` @ `6b4e382` |
| Lint | 0 errors, 9 warnings (all `react-hooks/set-state-in-effect` / `react-hooks/refs`, downgraded to warn in `eslint.config.mjs`) |
| TypeScript | 0 errors |
| Unit tests | 389 / 389 passing, 32 files |
| Build | success, 26 routes |
| `npm audit --omit=dev` | **5 vulnerabilities (4 high, 1 critical)** — the critical one is `next@16.3.2` |
| `npm ci` | 820 packages, ~14s, 33 vulnerabilities incl. dev |
| Probe hygiene | 3 throwaway users + 1 probe row created and deleted; all cleanups returned 200/204; verification queries returned empty |

---

## Appendix D — Findings discovered while fixing (v3)

These were **not** in the original audit. Every one of them was found by
performing the fixes rather than by reading the code — which is the argument
for fixing findings instead of only writing them up.

| # | Finding | How it surfaced | Class added to v3 |
|---|---|---|---|
| D1 | **The PayMongo retry loop returned the error body as a success on the final attempt.** `payMongoFetch` did `if (attempt < MAX_RETRIES) { …; continue; }` and then fell through to `return (await response.json()) as T`. After four 5xx responses the error body was handed back as if it were valid — so `cancelPayMongoSubscription` reported success while the subscription stayed live and kept billing, and `result.data.id` was `undefined` for the customer/subscription paths. | A test that mocked the transport to fail on every attempt and asserted the call **rejects**. The "succeeds on the second attempt" case passed; only the exhausted case exposed it. | 1.13 |
| D2 | **The coverage gate had been failing on `main`** — 69.05% lines against an 80% threshold, while the CI workflow's own gate expected 75%. Every PR would have been blocked at the unit-tests step. Root cause: three route files sat at 0% coverage, and `src/lib/paymongo.ts` at 42%. | Running the CI command (`npx vitest run --coverage`) rather than `npm test`. Confirmed pre-existing by stashing. | 3.8 |
| D3 | **The two routes excluded from the coverage denominator were excluded because they only had source-assertion tests** — tests that read the file and matched a string. The import route, the app's most security-sensitive endpoint, was covered by regex assertions over its own source. | Reading what the excluded files' "tests" actually did. | 3.8 |
| D4 | **The lockfile was written by a different npm than CI uses.** `npm uninstall` under npm 11 produced a lockfile npm 10 rejected with `EUSAGE … Missing: proxy-agent@8.0.2 from lock file` — CI would have failed on `npm ci` for a reason that looked like a network error. | `npx -p npm@10 npm ci` after every lockfile change, not just at the end. | 1.12 |
| D5 | **`src/lib/feature-flags.ts` registered two flags that gated nothing.** `isFeatureEnabled` was called exactly once in the whole app. A flag that reads like a live switch but is never consulted is worse than no flag: an operator sets `NEXT_PUBLIC_FEATURE_PIPELINE=false` and nothing happens. | The dead-export scan surfaced the flag enum; a grep for `isFeatureEnabled(` found the single call site. | 3.9 (same shape) |
| D6 | **The `actions` table has no writer.** It is read by the lead detail page and by the data export, and written by nothing — so the action history is always empty and the export always ships `actions: []`. | `grep -rn 'from("actions")' src/ -A3 \| grep -E "insert\|update\|delete"` → no results. | 3.9 |
| D7 | **The Pro price was written out in five places across two units** — 800 cents in the payment library, 8 dollars in the pricing module, `$8/mo` as a literal string in three UI surfaces, and `"8"` in the JSON-LD. | Cross-checking every surface during the redundancy pass. | 3.10 |
| D8 | **The checkout URL was navigated to without a host check.** `window.location.href = data.url` where the URL came from an API response — an open redirect the moment that response was tampered with. | Reading the payment flow end to end rather than only the server side. | 2.6 |
| D9 | **The session-replay sample rates were inert, not leaking.** `@sentry/nextjs` v10 does not add the replay integration by default, so `replaysOnErrorSampleRate: 1.0` did nothing — but the config claimed replay was on, and `beforeSend` does not run for replay events. The landmine was that registering the integration later would have started an unmasked DOM capture of client PII. | Checking whether `replayIntegration` was exported and called, not just whether the option was set. | 2.5 (corrected) |
| D10 | **The service worker cached authenticated HTML in a shared, unpartitioned, never-expiring cache** — `/leads`, `/dashboard`, `/pipeline`, `/settings` were all in the app shell. | Reading `public/sw.js` against the list of protected routes. | 2.5 |

### The lesson worth carrying forward

None of D1–D10 would have been found by a more careful read of the same code.
D1 came from a test asserting a specific failure mode. D2 came from running
the CI command rather than `npm test`. D4 came from checking the lockfile
against CI's npm. D6 came from a grep for the write side of a table. D9 came
from checking whether an integration was registered rather than whether an
option was set.

**Run the thing. Then write the finding.**

