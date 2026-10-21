-- Migration 008: close the two Critical findings from the Oct 21 2026 audit.
--
-- (1) webhook_events was created with RLS disabled (migration 006) and no
--     grant restriction. Supabase's default privileges grant ALL on new
--     `public` tables to `anon` and `authenticated`, so the public anon key —
--     which ships in the client bundle — could SELECT / INSERT / UPDATE /
--     DELETE the table. Probed live on Oct 21 2026: SELECT 200, INSERT 201,
--     UPDATE 204, DELETE 204.
--
--     That table is the dedup anchor for PayMongo webhook processing. An
--     attacker could insert a row with status='processed' for a real
--     `paymongo_event_id`; the webhook route then sees a unique violation,
--     reads status='processed', and acknowledges the genuine delivery as a
--     duplicate WITHOUT applying the subscription change
--     (src/app/api/paymongo/webhook/route.ts). Net effect: a paid
--     subscription never activates, or a cancellation is never recorded.
--     The same write access also exposes the whole billing event audit trail
--     (event ids, statuses, and `error_message`) to anyone with the anon key.
--
--     Fix: revoke the default grants and enable RLS. `service_role` has
--     BYPASSRLS, so the webhook route and cron jobs — the only legitimate
--     writers — are unaffected. No policy is created on purpose: with RLS
--     enabled and no policy, anon/authenticated are denied, which is exactly
--     the intent.
--
-- (2) check_free_tier_lead_limit (migration 002) only guarded INSERT. The
--     free-tier cap of 10 active leads could be exceeded by soft-deleting
--     leads and then re-activating them via UPDATE, which the INSERT trigger
--     never sees. Probed live: 10 active → soft-delete 5 → create 5 (back to
--     10) → PATCH is_active=true on the 5 soft-deleted → HTTP 204, final
--     active count 15.
--
--     Fix: fire the same check on the UPDATE transition that consumes a slot,
--     so the cap is enforced by the database on every write path — including
--     the browser's direct PostgREST writes, which never pass through
--     /api/leads/[id].

-- ── (1) Lock webhook_events down to service_role ────────────────────────

REVOKE ALL ON TABLE public.webhook_events FROM anon;
REVOKE ALL ON TABLE public.webhook_events FROM authenticated;
-- Drop the implicit PUBLIC grant too, so a future ALTER DEFAULT PRIVILEGES
-- change cannot silently re-open the table.
REVOKE ALL ON TABLE public.webhook_events FROM public;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.webhook_events IS
  'Audit log and deduplication store for PayMongo webhook deliveries. Service-role only: RLS enabled with no policy, so anon/authenticated are denied.';

-- ── (2) Enforce the free-tier cap on re-activation too ──────────────────

-- Same limit as migration 002, with two changes:
--   * `SET search_path = public` — the SECURITY DEFINER function previously
--     resolved `profiles` and `leads` through the caller's search_path.
--   * the check runs only when the operation actually consumes a slot, so
--     soft-deletes and no-op updates are unaffected.
CREATE OR REPLACE FUNCTION public.check_free_tier_lead_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_plan TEXT;
  lead_count BIGINT;
BEGIN
  -- Only an INSERT of an active lead, or an UPDATE that flips an inactive
  -- lead back to active, consumes a free-tier slot.
  IF NEW.is_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_active IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT plan INTO current_plan FROM profiles WHERE id = NEW.user_id;
  IF current_plan IS DISTINCT FROM 'free' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO lead_count
    FROM leads
    WHERE user_id = NEW.user_id AND is_active = true;

  IF lead_count >= 10 THEN
    RAISE EXCEPTION 'Free tier limited to 10 active leads. Upgrade to Pro for unlimited.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- Re-create the trigger so it also fires on UPDATE. `UPDATE OF is_active`
-- means the trigger only runs when is_active appears in the SET list, so
-- pipeline_stage-only updates (including bulk_update_leads) are not charged
-- against the cap.
DROP TRIGGER IF EXISTS trg_check_free_tier_lead_limit ON public.leads;

CREATE TRIGGER trg_check_free_tier_lead_limit
BEFORE INSERT OR UPDATE OF is_active ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.check_free_tier_lead_limit();

COMMENT ON FUNCTION public.check_free_tier_lead_limit() IS
  'Enforces the free-tier cap of 10 active leads on INSERT and on the is_active false->true re-activation transition.';
