CREATE OR REPLACE FUNCTION public.reviews_reply_pending_on_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  is_admin_jwt boolean := auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role);
  is_service boolean := coalesce(auth.role(), current_user) = 'service_role';
BEGIN
  IF NEW.therapist_reply IS DISTINCT FROM OLD.therapist_reply THEN
    IF NOT is_admin_jwt THEN
      NEW.therapist_reply_status := CASE WHEN NEW.therapist_reply IS NULL THEN NULL ELSE 'pending' END;
      NEW.therapist_reply_submitted_at := CASE WHEN NEW.therapist_reply IS NULL THEN NULL ELSE now() END;
      NEW.therapist_reply_reviewed_at := NULL;
      NEW.therapist_reply_reviewed_by := NULL;
    END IF;
  ELSIF NOT (is_admin_jwt OR is_service) THEN
    -- Texte inchangé : les champs de modération sont immuables côté thérapeute.
    NEW.therapist_reply_status := OLD.therapist_reply_status;
    NEW.therapist_reply_submitted_at := OLD.therapist_reply_submitted_at;
    NEW.therapist_reply_reviewed_at := OLD.therapist_reply_reviewed_at;
    NEW.therapist_reply_reviewed_by := OLD.therapist_reply_reviewed_by;
  END IF;
  RETURN NEW;
END $function$;