ALTER TABLE public.therapists
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.therapists.social_links IS
  'Réseaux sociaux du praticien : { instagram: { url, visible }, facebook: {...}, linkedin: {...} }. Le lien est conservé même quand visible = false.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'therapists_social_links_is_object'
  ) THEN
    ALTER TABLE public.therapists
      ADD CONSTRAINT therapists_social_links_is_object
      CHECK (jsonb_typeof(social_links) = 'object');
  END IF;
END $$;