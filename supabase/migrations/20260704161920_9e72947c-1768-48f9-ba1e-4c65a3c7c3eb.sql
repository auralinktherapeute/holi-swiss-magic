
-- Switch the public view to definer semantics so it can read the underlying
-- rows without a public SELECT policy on the base table.
ALTER VIEW public.public_blocked_periods SET (security_invoker = off);

GRANT SELECT ON public.public_blocked_periods TO anon, authenticated;

-- Drop the overly permissive policy that exposed the sensitive `reason` column.
DROP POLICY IF EXISTS "Public can view blocked periods of active therapists" ON public.blocked_periods;
