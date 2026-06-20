
-- 0. Étendre les statuts autorisés
ALTER TABLE public.crm_leads DROP CONSTRAINT IF EXISTS crm_leads_status_check;
ALTER TABLE public.crm_leads ADD CONSTRAINT crm_leads_status_check
  CHECK (status = ANY (ARRAY[
    'new','pending','contacted','followup','active','loyal',
    'converted','elite_pro','suspended'
  ]));

-- 1. Backfill
INSERT INTO public.crm_leads (
  first_name, last_name, email, phone, canton, specialty,
  source, status, priority, converted_therapist_id, created_at
)
SELECT
  t.first_name, t.last_name, t.email, t.phone, t.city,
  COALESCE((t.specialties)[1], NULL),
  'inscription',
  CASE
    WHEN t.status = 'active'    THEN 'active'
    WHEN t.status = 'suspended' THEN 'suspended'
    WHEN t.status = 'rejected'  THEN 'suspended'
    WHEN t.status = 'pending'   THEN 'pending'
    ELSE 'new'
  END,
  'normal', t.id, t.created_at
FROM public.therapists t
WHERE NOT EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.converted_therapist_id = t.id);

-- 2. Isolation notes privées : retirer admin de la policy
DROP POLICY IF EXISTS "Therapist manages own contacts" ON public.crm_client_contacts;
CREATE POLICY "Therapist manages own contacts (no admin)"
  ON public.crm_client_contacts FOR ALL TO authenticated
  USING (therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid()))
  WITH CHECK (therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid()));

-- 3. Stats agrégées admin (sans accès aux notes)
CREATE OR REPLACE FUNCTION public.admin_therapist_client_stats()
RETURNS TABLE (therapist_id uuid, total_contacts int, active_contacts int, recent_contacts int, last_booking_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cc.therapist_id,
    count(*)::int,
    count(*) FILTER (WHERE relation_status = 'client_actif')::int,
    count(*) FILTER (WHERE last_booking_at > now() - interval '30 days')::int,
    max(last_booking_at)
  FROM public.crm_client_contacts cc
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
  GROUP BY cc.therapist_id;
$$;
GRANT EXECUTE ON FUNCTION public.admin_therapist_client_stats() TO authenticated;

-- 4. Auto-sync statut therapist → lead
CREATE OR REPLACE FUNCTION public.trg_crm_lead_sync_from_therapist()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new_status text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_new_status := CASE
      WHEN NEW.status = 'active'    THEN 'active'
      WHEN NEW.status = 'suspended' THEN 'suspended'
      WHEN NEW.status = 'rejected'  THEN 'suspended'
      WHEN NEW.status = 'pending'   THEN 'pending'
      ELSE NULL END;
    IF v_new_status IS NOT NULL THEN
      UPDATE public.crm_leads SET status = v_new_status, updated_at = now()
        WHERE converted_therapist_id = NEW.id AND status <> 'loyal';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS therapist_status_to_crm_lead ON public.therapists;
CREATE TRIGGER therapist_status_to_crm_lead
  AFTER UPDATE OF status ON public.therapists
  FOR EACH ROW EXECUTE FUNCTION public.trg_crm_lead_sync_from_therapist();

-- 5. Auto-promotion en 'loyal' après 10 RDV honorés
CREATE OR REPLACE FUNCTION public.trg_crm_lead_promote_loyal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NEW.status IN ('confirmed','completed') AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT count(*) INTO v_count FROM public.appointments
      WHERE therapist_id = NEW.therapist_id AND status IN ('confirmed','completed');
    IF v_count >= 10 THEN
      UPDATE public.crm_leads SET status = 'loyal', updated_at = now()
        WHERE converted_therapist_id = NEW.therapist_id
          AND status NOT IN ('loyal','suspended');
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS appointment_promote_loyal_lead ON public.appointments;
CREATE TRIGGER appointment_promote_loyal_lead
  AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.trg_crm_lead_promote_loyal();
