-- Extend search_specialties to consider name in all 4 languages and return multilingual labels
CREATE OR REPLACE FUNCTION public.search_specialties(_q text, _limit integer DEFAULT 10, _lang text DEFAULT 'fr')
 RETURNS TABLE(id uuid, slug text, name_fr text, name_de text, name_it text, name_en text, family_slug text, family_name_fr text, family_name_de text, family_name_it text, family_name_en text, rank integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH q AS (SELECT public.normalize_search(_q) AS n)
  SELECT s.id, s.slug, s.name_fr, s.name_de, s.name_it, s.name_en,
    f.slug, f.name_fr, f.name_de, f.name_it, f.name_en,
    CASE
      WHEN public.normalize_search(s.name_fr) = q.n
        OR public.normalize_search(coalesce(s.name_de,'')) = q.n
        OR public.normalize_search(coalesce(s.name_it,'')) = q.n
        OR public.normalize_search(coalesce(s.name_en,'')) = q.n THEN 100
      WHEN public.normalize_search(s.name_fr) LIKE q.n || '%'
        OR public.normalize_search(coalesce(s.name_de,'')) LIKE q.n || '%'
        OR public.normalize_search(coalesce(s.name_it,'')) LIKE q.n || '%'
        OR public.normalize_search(coalesce(s.name_en,'')) LIKE q.n || '%' THEN 80
      WHEN EXISTS (SELECT 1 FROM unnest(s.aliases) a WHERE public.normalize_search(a) = q.n) THEN 70
      WHEN public.normalize_search(s.name_fr) LIKE '%' || q.n || '%'
        OR public.normalize_search(coalesce(s.name_de,'')) LIKE '%' || q.n || '%'
        OR public.normalize_search(coalesce(s.name_it,'')) LIKE '%' || q.n || '%'
        OR public.normalize_search(coalesce(s.name_en,'')) LIKE '%' || q.n || '%' THEN 50
      WHEN EXISTS (SELECT 1 FROM unnest(s.aliases) a WHERE public.normalize_search(a) LIKE '%' || q.n || '%') THEN 40
      ELSE 0
    END AS rank
  FROM public.specialties s
  JOIN public.specialty_families f ON f.id = s.family_id
  , q
  WHERE s.is_active
    AND length(q.n) >= 2
    AND (
      public.normalize_search(s.name_fr) LIKE '%' || q.n || '%'
      OR public.normalize_search(coalesce(s.name_de,'')) LIKE '%' || q.n || '%'
      OR public.normalize_search(coalesce(s.name_it,'')) LIKE '%' || q.n || '%'
      OR public.normalize_search(coalesce(s.name_en,'')) LIKE '%' || q.n || '%'
      OR EXISTS (SELECT 1 FROM unnest(s.aliases) a WHERE public.normalize_search(a) LIKE '%' || q.n || '%')
    )
  ORDER BY rank DESC, length(s.name_fr) ASC
  LIMIT _limit;
$function$;