
DO $$ BEGIN
  CREATE TYPE public.event_status AS ENUM ('draft','pending_review','published','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.event_format AS ENUM ('in_person','online','hybrid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.event_category AS ENUM ('atelier','conference','retraite','cercle','meditation','autre');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  title text NOT NULL,
  short_description text,
  long_description text,
  category public.event_category NOT NULL DEFAULT 'autre',
  event_date date,
  start_time time,
  end_time time,
  format public.event_format NOT NULL DEFAULT 'in_person',
  location text,
  online_link text,
  is_paid boolean NOT NULL DEFAULT false,
  price numeric(10,2),
  price_description text,
  reduced_price numeric(10,2),
  reduced_price_description text,
  seats integer,
  enable_waitlist boolean NOT NULL DEFAULT false,
  image_url text,
  status public.event_status NOT NULL DEFAULT 'draft',
  rejection_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_therapist_id_idx ON public.events(therapist_id);
CREATE INDEX IF NOT EXISTS events_status_idx ON public.events(status);
CREATE INDEX IF NOT EXISTS events_event_date_idx ON public.events(event_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT ON public.events TO anon;
GRANT ALL ON public.events TO service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published events"
  ON public.events FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "Therapists can read own events"
  ON public.events FOR SELECT
  TO authenticated
  USING (therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid()));

CREATE POLICY "Therapists can insert own events"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid()));

CREATE POLICY "Therapists can update own events"
  ON public.events FOR UPDATE
  TO authenticated
  USING (therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid()))
  WITH CHECK (therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid()));

CREATE POLICY "Therapists can delete own events"
  ON public.events FOR DELETE
  TO authenticated
  USING (therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid()));

CREATE POLICY "Admins can read all events"
  ON public.events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all events"
  ON public.events FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete all events"
  ON public.events FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_events_updated_at ON public.events;
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
