ALTER TABLE public.newsletter_issues
  ADD COLUMN IF NOT EXISTS created_by_email text,
  ADD COLUMN IF NOT EXISTS email_subject text,
  ADD COLUMN IF NOT EXISTS email_preheader text,
  ADD COLUMN IF NOT EXISTS email_intro text,
  ADD COLUMN IF NOT EXISTS email_body text,
  ADD COLUMN IF NOT EXISTS email_button_label text,
  ADD COLUMN IF NOT EXISTS email_button_url text,
  ADD COLUMN IF NOT EXISTS email_footer text,
  ADD COLUMN IF NOT EXISTS resource_title text,
  ADD COLUMN IF NOT EXISTS resource_intro text,
  ADD COLUMN IF NOT EXISTS resource_body text,
  ADD COLUMN IF NOT EXISTS resource_sections text,
  ADD COLUMN IF NOT EXISTS resource_example text,
  ADD COLUMN IF NOT EXISTS resource_checklist text,
  ADD COLUMN IF NOT EXISTS resource_takeaway text,
  ADD COLUMN IF NOT EXISTS resource_cta text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS share_image_url text,
  ADD COLUMN IF NOT EXISTS canonical_url text,
  ADD COLUMN IF NOT EXISTS qc_checklist jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_issues_slug_key
  ON public.newsletter_issues (slug) WHERE slug IS NOT NULL;

ALTER TABLE public.newsletter_issues DROP CONSTRAINT IF EXISTS newsletter_issues_status_check;
ALTER TABLE public.newsletter_issues ADD CONSTRAINT newsletter_issues_status_check
  CHECK (status IN ('idee','brouillon','en_revision','approuvee','programmee','envoyee','echec','archivee'));

CREATE TABLE IF NOT EXISTS public.newsletter_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.newsletter_issues(id) ON DELETE CASCADE,
  action text NOT NULL,
  status text,
  comment text,
  actor_id uuid,
  actor_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS newsletter_revisions_issue_idx
  ON public.newsletter_revisions (issue_id, created_at DESC);

GRANT SELECT ON public.newsletter_revisions TO authenticated;
GRANT ALL ON public.newsletter_revisions TO service_role;

ALTER TABLE public.newsletter_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read newsletter revisions" ON public.newsletter_revisions;
CREATE POLICY "Admins read newsletter revisions"
  ON public.newsletter_revisions FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));