-- 1) Fix search_path on suggest_article_idea (SUPA_function_search_path_mutable)
CREATE OR REPLACE FUNCTION public.suggest_article_idea(_specs text[])
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
  select case
    when _specs is null or array_length(_specs,1) is null
      then 'Comment choisir son thérapeute en Suisse : 5 critères concrets'
    else 'Ce que la ' || _specs[1] || ' peut vraiment apporter : bienfaits, séance type et remboursement en Suisse'
  end;
$function$;

-- 2) Therapist self-update: replace broken tautological WITH CHECK with a real
--    BEFORE UPDATE trigger that pins status/verification fields for non-admins.
--    The policy stays simple (owner-only), the trigger enforces the invariants.
CREATE OR REPLACE FUNCTION public.therapists_lock_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins may change anything
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- For everyone else (therapist self-update), pin the protected fields to OLD.
  NEW.status         := OLD.status;
  NEW.verified       := OLD.verified;
  NEW.ide_verified   := OLD.ide_verified;
  NEW.siret_verified := OLD.siret_verified;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.therapists_lock_admin_fields() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_therapists_lock_admin_fields ON public.therapists;
CREATE TRIGGER trg_therapists_lock_admin_fields
BEFORE UPDATE ON public.therapists
FOR EACH ROW
EXECUTE FUNCTION public.therapists_lock_admin_fields();

-- Simplify the broken policy to owner-only; the trigger enforces the lock.
DROP POLICY IF EXISTS "therapist update own editable profile" ON public.therapists;
CREATE POLICY "therapist update own editable profile"
ON public.therapists
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 3) Reviews: therapist reply must only touch therapist_reply / therapist_reply_at.
--    Enforce via BEFORE UPDATE trigger comparing OLD to NEW for reviewer-owned columns.
CREATE OR REPLACE FUNCTION public.reviews_lock_reviewer_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin');
  is_reviewer boolean := (OLD.user_id = auth.uid());
BEGIN
  -- Admins and the review's own author are unaffected
  IF is_admin OR is_reviewer THEN
    RETURN NEW;
  END IF;

  -- Otherwise the acting user is the therapist replying: pin all non-reply fields.
  NEW.rating       := OLD.rating;
  NEW.comment      := OLD.comment;
  NEW.status       := OLD.status;
  NEW.user_id      := OLD.user_id;
  NEW.author_name  := OLD.author_name;
  NEW.author_avatar_url := OLD.author_avatar_url;
  NEW.therapist_id := OLD.therapist_id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reviews_lock_reviewer_fields() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_reviews_lock_reviewer_fields ON public.reviews;
CREATE TRIGGER trg_reviews_lock_reviewer_fields
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.reviews_lock_reviewer_fields();