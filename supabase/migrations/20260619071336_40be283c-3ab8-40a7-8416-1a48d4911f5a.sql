
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

ALTER TABLE public.therapists
  ADD COLUMN IF NOT EXISTS geom extensions.geography(Point, 4326)
  GENERATED ALWAYS AS (
    CASE
      WHEN latitude IS NOT NULL AND longitude IS NOT NULL
      THEN extensions.ST_SetSRID(extensions.ST_MakePoint(longitude, latitude), 4326)::extensions.geography
      ELSE NULL
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS therapists_geom_gix ON public.therapists USING GIST (geom);

CREATE OR REPLACE FUNCTION public.therapists_within_radius(
  _lat double precision,
  _lng double precision,
  _radius_m double precision DEFAULT 80000
)
RETURNS TABLE (
  id uuid,
  slug text,
  first_name text,
  last_name text,
  title text,
  short_bio text,
  photo_url text,
  city text,
  canton text,
  latitude double precision,
  longitude double precision,
  price_min numeric,
  price_max numeric,
  currency text,
  verified boolean,
  specialties text[],
  distance_m double precision
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    t.id, t.slug, t.first_name, t.last_name, t.title, t.short_bio, t.photo_url,
    t.city, t.canton, t.latitude, t.longitude,
    t.price_min, t.price_max, t.currency, t.verified, t.specialties,
    extensions.ST_Distance(
      t.geom,
      extensions.ST_SetSRID(extensions.ST_MakePoint(_lng, _lat), 4326)::extensions.geography
    ) AS distance_m
  FROM public.therapists t
  WHERE t.status = 'active'
    AND t.geom IS NOT NULL
    AND extensions.ST_DWithin(
      t.geom,
      extensions.ST_SetSRID(extensions.ST_MakePoint(_lng, _lat), 4326)::extensions.geography,
      _radius_m
    )
  ORDER BY distance_m ASC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION public.therapists_within_radius(double precision, double precision, double precision) TO anon, authenticated;
