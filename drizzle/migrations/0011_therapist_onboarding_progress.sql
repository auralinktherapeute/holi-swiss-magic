CREATE TABLE IF NOT EXISTS public.therapist_onboarding_progress (
  therapist_id uuid PRIMARY KEY REFERENCES public.therapists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tour_started_at timestamptz,
  tour_step integer NOT NULL DEFAULT 0 CHECK (tour_step >= 0 AND tour_step < 8),
  tour_paused_at timestamptz,
  tour_completed_at timestamptz,
  checklist_collapsed boolean NOT NULL DEFAULT false,
  checklist_reopened boolean NOT NULL DEFAULT false,
  events jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS therapist_onboarding_progress_user_idx ON public.therapist_onboarding_progress(user_id);

GRANT SELECT, INSERT, UPDATE ON public.therapist_onboarding_progress TO authenticated;
GRANT ALL ON public.therapist_onboarding_progress TO service_role;

ALTER TABLE public.therapist_onboarding_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_progress_owner_select" ON public.therapist_onboarding_progress;
CREATE POLICY "onboarding_progress_owner_select" ON public.therapist_onboarding_progress
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "onboarding_progress_owner_insert" ON public.therapist_onboarding_progress;
CREATE POLICY "onboarding_progress_owner_insert" ON public.therapist_onboarding_progress
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = therapist_id AND t.user_id = auth.uid()));

DROP POLICY IF EXISTS "onboarding_progress_owner_update" ON public.therapist_onboarding_progress;
CREATE POLICY "onboarding_progress_owner_update" ON public.therapist_onboarding_progress
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = therapist_id AND t.user_id = auth.uid()));