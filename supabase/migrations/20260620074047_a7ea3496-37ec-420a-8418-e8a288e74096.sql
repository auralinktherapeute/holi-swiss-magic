
CREATE TABLE public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  lang text NOT NULL DEFAULT 'fr',
  category text,
  cover_image_url text,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title_fr text NOT NULL,
  title_de text DEFAULT '',
  title_it text DEFAULT '',
  title_en text DEFAULT '',
  body_fr text NOT NULL,
  body_de text DEFAULT '',
  body_it text DEFAULT '',
  body_en text DEFAULT '',
  excerpt_fr text DEFAULT '',
  excerpt_de text DEFAULT '',
  excerpt_it text DEFAULT '',
  excerpt_en text DEFAULT '',
  meta_title_fr text DEFAULT '',
  meta_description_fr text DEFAULT '',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles TO authenticated;
GRANT ALL ON public.articles TO service_role;

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read validated articles"
  ON public.articles FOR SELECT
  USING (status = 'validated');

CREATE POLICY "Admins can do everything on articles"
  ON public.articles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_articles_status_published ON public.articles(status, published_at DESC);
CREATE INDEX idx_articles_lang ON public.articles(lang);
