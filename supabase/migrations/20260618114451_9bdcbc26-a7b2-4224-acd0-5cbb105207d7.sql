
-- 1. Ajout plan d'abonnement sur therapists
ALTER TABLE public.therapists
  ADD COLUMN IF NOT EXISTS subscription_plan text NOT NULL DEFAULT 'free'
    CHECK (subscription_plan IN ('free','pro','elite_pro'));

-- 2. Helper Elite Pro
CREATE OR REPLACE FUNCTION public.is_elite_pro(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.therapists
    WHERE user_id = _user_id AND subscription_plan = 'elite_pro'
  );
$$;

-- 3. crm_leads
CREATE TABLE public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  canton text,
  specialty text,
  source text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','pending','contacted','followup','converted','elite_pro','suspended')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  last_contact_at timestamptz,
  converted_therapist_id uuid REFERENCES public.therapists(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_leads TO authenticated;
GRANT ALL ON public.crm_leads TO service_role;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage crm_leads" ON public.crm_leads
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER update_crm_leads_updated_at BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_crm_leads_status ON public.crm_leads(status);
CREATE INDEX idx_crm_leads_assigned ON public.crm_leads(assigned_to);

-- 4. crm_client_contacts (avant activities/tasks pour FK logique)
CREATE TABLE public.crm_client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  session_type text,
  relation_status text NOT NULL DEFAULT 'prospect'
    CHECK (relation_status IN ('prospect','new','active','followup','inactive')),
  tags text[] NOT NULL DEFAULT '{}',
  last_booking_at timestamptz,
  next_booking_at timestamptz,
  private_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_client_contacts TO authenticated;
GRANT ALL ON public.crm_client_contacts TO service_role;
ALTER TABLE public.crm_client_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Therapist manages own contacts" ON public.crm_client_contacts
  FOR ALL TO authenticated
  USING (
    therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(),'admin')
  )
  WITH CHECK (
    therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(),'admin')
  );
CREATE TRIGGER update_crm_client_contacts_updated_at BEFORE UPDATE ON public.crm_client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_crm_contacts_therapist ON public.crm_client_contacts(therapist_id);
CREATE INDEX idx_crm_contacts_status ON public.crm_client_contacts(relation_status);

-- 5. crm_activities (timeline polymorphique)
CREATE TABLE public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('lead','therapist','client_contact')),
  entity_id uuid NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  therapist_id uuid REFERENCES public.therapists(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('email','call','note','status_change','task','booking','review','message')),
  title text NOT NULL,
  body text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_activities TO authenticated;
GRANT ALL ON public.crm_activities TO service_role;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin or owner therapist read activities" ON public.crm_activities
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR (entity_type IN ('client_contact','therapist')
        AND therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid()))
  );
CREATE POLICY "Admin or owner therapist write activities" ON public.crm_activities
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR (entity_type IN ('client_contact','therapist')
        AND therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid()))
  );
CREATE POLICY "Admin updates activities" ON public.crm_activities
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR owner_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'admin') OR owner_id = auth.uid());
CREATE POLICY "Admin or owner deletes activities" ON public.crm_activities
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR owner_id = auth.uid());
CREATE INDEX idx_crm_activities_entity ON public.crm_activities(entity_type, entity_id);
CREATE INDEX idx_crm_activities_therapist ON public.crm_activities(therapist_id);

-- 6. crm_tasks
CREATE TABLE public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  therapist_id uuid REFERENCES public.therapists(id) ON DELETE CASCADE,
  entity_type text CHECK (entity_type IN ('lead','therapist','client_contact')),
  entity_id uuid,
  title text NOT NULL,
  description text,
  due_at timestamptz,
  done_at timestamptz,
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tasks TO authenticated;
GRANT ALL ON public.crm_tasks TO service_role;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin or therapist read tasks" ON public.crm_tasks
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid())
    OR owner_id = auth.uid()
  );
CREATE POLICY "Admin or therapist write tasks" ON public.crm_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid())
    OR owner_id = auth.uid()
  );
CREATE POLICY "Admin or owner update tasks" ON public.crm_tasks
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR owner_id = auth.uid()
    OR therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR owner_id = auth.uid()
    OR therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid())
  );
CREATE POLICY "Admin or owner delete tasks" ON public.crm_tasks
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR owner_id = auth.uid()
    OR therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid())
  );
CREATE TRIGGER update_crm_tasks_updated_at BEFORE UPDATE ON public.crm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_crm_tasks_due ON public.crm_tasks(due_at) WHERE done_at IS NULL;
CREATE INDEX idx_crm_tasks_therapist ON public.crm_tasks(therapist_id);
