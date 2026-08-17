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
    'seats_used', (SELECT count(*) FROM public.founder_seats WHERE status = 'active'),
    'seats_total', 70
  );
$$;

REVOKE EXECUTE ON FUNCTION public.advanced_scoring_eligibility(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advanced_scoring_eligibility(uuid) TO service_role;