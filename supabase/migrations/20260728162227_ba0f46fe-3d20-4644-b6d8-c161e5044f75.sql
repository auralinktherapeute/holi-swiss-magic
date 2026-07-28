-- 1. Modération des réponses aux avis
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS therapist_reply_status text,
  ADD COLUMN IF NOT EXISTS therapist_reply_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS therapist_reply_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS therapist_reply_reviewed_by uuid;

-- Historique : les réponses déjà publiées avant modération restent visibles.
UPDATE public.reviews
SET therapist_reply_status = 'approved',
    therapist_reply_reviewed_at = COALESCE(therapist_reply_reviewed_at, therapist_reply_at)
WHERE therapist_reply IS NOT NULL AND therapist_reply_status IS NULL;

ALTER TABLE public.reviews
  ALTER COLUMN therapist_reply_status SET DEFAULT 'pending';

DO $$ BEGIN
  ALTER TABLE public.reviews
    ADD CONSTRAINT reviews_therapist_reply_status_check
    CHECK (therapist_reply_status IS NULL OR therapist_reply_status IN ('pending','approved','rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger : toute écriture par un non-admin remet la réponse en « pending ».
CREATE OR REPLACE FUNCTION public.reviews_reply_pending_on_change()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.therapist_reply IS DISTINCT FROM OLD.therapist_reply THEN
    IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      NEW.therapist_reply_status := CASE WHEN NEW.therapist_reply IS NULL THEN NULL ELSE 'pending' END;
      NEW.therapist_reply_submitted_at := CASE WHEN NEW.therapist_reply IS NULL THEN NULL ELSE now() END;
      NEW.therapist_reply_reviewed_at := NULL;
      NEW.therapist_reply_reviewed_by := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS reviews_reply_pending_on_change ON public.reviews;
CREATE TRIGGER reviews_reply_pending_on_change
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_reply_pending_on_change();

-- 2. Résolution automatique des notifications dont l'entité est déjà traitée.
CREATE OR REPLACE FUNCTION public.resolve_admin_notifications()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  affected integer := 0;
BEGIN
  WITH upd AS (
    UPDATE public.notifications n
       SET is_read = true, read_at = now()
     WHERE is_read = false
       AND n.entity_id IS NOT NULL
       AND (
         (n.kind = 'therapist_pending'    AND EXISTS (SELECT 1 FROM public.therapists   t WHERE t.id = n.entity_id AND t.status <> 'pending'))
      OR (n.kind = 'waitlist_new'         AND EXISTS (SELECT 1 FROM public.waiting_list w WHERE w.id = n.entity_id AND w.status <> 'pending'))
      OR (n.kind = 'review_new'           AND EXISTS (SELECT 1 FROM public.reviews     r WHERE r.id = n.entity_id AND r.status <> 'pending'))
      OR (n.kind = 'review_reply_pending' AND EXISTS (SELECT 1 FROM public.reviews     r WHERE r.id = n.entity_id AND COALESCE(r.therapist_reply_status,'pending') <> 'pending'))
      OR (n.kind = 'event_pending'        AND EXISTS (SELECT 1 FROM public.events      e WHERE e.id = n.entity_id AND e.status <> 'pending_review'))
      OR (n.kind = 'article_pending'      AND EXISTS (SELECT 1 FROM public.articles    a WHERE a.id = n.entity_id AND a.status <> 'pending_validation'))
       )
    RETURNING 1
  )
  SELECT COUNT(*) INTO affected FROM upd;
  RETURN affected;
END $$;

REVOKE EXECUTE ON FUNCTION public.resolve_admin_notifications() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_admin_notifications() TO service_role;