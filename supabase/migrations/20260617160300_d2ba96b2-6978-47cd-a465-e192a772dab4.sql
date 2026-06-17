CREATE OR REPLACE VIEW public.public_blocked_periods
WITH (security_invoker = true) AS
SELECT therapist_id, start_date, end_date, is_all_day, start_time, end_time
FROM public.blocked_periods;

GRANT SELECT ON public.public_blocked_periods TO anon, authenticated;
GRANT SELECT (id, therapist_id, start_date, end_date, created_at, is_all_day, start_time, end_time)
  ON public.blocked_periods TO anon, authenticated;