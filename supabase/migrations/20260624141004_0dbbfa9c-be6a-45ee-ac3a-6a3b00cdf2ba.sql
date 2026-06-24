
CREATE TABLE public.crm_session_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.crm_client_contacts(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  session_date date NOT NULL DEFAULT current_date,
  title text,
  template text NOT NULL DEFAULT 'free' CHECK (template IN ('free','soap')),
  content text,
  soap_subjective text,
  soap_objective text,
  soap_assessment text,
  soap_plan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_session_notes_contact ON public.crm_session_notes(contact_id, session_date DESC);
CREATE INDEX idx_crm_session_notes_therapist ON public.crm_session_notes(therapist_id, session_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_session_notes TO authenticated;
GRANT ALL ON public.crm_session_notes TO service_role;

ALTER TABLE public.crm_session_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapist manages own session notes"
  ON public.crm_session_notes
  FOR ALL
  TO authenticated
  USING (
    therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE TRIGGER trg_crm_session_notes_updated_at
  BEFORE UPDATE ON public.crm_session_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
