CREATE TABLE IF NOT EXISTS public.therapist_org_certification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_id uuid NOT NULL REFERENCES public.therapist_org_certifications(id) ON DELETE CASCADE,
  old_status public.org_certification_status,
  new_status public.org_certification_status NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_toc_history_certification
  ON public.therapist_org_certification_history (certification_id, changed_at DESC);

GRANT SELECT ON public.therapist_org_certification_history TO authenticated;
GRANT ALL ON public.therapist_org_certification_history TO service_role;

ALTER TABLE public.therapist_org_certification_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read org certification history" ON public.therapist_org_certification_history;
CREATE POLICY "Admins read org certification history"
  ON public.therapist_org_certification_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins write org certification history" ON public.therapist_org_certification_history;
CREATE POLICY "Admins write org certification history"
  ON public.therapist_org_certification_history
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));