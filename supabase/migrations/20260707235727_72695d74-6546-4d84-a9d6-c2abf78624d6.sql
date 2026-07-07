
CREATE OR REPLACE FUNCTION public.search_therapists(
  _q             text     DEFAULT NULL,
  _spec_slug     text     DEFAULT NULL,
  _family_slug   text     DEFAULT NULL,
  _limit         int      DEFAULT 100
)
RETURNS TABLE (
  id uuid, slug text, first_name text, last_name text, title text,
  short_bio text, photo_url text, city text, canton text,
  latitude double precision, longitude double precision,
  price_min numeric, price_max numeric, currency text,
  verified boolean, subscription_plan text,
  specialties text[],
  distance_m double precision,
  score double precision,
  matched_city text,
  matched_specialty text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_norm       text;
  v_tokens     text[];
  v_tok        text;
  v_city_lat   double precision;
  v_city_lng   double precision;
  v_city_name  text;
  v_text_tokens text[] := '{}';
  v_spec_ids   uuid[]  := '{}';
  v_spec_names text[]  := '{}';
  v_has_geo    boolean := false;
  v_ts_query   tsquery;
  v_sid        uuid;
  v_sname      text;
  v_matched_spec boolean;
BEGIN
  v_norm := lower(coalesce(public.immutable_unaccent(_q), ''));
  v_norm := regexp_replace(v_norm, '[^a-z0-9\s-]', ' ', 'g');
  v_norm := regexp_replace(v_norm, '\s+', ' ', 'g');
  v_tokens := CASE WHEN length(trim(v_norm)) > 0
                   THEN string_to_array(trim(v_norm), ' ')
                   ELSE '{}'::text[] END;

  FOREACH v_tok IN ARRAY v_tokens LOOP
    IF length(v_tok) < 2 THEN CONTINUE; END IF;

    -- Ville ? (une seule ville détectée, la 1re rencontrée)
    IF NOT v_has_geo THEN
      SELECT c.lat, c.lng, c.display_name
        INTO v_city_lat, v_city_lng, v_city_name
      FROM public.cities c
      WHERE c.country = 'CH'
        AND (public.normalize_city_text(c.canonical_name) = v_tok
             OR v_tok = ANY(c.aliases))
      LIMIT 1;
      IF FOUND THEN v_has_geo := true; CONTINUE; END IF;
    END IF;

    -- Spécialité (bonus scoring uniquement, on l'ajoute aussi comme token texte)
    v_sid := NULL;
    SELECT s.id, s.name_fr INTO v_sid, v_sname
    FROM public.specialties s
    WHERE s.is_active
      AND (
        lower(public.immutable_unaccent(s.name_fr)) = v_tok
        OR lower(public.immutable_unaccent(coalesce(s.name_de,''))) = v_tok
        OR lower(public.immutable_unaccent(coalesce(s.name_it,''))) = v_tok
        OR lower(public.immutable_unaccent(coalesce(s.name_en,''))) = v_tok
        OR s.slug = v_tok
        OR EXISTS (SELECT 1 FROM unnest(s.aliases) a
                   WHERE lower(public.immutable_unaccent(a)) = v_tok)
      )
    LIMIT 1;
    IF v_sid IS NOT NULL THEN
      v_spec_ids   := array_append(v_spec_ids, v_sid);
      v_spec_names := array_append(v_spec_names, v_sname);
    END IF;

    -- Token texte (toujours, même si reconnu comme spécialité)
    v_text_tokens := array_append(v_text_tokens, v_tok);
  END LOOP;

  IF array_length(v_text_tokens, 1) > 0 THEN
    v_ts_query := to_tsquery('simple',
      array_to_string(
        ARRAY(SELECT quote_literal(tk) || ':*' FROM unnest(v_text_tokens) tk),
        ' & '
      )
    );
  END IF;

  RETURN QUERY
  WITH filter_spec AS (
    SELECT DISTINCT ts.therapist_id
    FROM public.therapist_specialties ts
    JOIN public.specialties s ON s.id = ts.specialty_id
    LEFT JOIN public.specialty_families f ON f.id = s.family_id
    WHERE (_spec_slug IS NOT NULL AND s.slug = _spec_slug)
       OR (_family_slug IS NOT NULL AND f.slug = _family_slug)
  ),
  base AS (
    SELECT t.*,
      CASE WHEN v_has_geo AND t.geom IS NOT NULL THEN
        extensions.ST_Distance(t.geom,
          extensions.ST_SetSRID(extensions.ST_MakePoint(v_city_lng, v_city_lat), 4326)::extensions.geography)
      END AS dist_m,
      (v_spec_ids <> '{}'::uuid[] AND EXISTS (
        SELECT 1 FROM public.therapist_specialties ts
        WHERE ts.therapist_id = t.id AND ts.specialty_id = ANY(v_spec_ids)
      )) AS pivot_spec_match
    FROM public.therapists t
    WHERE t.status = 'active'
      AND ((_spec_slug IS NULL AND _family_slug IS NULL)
           OR t.id IN (SELECT therapist_id FROM filter_spec))
      AND (NOT v_has_geo OR (
        t.geom IS NOT NULL AND extensions.ST_DWithin(t.geom,
          extensions.ST_SetSRID(extensions.ST_MakePoint(v_city_lng, v_city_lat), 4326)::extensions.geography,
          80000)
      ))
      AND (v_ts_query IS NULL OR t.search_tokens @@ v_ts_query)
  ),
  scored AS (
    SELECT b.*,
      (
        (SELECT COALESCE(SUM(
          CASE
            WHEN lower(public.immutable_unaccent(b.first_name)) = tk
              OR lower(public.immutable_unaccent(b.last_name))  = tk
              OR lower(public.immutable_unaccent(b.first_name||' '||b.last_name)) = tk THEN 100
            WHEN lower(public.immutable_unaccent(b.first_name)) LIKE tk || '%'
              OR lower(public.immutable_unaccent(b.last_name))  LIKE tk || '%' THEN 70
            WHEN b.slug = tk THEN 90
            WHEN EXISTS (SELECT 1 FROM unnest(coalesce(b.specialties,'{}'::text[])) sp
                         WHERE lower(public.immutable_unaccent(sp)) = tk) THEN 45
            WHEN EXISTS (SELECT 1 FROM unnest(coalesce(b.approaches,'{}'::text[])) ap
                         WHERE lower(public.immutable_unaccent(ap)) = tk) THEN 35
            WHEN lower(public.immutable_unaccent(coalesce(b.title,''))) LIKE '%' || tk || '%' THEN 25
            WHEN lower(public.immutable_unaccent(coalesce(b.short_bio,''))) LIKE '%' || tk || '%' THEN 15
            WHEN lower(public.immutable_unaccent(coalesce(b.bio,''))) LIKE '%' || tk || '%' THEN 8
            ELSE 0
          END
        ), 0) FROM unnest(v_text_tokens) tk)
        + CASE WHEN v_has_geo AND lower(public.immutable_unaccent(coalesce(b.city,''))) = lower(public.immutable_unaccent(coalesce(v_city_name,''))) THEN 60
               WHEN v_has_geo THEN GREATEST(0::double precision, 20 - COALESCE(b.dist_m,0)/4000)
               ELSE 0 END
        + CASE WHEN b.pivot_spec_match THEN 55 ELSE 0 END
        + CASE WHEN b.verified THEN 5 ELSE 0 END
        + CASE WHEN b.subscription_plan = 'elite_pro' THEN 10 ELSE 0 END
      )::double precision AS s
    FROM base b
  )
  SELECT
    sc.id, sc.slug, sc.first_name, sc.last_name, sc.title,
    sc.short_bio, sc.photo_url, sc.city, sc.canton,
    sc.latitude, sc.longitude, sc.price_min, sc.price_max, sc.currency,
    sc.verified, sc.subscription_plan, sc.specialties,
    sc.dist_m AS distance_m,
    sc.s AS score,
    v_city_name AS matched_city,
    CASE WHEN array_length(v_spec_names,1) IS NOT NULL
         THEN array_to_string(v_spec_names, ', ') END AS matched_specialty
  FROM scored sc
  ORDER BY sc.s DESC, sc.verified DESC, sc.dist_m ASC NULLS LAST
  LIMIT _limit;
END $$;
