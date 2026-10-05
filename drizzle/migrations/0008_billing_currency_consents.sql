-- 1. Devise spécifique par client (exception à la devise du cabinet)
ALTER TABLE public.crm_client_contacts ADD COLUMN IF NOT EXISTS billing_currency text;
DO $$ BEGIN
  ALTER TABLE public.crm_client_contacts ADD CONSTRAINT crm_client_contacts_billing_currency_chk
    CHECK (billing_currency IS NULL OR billing_currency IN ('CHF','EUR'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Instantané de devise sur les réservations futures (anciennes lignes : NULL = historique CHF)
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS currency text;
DO $$ BEGIN
  ALTER TABLE public.appointments ADD CONSTRAINT appointments_currency_chk
    CHECK (currency IS NULL OR currency IN ('CHF','EUR'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Registre append-only des consentements de changement de devise
CREATE TABLE IF NOT EXISTS public.currency_change_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.crm_client_contacts(id) ON DELETE SET NULL,
  change_type text NOT NULL CHECK (change_type IN ('practice_currency_change','client_currency_change')),
  old_currency text NOT NULL CHECK (old_currency IN ('CHF','EUR')),
  new_currency text NOT NULL CHECK (new_currency IN ('CHF','EUR')),
  old_source text,
  new_source text,
  warning_text text NOT NULL CHECK (length(warning_text) > 20),
  text_version text NOT NULL,
  text_language text NOT NULL,
  acknowledged boolean NOT NULL CHECK (acknowledged = true),
  price_confirmations jsonb NOT NULL DEFAULT '[]'::jsonb,
  actor_user_id uuid NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now(),
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS currency_change_consents_therapist_idx ON public.currency_change_consents(therapist_id, consented_at DESC);
CREATE INDEX IF NOT EXISTS currency_change_consents_client_idx ON public.currency_change_consents(client_id);

GRANT SELECT ON public.currency_change_consents TO authenticated;
GRANT ALL ON public.currency_change_consents TO service_role;
ALTER TABLE public.currency_change_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Therapist reads own currency consents" ON public.currency_change_consents;
CREATE POLICY "Therapist reads own currency consents" ON public.currency_change_consents
  FOR SELECT TO authenticated USING (public.is_therapist_owner(therapist_id));
DROP POLICY IF EXISTS "Admin reads currency consents" ON public.currency_change_consents;
CREATE POLICY "Admin reads currency consents" ON public.currency_change_consents
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.currency_consents_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'currency_change_consents est en ajout seul';
END $$;
DROP TRIGGER IF EXISTS currency_consents_no_update ON public.currency_change_consents;
CREATE TRIGGER currency_consents_no_update BEFORE UPDATE OR DELETE ON public.currency_change_consents
  FOR EACH ROW EXECUTE FUNCTION public.currency_consents_append_only();

-- 4. Verrou : la devise ne change que via les fonctions avec consentement
CREATE OR REPLACE FUNCTION public.guard_currency_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'therapist_invoice_settings' THEN
    IF NEW.devise_defaut IS DISTINCT FROM OLD.devise_defaut
       AND coalesce(current_setting('holiswiss.currency_change', true), '') <> 'on' THEN
      RAISE EXCEPTION 'Changement de devise : confirmation obligatoire';
    END IF;
  ELSIF TG_TABLE_NAME = 'crm_client_contacts' THEN
    IF NEW.billing_currency IS DISTINCT FROM OLD.billing_currency
       AND coalesce(current_setting('holiswiss.currency_change', true), '') <> 'on' THEN
      RAISE EXCEPTION 'Changement de devise : confirmation obligatoire';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_currency_change ON public.therapist_invoice_settings;
CREATE TRIGGER guard_currency_change BEFORE UPDATE ON public.therapist_invoice_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_currency_change();
DROP TRIGGER IF EXISTS guard_currency_change ON public.crm_client_contacts;
CREATE TRIGGER guard_currency_change BEFORE UPDATE ON public.crm_client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.guard_currency_change();

-- 5. Instantané devise sur nouvelles réservations
CREATE OR REPLACE FUNCTION public.appointments_fill_currency()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.currency IS NULL THEN
    IF NEW.client_id IS NOT NULL THEN
      SELECT billing_currency INTO NEW.currency FROM public.crm_client_contacts
       WHERE id = NEW.client_id AND therapist_id = NEW.therapist_id;
    END IF;
    IF NEW.currency IS NULL THEN
      SELECT devise_defaut INTO NEW.currency FROM public.therapist_invoice_settings
       WHERE therapist_id = NEW.therapist_id;
    END IF;
    NEW.currency := coalesce(NEW.currency, 'CHF');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.appointments_fill_currency() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS zz_appointments_fill_currency ON public.appointments;
CREATE TRIGGER zz_appointments_fill_currency BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.appointments_fill_currency();

-- 6. Changement de devise du cabinet (transactionnel)
CREATE OR REPLACE FUNCTION public.change_practice_currency(
  _new text, _warning text, _version text, _lang text, _ack boolean, _prices jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _tid uuid;
  _old text;
  _svc record;
  _p numeric;
  _conf jsonb := '[]'::jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF _new NOT IN ('CHF','EUR') THEN RAISE EXCEPTION 'Devise invalide'; END IF;
  IF _ack IS NOT TRUE THEN RAISE EXCEPTION 'Confirmation « J''ai compris » obligatoire'; END IF;
  SELECT id INTO _tid FROM public.therapists WHERE user_id = _uid LIMIT 1;
  IF _tid IS NULL THEN RAISE EXCEPTION 'Profil thérapeute introuvable'; END IF;
  SELECT devise_defaut INTO _old FROM public.therapist_invoice_settings WHERE therapist_id = _tid FOR UPDATE;
  IF _old IS NULL THEN RAISE EXCEPTION 'Enregistrez d''abord vos paramètres de facturation'; END IF;
  IF _old = _new THEN RAISE EXCEPTION 'La devise est déjà %', _new; END IF;

  FOR _svc IN SELECT id, name, price, currency FROM public.billing_services
               WHERE therapist_id = _tid AND is_active ORDER BY position LOOP
    SELECT (e->>'price')::numeric INTO _p FROM jsonb_array_elements(coalesce(_prices,'[]'::jsonb)) e
     WHERE e->>'id' = _svc.id::text LIMIT 1;
    IF _p IS NULL OR _p < 0 THEN
      RAISE EXCEPTION 'Tarif à confirmer pour « % »', _svc.name;
    END IF;
    _conf := _conf || jsonb_build_object('service_id', _svc.id, 'name', _svc.name,
      'old_price', _svc.price, 'old_currency', _svc.currency, 'new_price', _p, 'new_currency', _new);
    UPDATE public.billing_services SET price = _p, currency = _new, updated_at = now() WHERE id = _svc.id;
  END LOOP;

  INSERT INTO public.currency_change_consents(therapist_id, change_type, old_currency, new_currency,
    old_source, new_source, warning_text, text_version, text_language, acknowledged, price_confirmations, actor_user_id)
  VALUES (_tid, 'practice_currency_change', _old, _new, 'practice', 'practice', _warning, _version, _lang, true, _conf, _uid);

  PERFORM set_config('holiswiss.currency_change', 'on', true);
  UPDATE public.therapist_invoice_settings SET devise_defaut = _new WHERE therapist_id = _tid;
  PERFORM set_config('holiswiss.currency_change', 'off', true);
  RETURN jsonb_build_object('ok', true, 'currency', _new, 'services', jsonb_array_length(_conf));
END $$;
REVOKE EXECUTE ON FUNCTION public.change_practice_currency(text,text,text,text,boolean,jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.change_practice_currency(text,text,text,text,boolean,jsonb) TO authenticated;

-- 7. Exception de devise par client (transactionnel)
CREATE OR REPLACE FUNCTION public.change_client_currency(
  _client uuid, _new text, _warning text, _version text, _lang text, _ack boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _tid uuid;
  _cur text;
  _def text;
  _old_eff text; _new_eff text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF _new IS NOT NULL AND _new NOT IN ('CHF','EUR') THEN RAISE EXCEPTION 'Devise invalide'; END IF;
  SELECT id INTO _tid FROM public.therapists WHERE user_id = _uid LIMIT 1;
  IF _tid IS NULL THEN RAISE EXCEPTION 'Profil thérapeute introuvable'; END IF;
  SELECT billing_currency INTO _cur FROM public.crm_client_contacts
   WHERE id = _client AND therapist_id = _tid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client introuvable'; END IF;
  SELECT devise_defaut INTO _def FROM public.therapist_invoice_settings WHERE therapist_id = _tid;
  _def := coalesce(_def, 'CHF');
  _old_eff := coalesce(_cur, _def);
  _new_eff := coalesce(_new, _def);
  IF _cur IS NOT DISTINCT FROM _new THEN RETURN jsonb_build_object('ok', true, 'unchanged', true); END IF;

  IF _old_eff <> _new_eff THEN
    IF _ack IS NOT TRUE THEN RAISE EXCEPTION 'Confirmation « J''ai compris » obligatoire'; END IF;
    INSERT INTO public.currency_change_consents(therapist_id, client_id, change_type, old_currency, new_currency,
      old_source, new_source, warning_text, text_version, text_language, acknowledged, actor_user_id)
    VALUES (_tid, _client, 'client_currency_change', _old_eff, _new_eff,
      CASE WHEN _cur IS NULL THEN 'practice_default' ELSE 'client_override' END,
      CASE WHEN _new IS NULL THEN 'practice_default' ELSE 'client_override' END,
      _warning, _version, _lang, true, _uid);
  END IF;

  PERFORM set_config('holiswiss.currency_change', 'on', true);
  UPDATE public.crm_client_contacts SET billing_currency = _new, updated_at = now() WHERE id = _client;
  PERFORM set_config('holiswiss.currency_change', 'off', true);
  RETURN jsonb_build_object('ok', true, 'currency', _new_eff);
END $$;
REVOKE EXECUTE ON FUNCTION public.change_client_currency(uuid,text,text,text,text,boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.change_client_currency(uuid,text,text,text,text,boolean) TO authenticated;