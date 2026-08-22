# 2. Client-direct writes & in-memory rate limiting

Date: 2026-08-22
Status: Accepted

## Context

AgentFlow's UI mutates lead data two ways: most writes go **directly from the
browser to Supabase PostgREST** (anon key + RLS), while CSV imports and all
billing operations go through Next.js API routes. Application-level rate
limiting (`src/lib/rate-limiter.ts`) therefore only covers the API-route
paths, and it uses a per-instance in-memory Map that resets on every
serverless cold start.

## Decision

1. Keep client-direct writes as the primary mutation path.
2. Accept the in-memory limiter as-is for the routes that have it.

Correctness on the hot path is enforced by layers that cannot be bypassed:
Row-Level Security scopes every row to its owner, a DB trigger enforces the
free-tier lead cap, and CHECK constraints pin enum columns. Rate limiting is
an anti-abuse nicety here, not an authorization control — losing it on the
client path costs noise, not integrity.

## Consequences

- No app-level request throttling applies to browser→PostgREST traffic;
  abuse surfaces as Supabase usage/bandwidth instead of our CPU.
- The in-memory limiter is best-effort per warm instance; distributed
  attacks are not throttled. Documented inside the module itself.
- Revisit triggers: (a) any sign of scripted abuse, (b) multi-tenant or
  team features where one user's traffic can degrade another's, (c) moving
  sensitive mutations off RLS-trust onto privileged RPCs. At that point,
  route writes through API handlers (or add Upstash/KV middleware limiting)
  as one coherent change.
