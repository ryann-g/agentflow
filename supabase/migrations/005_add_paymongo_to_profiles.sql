-- Migration: 003_add_paymongo_to_profiles
-- Adds PayMongo billing columns and grace period support

-- Add PayMongo billing columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS paymongo_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS paymongo_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_interval TEXT DEFAULT 'month',
  ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ;

-- Ensure subscription_status has a default (may already exist from earlier)
ALTER TABLE profiles
  ALTER COLUMN subscription_status SET DEFAULT 'active';

-- Index for billing cron lookups (grace period expiry)
CREATE INDEX IF NOT EXISTS idx_profiles_grace_period
  ON profiles (grace_period_ends_at)
  WHERE grace_period_ends_at IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN profiles.paymongo_customer_id IS 'PayMongo Customer ID (cus_xxx)';
COMMENT ON COLUMN profiles.paymongo_subscription_id IS 'PayMongo Subscription ID (sub_xxx)';
COMMENT ON COLUMN profiles.subscription_status IS 'active, past_due, cancelled, incomplete';
COMMENT ON COLUMN profiles.subscription_interval IS 'month or annual';
COMMENT ON COLUMN profiles.grace_period_ends_at IS 'When the 3-day grace period ends after failed payment; NULL if not in grace';
