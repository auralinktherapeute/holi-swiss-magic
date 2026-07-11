
CREATE TABLE public.therapist_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  titre text NOT NULL,
  slug text NOT NULL UNIQUE,
  contenu text NOT NULL,
  extrait text,
  image_couverture text,
  statut text NOT NULL DEFAULT 'en_attente_validation' CHECK (statut IN ('brouillon','en_attente_validation','publie','refuse')),
  date_soumission timestamptz,
  date_publication timestamptz,
  motif_refus text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX therapist_articles_therapist_idx ON public.therapist_articles(therapist_id);
CREATE INDEX therapist_articles_statut_idx ON public.therapist_articles(statut, date_publication DESC);

GRANT SELECT ON public.therapist_articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapist_articles TO authenticated;
GRANT ALL ON public.therapist_articles TO service_role;

ALTER TABLE public.therapist_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published articles"
  ON public.therapist_articles FOR SELECT
  USING (statut = 'publie');

CREATE POLICY "Therapist can read own articles"
  ON public.therapist_articles FOR SELECT
  TO authenticated
  USING (public.is_therapist_owner(therapist_id));

CREATE POLICY "Therapist can insert own articles"
  ON public.therapist_articles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_therapist_owner(therapist_id));

CREATE POLICY "Therapist can update own articles"
  ON public.therapist_articles FOR UPDATE
  TO authenticated
  USING (public.is_therapist_owner(therapist_id))
  WITH CHECK (public.is_therapist_owner(therapist_id));

CREATE POLICY "Therapist can delete own articles"
  ON public.therapist_articles FOR DELETE
  TO authenticated
  USING (public.is_therapist_owner(therapist_id));

CREATE POLICY "Admin manage all therapist articles"
  ON public.therapist_articles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_therapist_articles_updated_at
  BEFORE UPDATE ON public.therapist_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.trg_notify_therapist_article_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.statut = 'en_attente_validation' AND (TG_OP = 'INSERT' OR OLD.statut IS DISTINCT FROM NEW.statut) THEN
    PERFORM public.create_admin_notification(
      'therapist_article_pending',
      'Nouvel article thérapeute en attente',
      COALESCE(NEW.titre,'(sans titre)'),
      '/admin/paroles',
      'therapist_article', NEW.id,
      '{}'::jsonb
    );
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_therapist_article_pending
  AFTER INSERT OR UPDATE OF statut ON public.therapist_articles
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_therapist_article_pending();
