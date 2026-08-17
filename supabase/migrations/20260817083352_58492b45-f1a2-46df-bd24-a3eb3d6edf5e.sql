ALTER TABLE public.newsletter_sends
  ADD COLUMN IF NOT EXISTS delivered_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounced_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complained_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opened_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicked_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unsubscribed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS queued_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS details_purged_at timestamptz;

DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'public.newsletter_sends'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE public.newsletter_sends DROP CONSTRAINT %I', c); END IF;
END $$;

ALTER TABLE public.newsletter_sends
  ADD CONSTRAINT newsletter_sends_status_check CHECK (status IN
    ('test_sent','queued','sending','sent','partially_failed','failed','cancelled'));

ALTER TABLE public.newsletter_send_recipients
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_event_type text,
  ADD COLUMN IF NOT EXISTS last_event_at timestamptz;

CREATE INDEX IF NOT EXISTS newsletter_send_recipients_msg_idx
  ON public.newsletter_send_recipients (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.newsletter_send_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id uuid REFERENCES public.newsletter_sends(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.newsletter_send_recipients(id) ON DELETE SET NULL,
  provider_message_id text,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  detail text
);

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_send_events_provider_event_uidx
  ON public.newsletter_send_events (provider_event_id);
CREATE INDEX IF NOT EXISTS newsletter_send_events_send_idx
  ON public.newsletter_send_events (send_id, occurred_at DESC);

GRANT ALL ON public.newsletter_send_events TO service_role;
GRANT SELECT ON public.newsletter_send_events TO authenticated;
ALTER TABLE public.newsletter_send_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read newsletter send events" ON public.newsletter_send_events;
CREATE POLICY "Admins read newsletter send events"
  ON public.newsletter_send_events FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.purge_newsletter_send_details(_months integer DEFAULT 12)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cutoff timestamptz := now() - make_interval(months => greatest(_months, 1));
        n integer := 0;
BEGIN
  DELETE FROM public.newsletter_send_events e
   USING public.newsletter_sends s
   WHERE e.send_id = s.id AND s.started_at < cutoff;

  WITH del AS (
    DELETE FROM public.newsletter_send_recipients r
     USING public.newsletter_sends s
     WHERE r.send_id = s.id AND s.started_at < cutoff
     RETURNING r.id
  )
  SELECT count(*) INTO n FROM del;

  UPDATE public.newsletter_sends
     SET details_purged_at = now()
   WHERE started_at < cutoff AND details_purged_at IS NULL;

  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION public.purge_newsletter_send_details(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_newsletter_send_details(integer) TO service_role;