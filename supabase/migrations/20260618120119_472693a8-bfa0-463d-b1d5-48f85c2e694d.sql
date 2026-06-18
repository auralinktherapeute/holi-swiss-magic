
-- =====================================================
-- CRM Automatisations + Tables additionnelles (étape 2)
-- =====================================================

-- 1) Tables additionnelles : tags, pipelines, stages
CREATE TABLE IF NOT EXISTS public.crm_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('admin','therapist')),
  owner_id uuid NULL,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_pipelines TO authenticated;
GRANT ALL ON public.crm_pipelines TO service_role;
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage all pipelines" ON public.crm_pipelines
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Therapists manage own pipelines" ON public.crm_pipelines
  FOR ALL TO authenticated
  USING (scope='therapist' AND owner_id = auth.uid())
  WITH CHECK (scope='therapist' AND owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.crm_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_stages TO authenticated;
GRANT ALL ON public.crm_stages TO service_role;
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stages follow pipeline access" ON public.crm_stages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crm_pipelines p WHERE p.id = pipeline_id
    AND (public.has_role(auth.uid(),'admin') OR (p.scope='therapist' AND p.owner_id = auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crm_pipelines p WHERE p.id = pipeline_id
    AND (public.has_role(auth.uid(),'admin') OR (p.scope='therapist' AND p.owner_id = auth.uid()))));

CREATE TABLE IF NOT EXISTS public.crm_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('admin','therapist')),
  owner_id uuid NULL,
  name text NOT NULL,
  color text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, owner_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tags TO authenticated;
GRANT ALL ON public.crm_tags TO service_role;
ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage all tags" ON public.crm_tags
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Therapists manage own tags" ON public.crm_tags
  FOR ALL TO authenticated
  USING (scope='therapist' AND owner_id = auth.uid())
  WITH CHECK (scope='therapist' AND owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.crm_contact_tags (
  contact_id uuid NOT NULL REFERENCES public.crm_client_contacts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.crm_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, tag_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contact_tags TO authenticated;
GRANT ALL ON public.crm_contact_tags TO service_role;
ALTER TABLE public.crm_contact_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins all contact tags" ON public.crm_contact_tags
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Therapists own contact tags" ON public.crm_contact_tags
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crm_client_contacts c
    JOIN public.therapists t ON t.id = c.therapist_id
    WHERE c.id = contact_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crm_client_contacts c
    JOIN public.therapists t ON t.id = c.therapist_id
    WHERE c.id = contact_id AND t.user_id = auth.uid()));

-- =====================================================
-- 2) AUTOMATISATIONS — Triggers admin
-- =====================================================

-- Nouveau thérapeute → fiche CRM auto
CREATE OR REPLACE FUNCTION public.trg_crm_lead_from_therapist()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.crm_leads (
    first_name, last_name, email, phone, canton, specialty,
    source, status, priority, converted_therapist_id
  ) VALUES (
    NEW.first_name, NEW.last_name, NEW.email, NEW.phone, NEW.city,
    COALESCE((NEW.specialties)[1], NULL),
    'inscription', 'pending', 'normal', NEW.id
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS therapist_to_crm_lead ON public.therapists;
CREATE TRIGGER therapist_to_crm_lead
  AFTER INSERT ON public.therapists
  FOR EACH ROW EXECUTE FUNCTION public.trg_crm_lead_from_therapist();

-- Changement de plan → activité CRM + mise à jour lead
CREATE OR REPLACE FUNCTION public.trg_crm_plan_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.subscription_plan IS DISTINCT FROM OLD.subscription_plan THEN
    INSERT INTO public.crm_activities (entity_type, entity_id, therapist_id, type, title, body, metadata)
    VALUES ('therapist', NEW.id, NEW.id, 'plan_change',
      'Changement de plan',
      COALESCE(OLD.subscription_plan,'free') || ' → ' || COALESCE(NEW.subscription_plan,'free'),
      jsonb_build_object('from', OLD.subscription_plan, 'to', NEW.subscription_plan));

    UPDATE public.crm_leads
      SET status = CASE WHEN NEW.subscription_plan = 'elite_pro' THEN 'elite_pro' ELSE status END,
          updated_at = now()
      WHERE converted_therapist_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS therapist_plan_change ON public.therapists;
CREATE TRIGGER therapist_plan_change
  AFTER UPDATE OF subscription_plan ON public.therapists
  FOR EACH ROW EXECUTE FUNCTION public.trg_crm_plan_change();

-- Nouveau lead liste d'attente → pipeline
CREATE OR REPLACE FUNCTION public.trg_crm_lead_from_waitlist()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.crm_leads (
    first_name, last_name, email, phone, canton, specialty,
    source, status, priority
  ) VALUES (
    NEW.first_name, NEW.last_name, NEW.email, NEW.phone,
    NULLIF(NEW.canton,''), NULLIF(NEW.specialty,''),
    'waitlist', 'new', 'normal'
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS waitlist_to_crm_lead ON public.waiting_list;
CREATE TRIGGER waitlist_to_crm_lead
  AFTER INSERT ON public.waiting_list
  FOR EACH ROW EXECUTE FUNCTION public.trg_crm_lead_from_waitlist();

-- =====================================================
-- 3) AUTOMATISATIONS — Triggers thérapeute Elite Pro
-- =====================================================

-- Réservation : upsert contact + timeline
CREATE OR REPLACE FUNCTION public.trg_crm_contact_from_appointment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_elite boolean;
  v_user_id uuid;
  v_contact_id uuid;
  v_existing_id uuid;
  v_fn text;
  v_ln text;
BEGIN
  SELECT user_id, (subscription_plan = 'elite_pro')
    INTO v_user_id, v_is_elite
  FROM public.therapists WHERE id = NEW.therapist_id;

  IF NOT COALESCE(v_is_elite, false) THEN
    RETURN NEW;
  END IF;

  -- split patient_name
  v_fn := split_part(COALESCE(NEW.patient_name,''), ' ', 1);
  v_ln := NULLIF(regexp_replace(COALESCE(NEW.patient_name,''), '^\S+\s*', ''), '');

  -- upsert manuel sur email (si fourni) sinon sur nom
  SELECT id INTO v_existing_id FROM public.crm_client_contacts
    WHERE therapist_id = NEW.therapist_id
      AND (
        (NEW.patient_email IS NOT NULL AND email = NEW.patient_email)
        OR (NEW.patient_email IS NULL AND first_name = v_fn AND COALESCE(last_name,'') = COALESCE(v_ln,''))
      )
    LIMIT 1;

  IF v_existing_id IS NULL THEN
    INSERT INTO public.crm_client_contacts (
      therapist_id, first_name, last_name, email, phone,
      session_type, relation_status, last_booking_at, next_booking_at
    ) VALUES (
      NEW.therapist_id, v_fn, v_ln, NEW.patient_email, NEW.patient_phone,
      NEW.service_name, 'nouveau_client', NEW.created_at, NEW.start_time
    ) RETURNING id INTO v_contact_id;
  ELSE
    UPDATE public.crm_client_contacts
      SET last_booking_at = GREATEST(COALESCE(last_booking_at, NEW.created_at), NEW.created_at),
          next_booking_at = CASE
            WHEN NEW.start_time > now() AND (next_booking_at IS NULL OR NEW.start_time < next_booking_at)
              THEN NEW.start_time
            ELSE next_booking_at END,
          relation_status = CASE
            WHEN relation_status IN ('prospect','nouveau_client') THEN 'client_actif'
            ELSE relation_status END,
          phone = COALESCE(phone, NEW.patient_phone),
          updated_at = now()
      WHERE id = v_existing_id
      RETURNING id INTO v_contact_id;
  END IF;

  INSERT INTO public.crm_activities (
    entity_type, entity_id, therapist_id, owner_id, type, title, body, metadata, occurred_at
  ) VALUES (
    'contact', v_contact_id, NEW.therapist_id, v_user_id, 'booking',
    'Nouvelle réservation', NEW.service_name,
    jsonb_build_object('appointment_id', NEW.id, 'date', NEW.start_time),
    COALESCE(NEW.created_at, now())
  );

  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS appointment_to_crm_contact ON public.appointments;
CREATE TRIGGER appointment_to_crm_contact
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.trg_crm_contact_from_appointment();

-- Annulation → tag "à relancer"
CREATE OR REPLACE FUNCTION public.trg_crm_appointment_cancel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_contact_id uuid;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    SELECT id INTO v_contact_id FROM public.crm_client_contacts
      WHERE therapist_id = NEW.therapist_id
        AND ((NEW.patient_email IS NOT NULL AND email = NEW.patient_email)
          OR (NEW.patient_email IS NULL AND first_name = split_part(COALESCE(NEW.patient_name,''),' ',1)))
      LIMIT 1;

    IF v_contact_id IS NOT NULL THEN
      UPDATE public.crm_client_contacts
        SET tags = CASE WHEN 'a_relancer' = ANY(COALESCE(tags,'{}'::text[]))
                        THEN tags ELSE array_append(COALESCE(tags,'{}'::text[]), 'a_relancer') END,
            relation_status = 'a_relancer',
            updated_at = now()
        WHERE id = v_contact_id;

      INSERT INTO public.crm_activities (entity_type, entity_id, therapist_id, type, title, body, occurred_at)
      VALUES ('contact', v_contact_id, NEW.therapist_id, 'cancellation',
        'Annulation', NEW.service_name, now());
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS appointment_cancel_crm ON public.appointments;
CREATE TRIGGER appointment_cancel_crm
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.trg_crm_appointment_cancel();

-- =====================================================
-- 4) Maintenance quotidienne (à appeler via pg_cron)
-- =====================================================
CREATE OR REPLACE FUNCTION public.crm_daily_maintenance()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stale_leads int := 0;
  v_inactive int := 0;
BEGIN
  -- Leads sans relance depuis 14j → status 'followup' + tâche
  WITH stale AS (
    SELECT id, assigned_to FROM public.crm_leads
    WHERE status IN ('new','pending','contacted')
      AND COALESCE(last_contact_at, created_at) < now() - interval '14 days'
  ),
  upd AS (
    UPDATE public.crm_leads l
      SET status = 'followup', updated_at = now()
      FROM stale WHERE l.id = stale.id
      RETURNING l.id, l.assigned_to
  )
  SELECT count(*) INTO v_stale_leads FROM upd;

  INSERT INTO public.crm_tasks (owner_id, entity_type, entity_id, title, priority, due_at)
  SELECT assigned_to, 'lead', id, 'Relance automatique — lead sans réponse', 'high', now() + interval '1 day'
  FROM public.crm_leads
  WHERE status = 'followup'
    AND NOT EXISTS (
      SELECT 1 FROM public.crm_tasks t
      WHERE t.entity_type='lead' AND t.entity_id = crm_leads.id AND t.done_at IS NULL
    );

  -- Contacts thérapeute sans réservation depuis 60j → 'inactif'
  WITH inact AS (
    UPDATE public.crm_client_contacts
      SET relation_status = 'inactif', updated_at = now()
      WHERE COALESCE(last_booking_at, created_at) < now() - interval '60 days'
        AND relation_status <> 'inactif'
      RETURNING id
  )
  SELECT count(*) INTO v_inactive FROM inact;

  RETURN jsonb_build_object('stale_leads', v_stale_leads, 'inactive_contacts', v_inactive, 'ran_at', now());
END $$;
GRANT EXECUTE ON FUNCTION public.crm_daily_maintenance() TO service_role;
