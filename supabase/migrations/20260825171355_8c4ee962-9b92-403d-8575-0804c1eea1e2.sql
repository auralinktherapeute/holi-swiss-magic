-- 1) Colonnes normalisées + cycle de vie sur crm_leads
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS email_norm text
    GENERATED ALWAYS AS (NULLIF(lower(btrim(email)), '')) STORED,
  ADD COLUMN IF NOT EXISTS phone_norm text
    GENERATED ALWAYS AS (
      CASE
        WHEN phone IS NULL OR regexp_replace(phone, '\D', '', 'g') = '' THEN NULL
        WHEN left(regexp_replace(phone, '\D', '', 'g'), 2) = '41' THEN regexp_replace(phone, '\D', '', 'g')
        WHEN left(regexp_replace(phone, '\D', '', 'g'), 1) = '0' THEN '41' || substr(regexp_replace(phone, '\D', '', 'g'), 2)
        ELSE regexp_replace(phone, '\D', '', 'g')
      END
    ) STORED,
  ADD COLUMN IF NOT EXISTS name_norm text
    GENERATED ALWAYS AS (
      NULLIF(btrim(regexp_replace(lower(public.immutable_unaccent(coalesce(first_name,'') || ' ' || coalesce(last_name,''))), '[^a-z0-9]+', ' ', 'g')), '')
    ) STORED,
  ADD COLUMN IF NOT EXISTS dedup_status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS merged_into_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.crm_leads DROP CONSTRAINT IF EXISTS crm_leads_dedup_status_check;
ALTER TABLE public.crm_leads
  ADD CONSTRAINT crm_leads_dedup_status_check
  CHECK (dedup_status IN ('open','ignored','confirmed','merged'));

CREATE INDEX IF NOT EXISTS crm_leads_email_norm_idx ON public.crm_leads(email_norm);
CREATE INDEX IF NOT EXISTS crm_leads_phone_norm_idx ON public.crm_leads(phone_norm);
CREATE INDEX IF NOT EXISTS crm_leads_name_norm_idx ON public.crm_leads(name_norm);
CREATE INDEX IF NOT EXISTS crm_leads_dedup_status_idx ON public.crm_leads(dedup_status);
CREATE INDEX IF NOT EXISTS crm_leads_merged_into_idx ON public.crm_leads(merged_into_id);
CREATE INDEX IF NOT EXISTS crm_leads_converted_therapist_idx ON public.crm_leads(converted_therapist_id);

-- 2) Journal des fusions (snapshot + rollback)
CREATE TABLE IF NOT EXISTS public.crm_merge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_lead_id uuid NOT NULL,
  merged_lead_ids uuid[] NOT NULL,
  performed_by uuid,
  snapshot jsonb NOT NULL,
  reassigned jsonb NOT NULL DEFAULT '{}'::jsonb,
  reverted_at timestamptz,
  reverted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.crm_merge_log TO authenticated;
GRANT ALL ON public.crm_merge_log TO service_role;
ALTER TABLE public.crm_merge_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read merge log" ON public.crm_merge_log;
CREATE POLICY "Admins read merge log" ON public.crm_merge_log
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS crm_merge_log_primary_idx ON public.crm_merge_log(primary_lead_id);

-- 3) Journal des modifications de champs
CREATE TABLE IF NOT EXISTS public.crm_field_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid,
  origin text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.crm_field_history TO authenticated;
GRANT ALL ON public.crm_field_history TO service_role;
ALTER TABLE public.crm_field_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read field history" ON public.crm_field_history;
CREATE POLICY "Admins read field history" ON public.crm_field_history
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS crm_field_history_entity_idx
  ON public.crm_field_history(entity_type, entity_id, created_at DESC);

-- 4) Helpers de normalisation (miroir des colonnes générées)
CREATE OR REPLACE FUNCTION public.crm_norm_email(_v text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT NULLIF(lower(btrim(_v)), '')
$$;

CREATE OR REPLACE FUNCTION public.crm_norm_phone(_v text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _v IS NULL OR regexp_replace(_v, '\D', '', 'g') = '' THEN NULL
    WHEN left(regexp_replace(_v, '\D', '', 'g'), 2) = '41' THEN regexp_replace(_v, '\D', '', 'g')
    WHEN left(regexp_replace(_v, '\D', '', 'g'), 1) = '0' THEN '41' || substr(regexp_replace(_v, '\D', '', 'g'), 2)
    ELSE regexp_replace(_v, '\D', '', 'g')
  END
$$;

REVOKE EXECUTE ON FUNCTION public.crm_norm_email(text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.crm_norm_phone(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crm_norm_email(text) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_norm_phone(text) TO service_role, authenticated;

-- 5) Recherche d'une fiche existante (email puis téléphone + nom cohérent)
CREATE OR REPLACE FUNCTION public.crm_find_existing_lead(_email text, _phone text, _therapist_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_email text := public.crm_norm_email(_email);
  v_phone text := public.crm_norm_phone(_phone);
BEGIN
  IF _therapist_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.crm_leads
      WHERE converted_therapist_id = _therapist_id AND dedup_status <> 'merged'
      ORDER BY created_at ASC LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  IF v_email IS NOT NULL THEN
    SELECT id INTO v_id FROM public.crm_leads
      WHERE email_norm = v_email AND dedup_status <> 'merged'
      ORDER BY created_at ASC LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  IF v_phone IS NOT NULL THEN
    SELECT id INTO v_id FROM public.crm_leads
      WHERE phone_norm = v_phone AND dedup_status <> 'merged'
      ORDER BY created_at ASC LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  RETURN NULL;
END $$;

REVOKE EXECUTE ON FUNCTION public.crm_find_existing_lead(text, text, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_find_existing_lead(text, text, uuid) TO service_role;

-- 6) Triggers : rattachement au lieu de duplication
CREATE OR REPLACE FUNCTION public.trg_crm_lead_from_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  v_id := public.crm_find_existing_lead(NEW.email, NEW.phone, NULL);

  IF v_id IS NULL THEN
    INSERT INTO public.crm_leads (
      first_name, last_name, email, phone, canton, specialty, source, status, priority
    ) VALUES (
      NEW.first_name, NEW.last_name, NEW.email, NEW.phone,
      NULLIF(NEW.canton,''), NULLIF(NEW.specialty,''), 'waitlist', 'new', 'normal'
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.crm_leads SET
      phone     = COALESCE(phone, NEW.phone),
      canton    = COALESCE(canton, NULLIF(NEW.canton,'')),
      specialty = COALESCE(specialty, NULLIF(NEW.specialty,'')),
      updated_at = now()
    WHERE id = v_id;

    INSERT INTO public.crm_field_history (entity_type, entity_id, field, old_value, new_value, origin)
    VALUES ('lead', v_id, 'source', NULL, 'waitlist', 'trigger_waitlist');
  END IF;

  INSERT INTO public.crm_activities (entity_type, entity_id, type, title, body, metadata, occurred_at)
  VALUES ('lead', v_id, 'status_change', 'Inscription liste d''attente',
          NULLIF(NEW.message, ''), jsonb_build_object('waiting_list_id', NEW.id),
          COALESCE(NEW.created_at, now()));

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.trg_crm_lead_from_therapist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  v_id := public.crm_find_existing_lead(NEW.email, NEW.phone, NEW.id);

  IF v_id IS NULL THEN
    INSERT INTO public.crm_leads (
      first_name, last_name, email, phone, canton, specialty,
      source, status, priority, converted_therapist_id
    ) VALUES (
      NEW.first_name, NEW.last_name, NEW.email, NEW.phone, NEW.city,
      COALESCE((NEW.specialties)[1], NULL),
      'inscription', 'pending', 'normal', NEW.id
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.crm_leads SET
      converted_therapist_id = COALESCE(converted_therapist_id, NEW.id),
      first_name = COALESCE(NULLIF(NEW.first_name,''), first_name),
      last_name  = COALESCE(NULLIF(NEW.last_name,''), last_name),
      email      = COALESCE(email, NEW.email),
      phone      = COALESCE(phone, NEW.phone),
      canton     = COALESCE(canton, NEW.city),
      specialty  = COALESCE(specialty, (NEW.specialties)[1]),
      status     = CASE WHEN status IN ('new','pending','contacted','followup') THEN 'pending' ELSE status END,
      updated_at = now()
    WHERE id = v_id;

    INSERT INTO public.crm_field_history (entity_type, entity_id, field, old_value, new_value, origin)
    VALUES ('lead', v_id, 'converted_therapist_id', NULL, NEW.id::text, 'trigger_inscription');
  END IF;

  INSERT INTO public.crm_activities (entity_type, entity_id, therapist_id, type, title, metadata, occurred_at)
  VALUES ('lead', v_id, NEW.id, 'status_change', 'Inscription thérapeute créée',
          jsonb_build_object('therapist_id', NEW.id), COALESCE(NEW.created_at, now()));

  RETURN NEW;
END $$;
