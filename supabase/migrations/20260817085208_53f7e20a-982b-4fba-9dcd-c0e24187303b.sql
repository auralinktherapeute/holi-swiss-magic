-- Connexion de « La Lettre Holiswiss » aux fonctionnalités existantes
ALTER TABLE public.newsletter_issues
  ADD COLUMN IF NOT EXISTS feature_key text,
  ADD COLUMN IF NOT EXISTS target_route text,
  ADD COLUMN IF NOT EXISTS action_label text,
  ADD COLUMN IF NOT EXISTS action_difficulty text,
  ADD COLUMN IF NOT EXISTS action_minutes integer,
  ADD COLUMN IF NOT EXISTS linked_article_id uuid,
  ADD COLUMN IF NOT EXISTS linked_article_kind text,
  ADD COLUMN IF NOT EXISTS linked_resource_slug text,
  ADD COLUMN IF NOT EXISTS segment_key text,
  ADD COLUMN IF NOT EXISTS connection_priority text,
  ADD COLUMN IF NOT EXISTS connection_notes text;

CREATE TABLE IF NOT EXISTS public.newsletter_suggestions (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  audience text,
  pillar text,
  feature_key text,
  objective text,
  rationale text,
  priority text not null default 'moyenne',
  source text not null default 'manuelle',
  status text not null default 'ouverte',
  issue_id uuid references public.newsletter_issues(id) on delete set null,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_suggestions_auto_uniq
  ON public.newsletter_suggestions (subject)
  WHERE source = 'automatique' AND status = 'ouverte';

GRANT ALL ON public.newsletter_suggestions TO service_role;
GRANT SELECT ON public.newsletter_suggestions TO authenticated;

ALTER TABLE public.newsletter_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read newsletter suggestions" ON public.newsletter_suggestions;
CREATE POLICY "Admins read newsletter suggestions"
  ON public.newsletter_suggestions FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));