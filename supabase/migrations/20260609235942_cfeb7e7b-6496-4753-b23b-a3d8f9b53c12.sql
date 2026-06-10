-- Restrict PII and sensitive column access via column-level GRANTs

-- Therapists: hide siret/ide from everyone except service_role (use therapist_private_identifiers)
REVOKE SELECT (siret, ide) ON public.therapists FROM anon, authenticated;

-- Therapists: hide email/phone from anonymous visitors
REVOKE SELECT (email, phone) ON public.therapists FROM anon;

-- Therapists: prevent self-escalation of verification status fields
REVOKE UPDATE (status, verified, ide_verified, siret_verified) ON public.therapists FROM anon, authenticated;

-- Blocked periods: hide reason from anonymous visitors (date ranges remain public)
REVOKE SELECT (reason) ON public.blocked_periods FROM anon;
