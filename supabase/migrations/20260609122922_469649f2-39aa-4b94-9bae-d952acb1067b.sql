
-- ============================================
-- THERAPISTS (base table — required)
-- ============================================
CREATE TABLE IF NOT EXISTS public.therapists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  title text,
  short_bio text,
  bio text,
  photo_url text,
  specialties text[],
  approaches text[],
  languages text[],
  address text,
  postal_code text,
  city text,
  canton text,
  country text DEFAULT 'CH',
  latitude double precision,
  longitude double precision,
  consultation_modes text[],
  price_min numeric,
  price_max numeric,
  currency text DEFAULT 'CHF',
  insurance_accepted boolean DEFAULT false,
  email text,
  phone text,
  website text,
  status text NOT NULL DEFAULT 'active',
  verified boolean NOT NULL DEFAULT false,
  meta_title text,
  meta_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
GRANT SELECT ON public.therapists TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapists TO authenticated;
GRANT ALL ON public.therapists TO service_role;
ALTER TABLE public.therapists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read active therapists" ON public.therapists;
CREATE POLICY "public read active therapists" ON public.therapists FOR SELECT TO anon, authenticated USING (status = 'active');
DROP POLICY IF EXISTS "therapist manage own" ON public.therapists;
CREATE POLICY "therapist manage own" ON public.therapists FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
DROP TRIGGER IF EXISTS trg_therapists_updated_at ON public.therapists;
CREATE TRIGGER trg_therapists_updated_at BEFORE UPDATE ON public.therapists
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- AVAILABILITIES
-- ============================================
CREATE TABLE IF NOT EXISTS public.availabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.availabilities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availabilities TO authenticated;
GRANT ALL ON public.availabilities TO service_role;
ALTER TABLE public.availabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read availabilities" ON public.availabilities
  FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Therapist manage availabilities" ON public.availabilities
  FOR ALL TO authenticated
  USING (therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid()))
  WITH CHECK (therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid()));

-- ============================================
-- BLOCKED PERIODS
-- ============================================
CREATE TABLE IF NOT EXISTS public.blocked_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blocked_periods TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_periods TO authenticated;
GRANT ALL ON public.blocked_periods TO service_role;
ALTER TABLE public.blocked_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read blocked periods" ON public.blocked_periods
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Therapist manage blocked periods" ON public.blocked_periods
  FOR ALL TO authenticated
  USING (therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid()))
  WITH CHECK (therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid()));

-- ============================================
-- APPOINTMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  patient_name text NOT NULL,
  patient_email text NOT NULL,
  patient_phone text,
  appointment_date date NOT NULL,
  appointment_time time NOT NULL,
  duration_minutes int NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','completed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT INSERT ON public.appointments TO anon;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public create appointment" ON public.appointments
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Therapist manage appointments" ON public.appointments
  FOR ALL TO authenticated
  USING (therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid()))
  WITH CHECK (therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
