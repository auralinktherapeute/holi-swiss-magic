
CREATE OR REPLACE FUNCTION public.prevent_therapist_self_elevation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service_role (server-side admin functions) — auth.uid() is NULL in that context
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allow real admins
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Force protected fields back to OLD values for non-admin updates
  NEW.status          := OLD.status;
  NEW.verified        := OLD.verified;
  NEW.ide_verified    := OLD.ide_verified;
  NEW.siret_verified  := OLD.siret_verified;

  RETURN NEW;
END;
$function$;
