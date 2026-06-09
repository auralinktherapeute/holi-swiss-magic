REVOKE SELECT (siret, ide) ON public.therapists FROM anon, authenticated;
REVOKE UPDATE (status, verified, ide_verified, siret_verified) ON public.therapists FROM authenticated;
REVOKE SELECT (email, phone) ON public.therapists FROM anon;