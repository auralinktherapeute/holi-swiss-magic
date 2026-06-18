
-- 1) Realtime publication for live badges
ALTER PUBLICATION supabase_realtime ADD TABLE public.therapists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.waiting_list;
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;

-- 2) Aggregated badge counts (admin-only)
CREATE OR REPLACE FUNCTION public.admin_badge_counts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  result jsonb;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO is_admin;
  IF NOT is_admin THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'therapists', (SELECT count(*) FROM public.therapists WHERE status = 'pending'),
    'waitlist',   (SELECT count(*) FROM public.waiting_list WHERE status = 'pending'),
    'events',     (SELECT count(*) FROM public.events WHERE status = 'pending_review'),
    'moderation', 0,
    'reviews',    0,
    'articles',   0,
    'subscriptions', 0
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_badge_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_badge_counts() TO authenticated;

-- 3) Email notification dispatcher via pg_net -> public route
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_admin_event(
  _kind text,
  _subject text,
  _summary text,
  _link text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  endpoint text := 'https://project--2c2ca56b-598e-4651-bc14-8ba533771ae9.lovable.app/api/public/admin-notify';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxd3VkbW5mYXZ2YXVrdWxkdWxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5OTg2MjUsImV4cCI6MjA5NjU3NDYyNX0.P-8PAwboYoul28Iqx_UMGH0c9_NPwBTsJPCkRMXKEpY';
BEGIN
  PERFORM net.http_post(
    url := endpoint,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', anon_key
    ),
    body := jsonb_build_object(
      'kind', _kind,
      'subject', _subject,
      'summary', _summary,
      'link', _link
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- never block the original write
  RAISE NOTICE 'notify_admin_event failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_admin_event(text, text, text, text) FROM PUBLIC;

-- 4) Trigger functions per event type
CREATE OR REPLACE FUNCTION public.trg_notify_new_therapist()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM public.notify_admin_event(
      'therapist_pending',
      'Nouveau thérapeute en attente de validation',
      coalesce(NEW.first_name,'') || ' ' || coalesce(NEW.last_name,'') || ' (' || coalesce(NEW.city,'') || ')',
      '/admin/therapeutes'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_notify_new_waitlist()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_admin_event(
    'waitlist_new',
    'Nouvelle inscription liste d''attente',
    coalesce(NEW.first_name,'') || ' ' || coalesce(NEW.last_name,'') || ' — ' || coalesce(NEW.email,''),
    '/admin/liste-attente'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_notify_event_submitted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'pending_review' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.notify_admin_event(
      'event_pending',
      'Nouvel événement soumis pour validation',
      NEW.title,
      '/admin/evenements'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_notify_appointment_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_admin_event(
    'appointment_new',
    'Nouvelle réservation',
    coalesce(NEW.patient_name,'patient') || ' — ' || NEW.appointment_date::text,
    '/admin'
  );
  RETURN NEW;
END;
$$;

-- 5) Attach triggers
DROP TRIGGER IF EXISTS notify_new_therapist ON public.therapists;
CREATE TRIGGER notify_new_therapist
  AFTER INSERT ON public.therapists
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_therapist();

DROP TRIGGER IF EXISTS notify_new_waitlist ON public.waiting_list;
CREATE TRIGGER notify_new_waitlist
  AFTER INSERT ON public.waiting_list
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_waitlist();

DROP TRIGGER IF EXISTS notify_event_submitted ON public.events;
CREATE TRIGGER notify_event_submitted
  AFTER INSERT OR UPDATE OF status ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_event_submitted();

DROP TRIGGER IF EXISTS notify_appointment_created ON public.appointments;
CREATE TRIGGER notify_appointment_created
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_appointment_created();
