
-- 1. Cities reference table
CREATE TABLE IF NOT EXISTS public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text NOT NULL DEFAULT 'CH',
  canonical_name text NOT NULL,
  display_name text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cities TO anon, authenticated;
GRANT ALL ON public.cities TO service_role;

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cities are publicly readable" ON public.cities;
CREATE POLICY "Cities are publicly readable" ON public.cities FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS cities_aliases_gin ON public.cities USING GIN (aliases);
CREATE UNIQUE INDEX IF NOT EXISTS cities_country_canonical_uniq ON public.cities (country, lower(canonical_name));

-- 2. Seed Swiss cities. Aliases are stored lowercased & without diacritics.
INSERT INTO public.cities (canonical_name, display_name, aliases, lat, lng) VALUES
  ('Basel',              'Bâle, Suisse',              ARRAY['basel','bale','basle','basilea','bs','bale-ville','basel-stadt'], 47.5596, 7.5886),
  ('Bern',               'Berne, Suisse',             ARRAY['bern','berne','berna'], 46.9480, 7.4474),
  ('Biel/Bienne',        'Biel/Bienne, Suisse',       ARRAY['biel','bienne','biel/bienne','biel-bienne'], 47.1368, 7.2467),
  ('Geneva',             'Genève, Suisse',            ARRAY['geneva','geneve','genève','genf','ginevra','ge'], 46.2044, 6.1432),
  ('Zurich',             'Zurich, Suisse',            ARRAY['zurich','zürich','zuerich','zurigo','zh'], 47.3769, 8.5417),
  ('Lausanne',           'Lausanne, Suisse',          ARRAY['lausanne','losanna'], 46.5197, 6.6323),
  ('Lugano',             'Lugano, Suisse',            ARRAY['lugano'], 46.0037, 8.9511),
  ('Luzern',             'Lucerne, Suisse',           ARRAY['luzern','lucerne','lucerna'], 47.0502, 8.3093),
  ('Sion',               'Sion, Suisse',              ARRAY['sion','sitten'], 46.2276, 7.3596),
  ('Neuchâtel',          'Neuchâtel, Suisse',         ARRAY['neuchatel','neuchâtel','neuenburg'], 46.9930, 6.9310),
  ('Fribourg',           'Fribourg, Suisse',          ARRAY['fribourg','freiburg','friburgo'], 46.8065, 7.1619),
  ('St. Gallen',         'St-Gall, Suisse',           ARRAY['st gallen','st. gallen','sankt gallen','saint-gall','saint gall','san gallo','st-gall'], 47.4245, 9.3767),
  ('Winterthur',         'Winterthour, Suisse',       ARRAY['winterthur','winterthour'], 47.5022, 8.7386),
  ('Thun',               'Thoune, Suisse',            ARRAY['thun','thoune','tunc'], 46.7580, 7.6280),
  ('Chur',               'Coire, Suisse',             ARRAY['chur','coire','coira'], 46.8499, 9.5320),
  ('Bellinzona',         'Bellinzone, Suisse',        ARRAY['bellinzona','bellinzone'], 46.1944, 9.0297),
  ('Locarno',            'Locarno, Suisse',           ARRAY['locarno'], 46.1700, 8.7942),
  ('La Chaux-de-Fonds',  'La Chaux-de-Fonds, Suisse', ARRAY['la chaux-de-fonds','chaux-de-fonds','la chaux de fonds'], 47.1037, 6.8259),
  ('Montreux',           'Montreux, Suisse',          ARRAY['montreux'], 46.4312, 6.9107),
  ('Vevey',              'Vevey, Suisse',             ARRAY['vevey'], 46.4628, 6.8419),
  ('Nyon',               'Nyon, Suisse',              ARRAY['nyon'], 46.3833, 6.2349),
  ('Yverdon-les-Bains',  'Yverdon-les-Bains, Suisse', ARRAY['yverdon','yverdon-les-bains','yverdon les bains'], 46.7785, 6.6411),
  ('Delémont',           'Delémont, Suisse',          ARRAY['delemont','delémont','delsberg'], 47.3667, 7.3500),
  ('Aarau',              'Aarau, Suisse',             ARRAY['aarau'], 47.3909, 8.0444),
  ('Baden',              'Baden, Suisse',             ARRAY['baden'], 47.4730, 8.3060),
  ('Zug',                'Zoug, Suisse',              ARRAY['zug','zoug','zugo'], 47.1662, 8.5155),
  ('Schaffhausen',       'Schaffhouse, Suisse',       ARRAY['schaffhausen','schaffhouse','sciaffusa'], 47.6970, 8.6347),
  ('Solothurn',          'Soleure, Suisse',           ARRAY['solothurn','soleure','soletta'], 47.2079, 7.5371),
  ('Olten',              'Olten, Suisse',             ARRAY['olten'], 47.3499, 7.9043),
  ('Wil',                'Wil, Suisse',               ARRAY['wil'], 47.4621, 9.0438),
  ('Frauenfeld',         'Frauenfeld, Suisse',        ARRAY['frauenfeld'], 47.5536, 8.8980),
  ('Liestal',            'Liestal, Suisse',           ARRAY['liestal'], 47.4837, 7.7340),
  ('Davos',              'Davos, Suisse',             ARRAY['davos'], 46.8000, 9.8369),
  ('Interlaken',         'Interlaken, Suisse',        ARRAY['interlaken'], 46.6863, 7.8632),
  ('Brig',               'Brigue, Suisse',            ARRAY['brig','brigue','briga'], 46.3157, 7.9876),
  ('Martigny',           'Martigny, Suisse',          ARRAY['martigny'], 46.1017, 7.0727),
  ('Morges',             'Morges, Suisse',            ARRAY['morges'], 46.5096, 6.4983),
  ('Pully',              'Pully, Suisse',             ARRAY['pully'], 46.5101, 6.6614),
  ('Renens',             'Renens, Suisse',            ARRAY['renens'], 46.5380, 6.5880),
  ('Carouge',            'Carouge, Suisse',           ARRAY['carouge'], 46.1828, 6.1392),
  ('Meyrin',             'Meyrin, Suisse',            ARRAY['meyrin'], 46.2333, 6.0833),
  ('Onex',               'Onex, Suisse',              ARRAY['onex'], 46.1838, 6.1024),
  ('Vernier',            'Vernier, Suisse',           ARRAY['vernier'], 46.2150, 6.0850),
  ('Plan-les-Ouates',    'Plan-les-Ouates, Suisse',   ARRAY['plan-les-ouates','plan les ouates'], 46.1683, 6.1167),
  ('Boudevilliers',      'Boudevilliers, Suisse',     ARRAY['boudevilliers'], 47.0331, 6.8617),
  ('Le Chenit',          'Le Chenit, Suisse',         ARRAY['le chenit','chenit'], 46.6047, 6.2400),
  ('Payerne',            'Payerne, Suisse',           ARRAY['payerne'], 46.8228, 6.9389),
  ('Bulle',              'Bulle, Suisse',             ARRAY['bulle'], 46.6195, 7.0567),
  ('Monthey',            'Monthey, Suisse',           ARRAY['monthey'], 46.2547, 6.9542),
  ('Sierre',             'Sierre, Suisse',            ARRAY['sierre','siders'], 46.2920, 7.5360)
ON CONFLICT (country, lower(canonical_name)) DO UPDATE
  SET aliases = EXCLUDED.aliases,
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      display_name = EXCLUDED.display_name;

-- 3. Helper: SQL normalization (lowercase + strip common diacritics).
CREATE OR REPLACE FUNCTION public.normalize_city_text(_input text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(trim(translate(
    coalesce(_input,''),
    'àáâäãåèéêëìíîïòóôöõùúûüñçÀÁÂÄÃÅÈÉÊËÌÍÎÏÒÓÔÖÕÙÚÛÜÑÇ',
    'aaaaaaeeeeiiiioooooouuuuncAAAAAAEEEEIIIIOOOOOOUUUUNC'
  )));
$$;

-- 4. RPC: resolve_city
CREATE OR REPLACE FUNCTION public.resolve_city(_input text)
RETURNS TABLE(canonical_name text, display_name text, lat double precision, lng double precision)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (SELECT public.normalize_city_text(_input) AS n)
  SELECT c.canonical_name, c.display_name, c.lat, c.lng
  FROM public.cities c, q
  WHERE c.country = 'CH'
    AND (
      public.normalize_city_text(c.canonical_name) = q.n
      OR q.n = ANY(c.aliases)
    )
  ORDER BY (public.normalize_city_text(c.canonical_name) = q.n) DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_city(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_city_text(text) TO anon, authenticated;

-- 5. Backfill therapists missing coordinates from cities table
UPDATE public.therapists t
SET latitude = c.lat, longitude = c.lng
FROM public.cities c
WHERE (t.latitude IS NULL OR t.longitude IS NULL)
  AND t.city IS NOT NULL
  AND (
    public.normalize_city_text(t.city) = public.normalize_city_text(c.canonical_name)
    OR public.normalize_city_text(t.city) = ANY(c.aliases)
  );

-- 6. Trigger to auto-fill coords on insert/update when missing
CREATE OR REPLACE FUNCTION public.therapists_fill_coords_from_city()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lat double precision;
  v_lng double precision;
BEGIN
  IF NEW.city IS NOT NULL AND (NEW.latitude IS NULL OR NEW.longitude IS NULL) THEN
    SELECT c.lat, c.lng INTO v_lat, v_lng
    FROM public.cities c
    WHERE c.country = 'CH'
      AND (
        public.normalize_city_text(c.canonical_name) = public.normalize_city_text(NEW.city)
        OR public.normalize_city_text(NEW.city) = ANY(c.aliases)
      )
    LIMIT 1;
    IF v_lat IS NOT NULL THEN
      NEW.latitude := v_lat;
      NEW.longitude := v_lng;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS therapists_fill_coords_from_city ON public.therapists;
CREATE TRIGGER therapists_fill_coords_from_city
  BEFORE INSERT OR UPDATE OF city, latitude, longitude ON public.therapists
  FOR EACH ROW EXECUTE FUNCTION public.therapists_fill_coords_from_city();
