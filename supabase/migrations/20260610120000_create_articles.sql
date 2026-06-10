-- Articles de blog HoliSwiss
CREATE TABLE IF NOT EXISTS public.articles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text NOT NULL,
  slug             text NOT NULL UNIQUE,
  content          text,
  excerpt          text,
  cover_image_url  text,
  category         text,
  author           text,
  published_at     timestamptz,
  lang             text NOT NULL DEFAULT 'fr',
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  author_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Lecture publique des articles publiés
CREATE POLICY "Public read published articles"
  ON public.articles FOR SELECT
  USING (status = 'published');

-- Admins : accès total
CREATE POLICY "Admins manage articles"
  ON public.articles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Thérapeutes : lire/écrire leurs propres articles
CREATE POLICY "Therapists manage own articles"
  ON public.articles FOR ALL
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Mise à jour auto de updated_at
CREATE OR REPLACE FUNCTION public.set_articles_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.set_articles_updated_at();

-- Index pour les requêtes fréquentes
CREATE INDEX idx_articles_status_published_at ON public.articles(status, published_at DESC);
CREATE INDEX idx_articles_slug ON public.articles(slug);
CREATE INDEX idx_articles_author_id ON public.articles(author_id);
CREATE INDEX idx_articles_lang ON public.articles(lang);
