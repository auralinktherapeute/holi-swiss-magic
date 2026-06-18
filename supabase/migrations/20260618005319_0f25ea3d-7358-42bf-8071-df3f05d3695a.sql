
-- Reviews table
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL CHECK (char_length(comment) BETWEEN 20 AND 500),
  author_name text,
  author_avatar_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (therapist_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT SELECT ON public.reviews TO anon;
GRANT ALL ON public.reviews TO service_role;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved reviews
CREATE POLICY "Approved reviews are public"
  ON public.reviews FOR SELECT
  USING (status = 'approved');

-- Authenticated users can read their own (even pending)
CREATE POLICY "Users read own reviews"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Authenticated users can insert their own review
CREATE POLICY "Users insert own reviews"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- Authenticated users can update their own review (resets to pending)
CREATE POLICY "Users update own reviews"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can do everything
CREATE POLICY "Admins manage reviews"
  ON public.reviews FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Force pending on UPDATE by non-admin user (their edits go back to moderation)
CREATE OR REPLACE FUNCTION public.reviews_force_pending_on_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.status := 'pending';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reviews_force_pending
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_force_pending_on_edit();

-- Notify admin on new review
CREATE OR REPLACE FUNCTION public.trg_notify_new_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_admin_event(
    'review_new',
    'Nouvel avis en attente de modération',
    coalesce(NEW.author_name,'Anonyme') || ' — ' || NEW.rating::text || '★',
    '/admin/avis'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reviews_notify_new
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_review();

-- Update admin_badge_counts to include pending reviews
CREATE OR REPLACE FUNCTION public.admin_badge_counts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  result jsonb;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO is_admin;
  IF NOT is_admin THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT jsonb_build_object(
    'therapists', (SELECT count(*) FROM public.therapists WHERE status = 'pending'),
    'waitlist',   (SELECT count(*) FROM public.waiting_list WHERE status = 'pending'),
    'events',     (SELECT count(*) FROM public.events WHERE status = 'pending_review'),
    'moderation', 0,
    'reviews',    (SELECT count(*) FROM public.reviews WHERE status = 'pending'),
    'articles',   0,
    'subscriptions', 0
  ) INTO result;

  RETURN result;
END;
$$;

-- Public aggregate function (rating average + count) accessible to anon
CREATE OR REPLACE FUNCTION public.therapist_review_stats(_therapist_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'count', count(*),
    'avg', coalesce(round(avg(rating)::numeric, 2), 0),
    'dist', jsonb_build_object(
      '5', count(*) FILTER (WHERE rating = 5),
      '4', count(*) FILTER (WHERE rating = 4),
      '3', count(*) FILTER (WHERE rating = 3),
      '2', count(*) FILTER (WHERE rating = 2),
      '1', count(*) FILTER (WHERE rating = 1)
    )
  )
  FROM public.reviews
  WHERE therapist_id = _therapist_id AND status = 'approved';
$$;

GRANT EXECUTE ON FUNCTION public.therapist_review_stats(uuid) TO anon, authenticated;
