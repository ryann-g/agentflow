-- Migration: 004_create_webhook_events
-- Creates the table used to deduplicate and track PayMongo webhook deliveries.

CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paymongo_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status
  ON webhook_events (status)
  WHERE status IN ('pending', 'failed');

-- Webhook events are written by the service-role client only.
-- Disable RLS so the service client does not need a policy here.
ALTER TABLE webhook_events DISABLE ROW LEVEL SECURITY;

-- Documentation comments
COMMENT ON TABLE webhook_events IS 'Audit log and deduplication store for PayMongo webhook deliveries.';
COMMENT ON COLUMN webhook_events.paymongo_event_id IS 'The event ID sent by PayMongo in the webhook payload (e.g., evt_xxx).';
COMMENT ON COLUMN webhook_events.status IS 'pending | processed | failed. Used to avoid re-processing and to retry failed events.';
