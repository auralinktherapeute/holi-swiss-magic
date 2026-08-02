-- 1) Reviews: restrict therapist reply policy to authenticated + lock non-reply columns
DROP POLICY IF EXISTS "reviews_therapist_reply" ON public.reviews;
CREATE POLICY "reviews_therapist_reply" ON public.reviews
  FOR UPDATE TO authenticated
  USING (public.is_therapist_owner(therapist_id))
  WITH CHECK (public.is_therapist_owner(therapist_id));

CREATE OR REPLACE FUNCTION public.reviews_lock_reviewer_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin'::app_role);
  is_reviewer boolean := (OLD.user_id IS NOT NULL AND OLD.user_id = auth.uid());
BEGIN
  -- Trusted server context (service_role) and admins are unaffected
  IF auth.uid() IS NULL OR is_admin THEN
    RETURN NEW;
  END IF;

  IF is_reviewer THEN
    -- The review author may edit their own rating/comment, but never moderation state
    NEW.status                      := OLD.status;
    NEW.therapist_id                := OLD.therapist_id;
    NEW.user_id                     := OLD.user_id;
    NEW.therapist_reply             := OLD.therapist_reply;
    NEW.therapist_reply_status      := OLD.therapist_reply_status;
    NEW.therapist_reply_submitted_at := OLD.therapist_reply_submitted_at;
    NEW.therapist_reply_reviewed_at := OLD.therapist_reply_reviewed_at;
    NEW.therapist_reply_reviewed_by := OLD.therapist_reply_reviewed_by;
    RETURN NEW;
  END IF;

  -- Otherwise the acting user is the therapist replying: only the reply text may change.
  NEW.rating       := OLD.rating;
  NEW.comment      := OLD.comment;
  NEW.status       := OLD.status;
  NEW.user_id      := OLD.user_id;
  NEW.author_name  := OLD.author_name;
  NEW.author_avatar_url := OLD.author_avatar_url;
  NEW.therapist_id := OLD.therapist_id;
  NEW.created_at   := OLD.created_at;
  -- Moderation fields of the reply are admin-only; the pending flip is handled
  -- by reviews_reply_pending_on_change when the reply text actually changes.
  NEW.therapist_reply_reviewed_at := OLD.therapist_reply_reviewed_at;
  NEW.therapist_reply_reviewed_by := OLD.therapist_reply_reviewed_by;
  IF NEW.therapist_reply IS NOT DISTINCT FROM OLD.therapist_reply THEN
    NEW.therapist_reply_status       := OLD.therapist_reply_status;
    NEW.therapist_reply_submitted_at := OLD.therapist_reply_submitted_at;
  ELSE
    NEW.therapist_reply_status       := CASE WHEN NEW.therapist_reply IS NULL THEN NULL ELSE 'pending' END;
    NEW.therapist_reply_submitted_at := CASE WHEN NEW.therapist_reply IS NULL THEN NULL ELSE now() END;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure the locking trigger runs last (alphabetical order within BEFORE UPDATE)
DROP TRIGGER IF EXISTS trg_reviews_lock_reviewer_fields ON public.reviews;
CREATE TRIGGER zz_reviews_lock_reviewer_fields
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_lock_reviewer_fields();

-- 2) questionnaire_assignments: remove blanket public read
DROP POLICY IF EXISTS "Public read questionnaire assignments" ON public.questionnaire_assignments;

CREATE POLICY "Admins read questionnaire assignments" ON public.questionnaire_assignments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

REVOKE ALL ON public.questionnaire_assignments FROM anon;
GRANT ALL ON public.questionnaire_assignments TO service_role;