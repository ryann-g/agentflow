-- Migration 007: Lock down profiles UPDATE to user-editable columns only.
--
-- VULNERABILITY (confirmed against live DB, Aug 2026 audit):
--   The "Users can update own profile" policy is row-scoped only —
--     FOR UPDATE USING (auth.uid() = id)
--   — and `authenticated` held table-wide UPDATE via GRANT ALL. Postgres RLS
--   filters ROWS, not COLUMNS, so any signed-in user could PATCH their own
--   profiles row with { "plan": "pro" } (or subscription_status /
--   stripe_customer_id) using the public anon key + their JWT and self-upgrade
--   to Pro without paying.
--
-- FIX: column-level privileges. Users may edit exactly the fields the app's
-- profile-edit form exposes (full_name, brokerage). Email changes belong to
-- Supabase Auth (auth.users), not this table. Billing columns become
-- service-role/webhook-only in practice.
--
-- service_role is unaffected (its GRANT ALL is separate). anon keeps its
-- default grants but no policy ever yields a visible row for it.

REVOKE UPDATE ON TABLE public.profiles FROM authenticated;

GRANT UPDATE (full_name, brokerage)
  ON TABLE public.profiles
  TO authenticated;
