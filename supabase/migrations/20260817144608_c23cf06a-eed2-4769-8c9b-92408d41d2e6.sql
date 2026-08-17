ALTER TABLE public.therapist_advanced_scoring_access
  ADD COLUMN IF NOT EXISTS starts_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.therapist_advanced_scoring_access
  DROP CONSTRAINT IF EXISTS therapist_advanced_scoring_access_source_check;
ALTER TABLE public.therapist_advanced_scoring_access
  ADD CONSTRAINT therapist_advanced_scoring_access_source_check
  CHECK (source IN ('founding_70','elite_pro','commercial_offer','manual_grant','admin_manual','offer_accepted'));

CREATE TABLE IF NOT EXISTS public.therapist_scoring_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('granted','revoked','updated')),
  source text,
  starts_at timestamptz,
  expires_at timestamptz,
  note text,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scoring_access_events_therapist
  ON public.therapist_scoring_access_events(therapist_id, created_at DESC);

GRANT SELECT ON public.therapist_scoring_access_events TO authenticated;
GRANT ALL ON public.therapist_scoring_access_events TO service_role;

ALTER TABLE public.therapist_scoring_access_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scoring_access_events_admin_all" ON public.therapist_scoring_access_events;
CREATE POLICY "scoring_access_events_admin_all"
  ON public.therapist_scoring_access_events FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.advanced_scoring_eligibility(_therapist_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT t.id, t.subscription_plan FROM public.therapists t WHERE t.id = _therapist_id
  ),
  seat AS (
    SELECT * FROM public.founder_seats WHERE therapist_id = _therapist_id
  ),
  sub AS (
    SELECT si.plan_name, si.period_end
    FROM public.subscription_invoices si
    WHERE si.therapist_id = _therapist_id
      AND si.status IN ('paid','open')
      AND lower(coalesce(si.plan_name,'')) LIKE '%elite%'
      AND (si.period_end IS NULL OR si.period_end >= current_date)
    ORDER BY si.period_end DESC NULLS LAST
    LIMIT 1
  ),
  grant_row AS (
    SELECT a.* FROM public.therapist_advanced_scoring_access a
    WHERE a.therapist_id = _therapist_id
      AND a.enabled
      AND (a.starts_at IS NULL OR a.starts_at <= now())
      AND (a.expires_at IS NULL OR a.expires_at > now())
  ),
  grant_any AS (
    SELECT a.* FROM public.therapist_advanced_scoring_access a WHERE a.therapist_id = _therapist_id
  )
  SELECT jsonb_build_object(
    'therapist_id', _therapist_id,
    'early_rank', (SELECT seat_number FROM seat),
    'seat_status', (SELECT status FROM seat),
    'seat_granted_at', (SELECT granted_at FROM seat),
    'seat_source', (SELECT source FROM seat),
    'is_early', COALESCE((SELECT status = 'active' FROM seat), false),
    'is_elite_pro', COALESCE((SELECT subscription_plan FROM me) = 'elite_pro', false)
                    OR (SELECT count(*) FROM sub) > 0,
    'subscription_plan', (SELECT subscription_plan FROM me),
    'subscription_verified', (SELECT count(*) FROM sub) > 0,
    'subscription_period_end', (SELECT period_end FROM sub),
    'grant_source', (SELECT source FROM grant_row),
    'granted_at', (SELECT granted_at FROM grant_row),
    'granted_note', (SELECT note FROM grant_row),
    'grant_starts_at', (SELECT starts_at FROM grant_row),
    'grant_expires_at', (SELECT expires_at FROM grant_row),
    'grant_enabled', COALESCE((SELECT enabled FROM grant_any), false),
    'grant_record', (SELECT to_jsonb(g) FROM grant_any g),
    'seats_used', (SELECT count(*) FROM public.founder_seats),
    'seats_total', 70
  );
$$;

REVOKE EXECUTE ON FUNCTION public.advanced_scoring_eligibility(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advanced_scoring_eligibility(uuid) TO service_role;