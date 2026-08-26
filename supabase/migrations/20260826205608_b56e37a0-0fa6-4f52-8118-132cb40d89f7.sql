-- Restrict reviews access to explicit columns; hide reviewer avatar URLs from public/authenticated clients
REVOKE ALL ON public.reviews FROM anon, authenticated;

GRANT SELECT (id, therapist_id, user_id, rating, comment, author_name, status, created_at, updated_at,
              therapist_reply, therapist_reply_at, therapist_reply_status,
              therapist_reply_submitted_at, therapist_reply_reviewed_at, therapist_reply_reviewed_by)
  ON public.reviews TO anon, authenticated;

GRANT INSERT (therapist_id, user_id, rating, comment, author_name, status)
  ON public.reviews TO authenticated;

GRANT UPDATE (rating, comment, author_name, status, updated_at,
              therapist_reply, therapist_reply_at, therapist_reply_status,
              therapist_reply_submitted_at, therapist_reply_reviewed_at, therapist_reply_reviewed_by)
  ON public.reviews TO authenticated;

GRANT DELETE ON public.reviews TO authenticated;

GRANT ALL ON public.reviews TO service_role;