
CREATE TABLE public.crm_intake_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  birth_date DATE,
  consultation_reason TEXT,
  medical_history TEXT,
  medications TEXT,
  allergies TEXT,
  consent_rgpd BOOLEAN NOT NULL DEFAULT false,
  consent_signature TEXT,
  consent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','converted','archived')),
  converted_contact_id UUID REFERENCES public.crm_client_contacts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.crm_intake_submissions TO authenticated;
GRANT INSERT ON public.crm_intake_submissions TO anon, authenticated;
GRANT ALL ON public.crm_intake_submissions TO service_role;

ALTER TABLE public.crm_intake_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a submission for any existing therapist
CREATE POLICY "Public can submit intake"
  ON public.crm_intake_submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    consent_rgpd = true
    AND EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = therapist_id AND t.status = 'active')
  );

-- Therapist owns their submissions (read/update/delete)
CREATE POLICY "Therapist reads own intake"
  ON public.crm_intake_submissions FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = therapist_id AND t.user_id = auth.uid()));

CREATE POLICY "Therapist updates own intake"
  ON public.crm_intake_submissions FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = therapist_id AND t.user_id = auth.uid()));

CREATE POLICY "Therapist deletes own intake"
  ON public.crm_intake_submissions FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = therapist_id AND t.user_id = auth.uid()));

CREATE INDEX idx_crm_intake_therapist ON public.crm_intake_submissions(therapist_id, status, created_at DESC);

CREATE TRIGGER update_crm_intake_updated_at
  BEFORE UPDATE ON public.crm_intake_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public lookup: minimal therapist info by slug (for intake form header)
CREATE OR REPLACE FUNCTION public.get_therapist_intake_header(_slug TEXT)
RETURNS TABLE(id UUID, first_name TEXT, last_name TEXT, title TEXT, photo_url TEXT, city TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.first_name, t.last_name, t.title, t.photo_url, t.city
  FROM public.therapists t
  WHERE t.slug = _slug AND t.status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_therapist_intake_header(TEXT) TO anon, authenticated;
