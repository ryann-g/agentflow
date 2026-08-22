# 3. PayMongo immediate cancellation with paid-through grace

Date: 2026-08-22
Status: Accepted

## Context

PayMongo's Subscriptions cancel **immediately** — there is no Stripe-style
"cancel at period end" flag, and the documented webhook catalog has no
`subscription.cancelled` event (cancellations arrive as
`subscription.updated` with `status = "cancelled"`). Naively honoring the
webhook would revoke Pro access the moment a customer cancels, including
access they already prepaid through `next_billing_schedule`.

Separately, three of the four event names the integration originally
handled (`invoice.paid`, `invoice.payment_failed`,
`subscription.cancelled`) do not exist upstream; invoice events carry the
subscription reference in `attributes.resource_id`, not `data.id`.

## Decision

- Webhook routing follows the official catalog only:
  `subscription.activated | updated | past_due | unpaid` and
  `subscription.invoice.paid | payment_failed`.
- On cancellation we snapshot `next_billing_schedule` (cancel API response
  flow) into `profiles.grace_period_ends_at` and keep `plan = "pro"`; the
  billing-check cron downgrades once that date passes.
- The same grace column serves failed-payment recovery, so the cron query
  keys on expired grace rather than subscription status.
- Plan/currency are env-overridable (`PAYMONGO_CURRENCY`,
  `PAYMONGO_MONTHLY_AMOUNT`, `PAYMONGO_ANNUAL_AMOUNT`) because Subscriptions
  are PHP-first while current pricing is USD.

## Consequences

- Customers keep what they paid for; revenue timing matches entitlements.
- Any future code path that clears `grace_period_ends_at` on cancel would
  silently reintroduce early revocation — treat that column as load-bearing.
- Event-name drift is now guarded by unit tests over the routing layer;
  new PayMongo event types must be added to the router explicitly.
