ALTER TABLE public.marketing_proposals
  ADD COLUMN IF NOT EXISTS carousel_page_count integer,
  ADD COLUMN IF NOT EXISTS carousel_presentation text,
  ADD COLUMN IF NOT EXISTS carousel_generation_version integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'marketing_proposals_carousel_page_count_chk'
  ) THEN
    ALTER TABLE public.marketing_proposals
      ADD CONSTRAINT marketing_proposals_carousel_page_count_chk
      CHECK (carousel_page_count IS NULL OR carousel_page_count BETWEEN 2 AND 5);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'marketing_proposals_carousel_presentation_chk'
  ) THEN
    ALTER TABLE public.marketing_proposals
      ADD CONSTRAINT marketing_proposals_carousel_presentation_chk
      CHECK (carousel_presentation IS NULL OR carousel_presentation IN ('classic','condensed','storytelling','conversion'));
  END IF;
END $$;