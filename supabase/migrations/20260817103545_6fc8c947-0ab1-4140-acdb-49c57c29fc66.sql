CREATE OR REPLACE FUNCTION public.therapists_lock_admin_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  NEW.status         := OLD.status;
  NEW.verified       := OLD.verified;
  NEW.ide_verified   := OLD.ide_verified;
  NEW.siret_verified := OLD.siret_verified;

  -- Consentement newsletter : uniquement modifiable par le serveur (service_role)
  NEW.newsletter_opt_in            := OLD.newsletter_opt_in;
  NEW.newsletter_opt_in_at         := OLD.newsletter_opt_in_at;
  NEW.newsletter_unsubscribed_at   := OLD.newsletter_unsubscribed_at;
  NEW.newsletter_consent_source    := OLD.newsletter_consent_source;
  NEW.newsletter_consent_version   := OLD.newsletter_consent_version;
  NEW.newsletter_consent_email     := OLD.newsletter_consent_email;
  NEW.newsletter_unsubscribe_token := OLD.newsletter_unsubscribe_token;

  RETURN NEW;
END;
$function$;