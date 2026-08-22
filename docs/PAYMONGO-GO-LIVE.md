# PayMongo Go-Live Checklist

Code is production-ready once these account/config steps complete.

## 1. Account enablement
- [ ] Email support@paymongo.com to **enable Subscriptions** on the account (required per docs)
- [ ] Activate **Visa/Mastercard** (+ Maya if offered) payment methods; cards require Card Vaulting via Customer objects — already implemented (`getOrCreatePayMongoCustomer`)
- [ ] Confirm currency: defaults are `usd` $8/$80. PayMongo Subscriptions are PHP-first; if USD plans are rejected or you prefer PHP pricing, set before first charge:
  ```
  PAYMONGO_CURRENCY=PHP
  PAYMONGO_MONTHLY_AMOUNT=45000    # centavos → ₱450/mo
  PAYMONGO_ANNUAL_AMOUNT=450000    # ₱4,500/yr
  ```

## 2. Vercel environment variables (Production)
| Key | Purpose |
|---|---|
| `PAYMONGO_SECRET_KEY` | sk_live_… — checkout/cancel/plan APIs |
| `PAYMONGO_WEBHOOK_SECRET` | per-endpoint signing secret (from step 3) |
| `CRON_SECRET` | already set — gates both cron routes |

No publishable key is used (checkout is fully server-side redirect).

## 3. Webhook endpoint registration (Dashboard → Developers → Webhooks)
- URL: `https://agent-flow.app/api/paymongo/webhook`
- Subscribe to exactly:
  - `subscription.activated`
  - `subscription.updated`
  - `subscription.past_due`
  - `subscription.unpaid`
  - `subscription.invoice.paid`
  - `subscription.invoice.payment_failed`
- Copy the endpoint's **signing secret** into `PAYMONGO_WEBHOOK_SECRET`.
- Note: there is no `subscription.cancelled` event — cancellations arrive as
  `subscription.updated` with `status=cancelled`; paid-through access is
  honored via `grace_period_ends_at` and revoked by the billing cron.

## 4. Cron
`vercel.json` registers both jobs (digest 08:00Z, billing-check 09:00Z).
Billing-check downgrades profiles whose `grace_period_ends_at` has passed
(failed-payment grace AND cancelled-paid-through access).

## 5. Test-mode smoke test
1. Switch dashboard to Test mode → grab `sk_test_…`, create webhook w/ test secret.
2. Upgrade a real account via `/settings/billing` using card `4343 4343 4343 4345`, any future expiry, any CVC.
3. Assert: hosted page redirects back; profile shows `plan=pro`;
   `webhook_events` row status `processed` for `subscription.invoice.paid`.
4. Cancel from billing page → status `cancelled`, grace date shown,
   cron (or manual GET with CRON_SECRET) downgrades after it passes.
5. Unpaid path: trigger `subscription.unpaid` from dashboard resend tooling → immediate downgrade.

## 6. Known behaviors / limits
- First unpaid checkout auto-cancels after 24h (`incomplete_cancelled`);
  retrying upgrade creates a fresh subscription and overwrites the stored id.
- Cancellation is immediate at PayMongo; app-side end-of-period access is our
  own grace mechanism — do not remove `grace_period_ends_at` handling.
- Plan ids are cached in-memory per lambda instance; safe.
