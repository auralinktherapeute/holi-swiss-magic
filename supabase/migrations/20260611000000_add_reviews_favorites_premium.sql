-- is_premium sur therapists
ALTER TABLE public.therapists ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;

-- Table reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  therapist_reply text,
  replied_at timestamptz,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden','pending')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published reviews" ON public.reviews
  FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "Patient insert own review" ON public.reviews
  FOR INSERT TO authenticated WITH CHECK (patient_id = auth.uid());
CREATE POLICY "Therapist reply own review" ON public.reviews
  FOR UPDATE TO authenticated
  USING (therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid()))
  WITH CHECK (therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid()));

-- Table favorites
CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, therapist_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User manage own favorites" ON public.favorites
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
