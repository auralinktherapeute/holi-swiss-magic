CREATE TABLE IF NOT EXISTS public.newsletter_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  problem text,
  objective text,
  audience text,
  pillar text,
  tone text,
  feature_highlight text,
  cta text,
  lang text NOT NULL DEFAULT 'fr',
  target_date date,
  internal_notes text,
  status text NOT NULL DEFAULT 'idee',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT newsletter_issues_status_check CHECK (status IN ('idee','brouillon','en_revision','approuvee','programmee','envoyee','archivee')),
  CONSTRAINT newsletter_issues_lang_check CHECK (lang IN ('fr','de','it','en'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_issues TO authenticated;
GRANT ALL ON public.newsletter_issues TO service_role;

ALTER TABLE public.newsletter_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage newsletter issues" ON public.newsletter_issues;
CREATE POLICY "Admins manage newsletter issues"
  ON public.newsletter_issues
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_newsletter_issues_updated_at ON public.newsletter_issues;
CREATE TRIGGER trg_newsletter_issues_updated_at
  BEFORE UPDATE ON public.newsletter_issues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS newsletter_issues_status_idx ON public.newsletter_issues (status, target_date);