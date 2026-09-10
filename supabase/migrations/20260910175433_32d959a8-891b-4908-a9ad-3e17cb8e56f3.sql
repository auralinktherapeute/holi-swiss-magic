ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_articles_is_featured ON public.articles (is_featured) WHERE is_featured;

INSERT INTO public.article_categories (slug, name_fr, name_de, name_it, name_en, parent_category, sort_order) VALUES
  ('fil-nouveautes',   'Nouveautés',   'Neuigkeiten',    'Novità',      'What''s new',   'fil', 910),
  ('fil-actualites',   'Actualités',   'Aktuelles',      'Attualità',   'News',          'fil', 920),
  ('fil-partenariats', 'Partenariats', 'Partnerschaften','Partnership', 'Partnerships',  'fil', 930),
  ('fil-portraits',    'Portraits',    'Porträts',       'Ritratti',    'Portraits',     'fil', 940),
  ('fil-conseils',     'Conseils',     'Ratgeber',       'Consigli',    'Tips',          'fil', 950),
  ('fil-holiswiss',    'Holiswiss',    'Holiswiss',      'Holiswiss',   'Holiswiss',     'fil', 960)
ON CONFLICT (slug) DO NOTHING;