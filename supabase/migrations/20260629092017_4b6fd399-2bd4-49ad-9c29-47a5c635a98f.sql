-- Add public SELECT policy for blocked_periods so the booking widget can show
-- unavailable days for active therapists, and make the public view honor RLS.

ALTER VIEW public.public_blocked_periods SET (security_invoker = on);

GRANT SELECT ON public.blocked_periods TO anon, authenticated;

DROP POLICY IF EXISTS "Public can view blocked periods of active therapists" ON public.blocked_periods;
CREATE POLICY "Public can view blocked periods of active therapists"
  ON public.blocked_periods
  FOR SELECT
  TO anon, authenticated
  USING (
    therapist_id IN (
      SELECT id FROM public.therapists WHERE status = 'active'
    )
  );