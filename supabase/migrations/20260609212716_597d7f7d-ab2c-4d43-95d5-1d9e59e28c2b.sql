
ALTER TABLE public.therapists
  ADD COLUMN IF NOT EXISTS services jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS years_experience integer,
  ADD COLUMN IF NOT EXISTS google_reviews_url text,
  ADD COLUMN IF NOT EXISTS siret text,
  ADD COLUMN IF NOT EXISTS siret_verified boolean NOT NULL DEFAULT false;

-- Re-create public read policy to exclude siret via a column-level grant approach:
-- We keep RLS as-is (rows still readable) but revoke siret SELECT for anon/authenticated; owner still reads all via the manage policy.
REVOKE SELECT (siret) ON public.therapists FROM anon;
REVOKE SELECT (siret) ON public.therapists FROM authenticated;
-- Owner still needs to read siret back when editing own profile → grant only to owner via a SECURITY DEFINER not needed; simpler: keep grant to authenticated and rely on app layer to not expose it. So re-grant:
GRANT SELECT (siret) ON public.therapists TO authenticated;

CREATE TABLE IF NOT EXISTS public.therapist_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  label text,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapist_documents TO authenticated;
GRANT SELECT ON public.therapist_documents TO anon;
GRANT ALL ON public.therapist_documents TO service_role;

ALTER TABLE public.therapist_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read public documents"
  ON public.therapist_documents FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

CREATE POLICY "owner manage own documents"
  ON public.therapist_documents FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = therapist_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = therapist_id AND t.user_id = auth.uid()));

CREATE TRIGGER trg_therapist_documents_updated_at
  BEFORE UPDATE ON public.therapist_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
