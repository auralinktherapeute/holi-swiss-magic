
-- ============================================================
-- Backfill therapist_specialties from therapists.specialties[] free-text.
-- Ensures every specialty visible on a therapist profile is searchable
-- via the therapist_specialties pivot (used by search_therapists + Explorer).
-- ============================================================

-- Coherence report: raw labels displayed on therapist profiles that do NOT
-- resolve to any active specialty (via name_fr/de/it/en/slug/aliases, unaccent).
CREATE OR REPLACE FUNCTION public.admin_specialty_coherence_report()
RETURNS TABLE(
  therapist_id uuid,
  therapist_name text,
  raw_label text,
  normalized text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH exp AS (
    SELECT t.id AS therapist_id,
           (coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')) AS therapist_name,
           unnest(t.specialties) AS raw_label
    FROM public.therapists t
    WHERE t.specialties IS NOT NULL AND array_length(t.specialties,1) > 0
  ),
  norm AS (
    SELECT therapist_id, therapist_name, raw_label,
           public.normalize_search(raw_label) AS n
    FROM exp
  )
  SELECT n.therapist_id, n.therapist_name, n.raw_label, n.n
  FROM norm n
  WHERE public.has_role(auth.uid(),'admin'::app_role)
    AND NOT EXISTS (
      SELECT 1 FROM public.specialties s
      WHERE s.is_active
        AND (
          public.normalize_search(s.name_fr) = n.n
          OR public.normalize_search(coalesce(s.name_de,'')) = n.n
          OR public.normalize_search(coalesce(s.name_it,'')) = n.n
          OR public.normalize_search(coalesce(s.name_en,'')) = n.n
          OR s.slug = n.n
          OR EXISTS (SELECT 1 FROM unnest(s.aliases) a WHERE public.normalize_search(a) = n.n)
        )
    );
$$;

-- One-shot backfill: populate therapist_specialties + specialty_import_pending
-- from every therapist's current specialties[] text array.
DO $backfill$
DECLARE
  r RECORD;
  raw_lbl text;
  n text;
  matched_id uuid;
BEGIN
  FOR r IN SELECT id, specialties FROM public.therapists
           WHERE specialties IS NOT NULL AND array_length(specialties,1) > 0
  LOOP
    FOREACH raw_lbl IN ARRAY r.specialties LOOP
      n := public.normalize_search(raw_lbl);
      IF n IS NULL OR length(n) = 0 THEN CONTINUE; END IF;

      SELECT s.id INTO matched_id
      FROM public.specialties s
      WHERE s.is_active
        AND (
          public.normalize_search(s.name_fr) = n
          OR public.normalize_search(coalesce(s.name_de,'')) = n
          OR public.normalize_search(coalesce(s.name_it,'')) = n
          OR public.normalize_search(coalesce(s.name_en,'')) = n
          OR s.slug = n
          OR EXISTS (SELECT 1 FROM unnest(s.aliases) a WHERE public.normalize_search(a) = n)
        )
      LIMIT 1;

      IF matched_id IS NOT NULL THEN
        INSERT INTO public.therapist_specialties(therapist_id, specialty_id)
        VALUES (r.id, matched_id)
        ON CONFLICT DO NOTHING;
      ELSE
        -- Track unmatched labels so admin can create/merge specialties.
        INSERT INTO public.specialty_import_pending(therapist_id, raw_label)
        SELECT r.id, raw_lbl
        WHERE NOT EXISTS (
          SELECT 1 FROM public.specialty_import_pending p
          WHERE p.therapist_id = r.id
            AND public.normalize_search(p.raw_label) = n
        );
      END IF;
    END LOOP;
  END LOOP;
END $backfill$;
