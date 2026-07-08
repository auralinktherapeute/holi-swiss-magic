CREATE OR REPLACE FUNCTION public.trg_notify_article_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending_validation' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.create_admin_notification(
      'article_pending',
      'Nouvel article en attente',
      COALESCE(NEW.title_fr, NEW.meta_title_fr, NEW.slug, '(sans titre)'),
      '/admin/articles?status=pending_validation',
      'article', NEW.id,
      '{}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;

INSERT INTO public.article_categories (
  slug,
  name_fr,
  name_de,
  name_it,
  name_en,
  parent_category,
  sort_order
) VALUES (
  'geobiologie',
  'Géobiologie',
  'Geobiologie',
  'Geobiologia',
  'Geobiology',
  'energetiques',
  75
)
ON CONFLICT (slug) DO UPDATE SET
  name_fr = excluded.name_fr,
  name_de = excluded.name_de,
  name_it = excluded.name_it,
  name_en = excluded.name_en,
  parent_category = excluded.parent_category,
  sort_order = excluded.sort_order,
  updated_at = now();

INSERT INTO public.articles (
  slug,
  status,
  lang,
  category,
  title_fr,
  excerpt_fr,
  body_fr,
  meta_title_fr,
  meta_description_fr,
  secondary_tags,
  published_at,
  created_at,
  updated_at
) VALUES (
  'geobiologue-suisse-habitat-sain-bien-etre',
  'pending_validation',
  'fr',
  'geobiologie',
  'Geobiologue Suisse | Habitat Sain & Bien-être',
  'Article généré par l’Agent Articles GEO/SEO HoliSwiss sur la géobiologie, l’habitat sain et le bien-être en Suisse.',
  E'## Geobiologue Suisse | Habitat Sain & Bien-être\n\nArticle importé depuis le rapport Agent Articles GEO/SEO HoliSwiss du 08/07/2026 08:07.\n\nCe contenu est placé en attente de validation afin que l’administrateur puisse relire, compléter le texte généré, ajouter l’image de couverture si nécessaire et publier uniquement après contrôle éditorial.\n\n## Points à vérifier avant publication\n\n- Compléter le corps de l’article si le rapport source n’a pas transmis tout le contenu.\n- Vérifier le vocabulaire et éviter toute promesse médicale.\n- Ajouter les liens internes vers les thérapeutes et catégories HoliSwiss pertinentes.\n- Vérifier le titre SEO, la meta description et le texte alternatif de l’image.',
  'Geobiologue Suisse | Habitat Sain & Bien-être',
  'Découvrez la géobiologie en Suisse : habitat sain, équilibre du lieu de vie et accompagnement bien-être par un géobiologue qualifié.',
  ARRAY['geobiologue-suisse','habitat-sain','geobiologie'],
  null,
  now(),
  now()
)
ON CONFLICT (slug) DO UPDATE SET
  status = 'pending_validation',
  lang = excluded.lang,
  category = excluded.category,
  title_fr = excluded.title_fr,
  excerpt_fr = excluded.excerpt_fr,
  body_fr = excluded.body_fr,
  meta_title_fr = excluded.meta_title_fr,
  meta_description_fr = excluded.meta_description_fr,
  secondary_tags = excluded.secondary_tags,
  published_at = null,
  updated_at = now();