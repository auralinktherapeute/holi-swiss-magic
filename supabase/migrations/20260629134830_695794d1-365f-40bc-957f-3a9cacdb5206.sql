-- Hide blocked_periods.reason from anonymous and other authenticated users.
-- Booking widget reads dates via the public_blocked_periods view (no reason column).
REVOKE SELECT (reason) ON public.blocked_periods FROM anon;
REVOKE SELECT (reason) ON public.blocked_periods FROM authenticated;