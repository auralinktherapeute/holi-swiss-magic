REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
-- has_role is invoked by RLS policies; SECURITY DEFINER runs as owner, so no
-- direct EXECUTE grant to anon/authenticated is required.