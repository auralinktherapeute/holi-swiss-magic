CREATE OR REPLACE FUNCTION public.therapists_lock_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Trusted server context (service_role / server functions): auth.uid() is NULL
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admins may change anything
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Therapist self-update: pin the protected fields to OLD.
  NEW.status         := OLD.status;
  NEW.verified       := OLD.verified;
  NEW.ide_verified   := OLD.ide_verified;
  NEW.siret_verified := OLD.siret_verified;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_therapist_self_elevation_trg ON public.therapists;