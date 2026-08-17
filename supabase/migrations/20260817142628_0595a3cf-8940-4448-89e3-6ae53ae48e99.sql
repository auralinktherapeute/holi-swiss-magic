CREATE TABLE IF NOT EXISTS public.therapist_advanced_scoring_access (
  therapist_id uuid PRIMARY KEY REFERENCES public.therapists(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'admin_manual',
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT therapist_advanced_scoring_access_source_check
    CHECK (source IN ('admin_manual','commercial_offer','offer_accepted'))
);

GRANT SELECT ON public.therapist_advanced_scoring_access TO authenticated;
GRANT ALL ON public.therapist_advanced_scoring_access TO service_role;

ALTER TABLE public.therapist_advanced_scoring_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "advanced_access_select_own" ON public.therapist_advanced_scoring_access;
CREATE POLICY "advanced_access_select_own"
  ON public.therapist_advanced_scoring_access FOR SELECT TO authenticated
  USING (public.is_therapist_owner(therapist_id) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "advanced_access_admin_all" ON public.therapist_advanced_scoring_access;
CREATE POLICY "advanced_access_admin_all"
  ON public.therapist_advanced_scoring_access FOR ALL TO authenticated
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
    SELECT t.id, t.created_at, t.status, t.subscription_plan
    FROM public.therapists t WHERE t.id = _therapist_id
  ),
  rank AS (
    SELECT (SELECT count(*) FROM public.therapists t2, me
            WHERE t2.status IN ('active','paused')
              AND (t2.created_at < me.created_at
                   OR (t2.created_at = me.created_at AND t2.id <= me.id))) AS pos
  ),
  grant_row AS (
    SELECT a.* FROM public.therapist_advanced_scoring_access a
    WHERE a.therapist_id = _therapist_id AND a.enabled
  )
  SELECT jsonb_build_object(
    'therapist_id', _therapist_id,
    'early_rank', (SELECT pos FROM rank),
    'is_early', COALESCE((SELECT pos FROM rank) <= 70 AND (SELECT status FROM me) IN ('active','paused'), false),
    'is_elite_pro', COALESCE((SELECT subscription_plan FROM me) = 'elite_pro', false),
    'grant_source', (SELECT source FROM grant_row),
    'granted_at', (SELECT granted_at FROM grant_row),
    'granted_note', (SELECT note FROM grant_row)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.advanced_scoring_eligibility(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advanced_scoring_eligibility(uuid) TO service_role;