
-- ============================================================
-- 1. contact_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can create contact msg"
  ON public.contact_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "admin reads contact msg"
  ON public.contact_messages FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin updates contact msg"
  ON public.contact_messages FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER contact_messages_updated
  BEFORE UPDATE ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  subject text NOT NULL,
  summary text,
  link text,
  entity_type text,
  entity_id uuid,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedup
  ON public.notifications(kind, entity_type, entity_id)
  WHERE entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications(is_read, created_at DESC);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin reads notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin updates notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 3. notification_deliveries
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  channel text NOT NULL,         -- 'email' | 'whatsapp'
  target text NOT NULL,          -- destination
  status text NOT NULL DEFAULT 'pending', -- pending | sent | failed
  attempts int NOT NULL DEFAULT 0,
  error_message text,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notif_deliveries_notif_idx
  ON public.notification_deliveries(notification_id);
CREATE INDEX IF NOT EXISTS notif_deliveries_status_idx
  ON public.notification_deliveries(status);

GRANT SELECT ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin reads deliveries"
  ON public.notification_deliveries FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER notif_deliveries_updated
  BEFORE UPDATE ON public.notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. Core notify function (writes row + fires dispatcher)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_admin_notification(
  _kind text,
  _subject text,
  _summary text,
  _link text DEFAULT NULL,
  _entity_type text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _data jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid;
  v_endpoint text := 'https://project--2c2ca56b-598e-4651-bc14-8ba533771ae9.lovable.app/api/public/admin-notify';
  v_apikey text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxd3VkbW5mYXZ2YXVrdWxkdWxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5OTg2MjUsImV4cCI6MjA5NjU3NDYyNX0.P-8PAwboYoul28Iqx_UMGH0c9_NPwBTsJPCkRMXKEpY';
BEGIN
  INSERT INTO public.notifications (kind, subject, summary, link, entity_type, entity_id, data)
  VALUES (_kind, _subject, _summary, _link, _entity_type, _entity_id, COALESCE(_data,'{}'::jsonb))
  ON CONFLICT (kind, entity_type, entity_id) WHERE entity_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := v_endpoint,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'apikey', v_apikey
      ),
      body := jsonb_build_object(
        'notification_id', v_id,
        'kind', _kind,
        'subject', _subject,
        'summary', _summary,
        'link', _link
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'admin-notify dispatch failed: %', SQLERRM;
  END;

  RETURN v_id;
END $$;

-- Redirect the legacy helper to the new pipeline (keeps existing triggers working)
CREATE OR REPLACE FUNCTION public.notify_admin_event(
  _kind text, _subject text, _summary text, _link text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.create_admin_notification(_kind, _subject, _summary, _link, NULL, NULL, '{}'::jsonb);
END $$;

-- ============================================================
-- 5. Helper functions for the UI
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_unread_count()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN public.has_role(auth.uid(),'admin'::app_role)
              THEN (SELECT count(*)::int FROM public.notifications WHERE is_read = false)
              ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_read(_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.notifications SET is_read = true, read_at = now() WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.notifications SET is_read = true, read_at = now() WHERE is_read = false;
END $$;

-- ============================================================
-- 6. Triggers for the missing sources
-- ============================================================

-- contact messages
CREATE OR REPLACE FUNCTION public.trg_notify_contact_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_admin_notification(
    'contact_message',
    'Nouveau message de contact',
    coalesce(NEW.name,'?') || ' — ' || coalesce(NEW.subject, left(coalesce(NEW.message,''),80)),
    '/admin',
    'contact_message', NEW.id,
    jsonb_build_object('email', NEW.email)
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS contact_message_notify ON public.contact_messages;
CREATE TRIGGER contact_message_notify
  AFTER INSERT ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_contact_message();

-- articles pending validation
CREATE OR REPLACE FUNCTION public.trg_notify_article_pending()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'pending_validation' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.create_admin_notification(
      'article_pending',
      'Nouvel article en attente',
      COALESCE(NEW.title,'(sans titre)'),
      '/admin/articles',
      'article', NEW.id,
      '{}'::jsonb
    );
  END IF;
  RETURN NEW;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='articles') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS articles_notify_pending ON public.articles';
    EXECUTE 'CREATE TRIGGER articles_notify_pending AFTER INSERT OR UPDATE OF status ON public.articles FOR EACH ROW EXECUTE FUNCTION public.trg_notify_article_pending()';
  END IF;
END $$;

-- crm intake submissions
CREATE OR REPLACE FUNCTION public.trg_notify_intake_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_admin_notification(
    'intake_submission',
    'Nouveau formulaire intake reçu',
    'Nouveau lead capturé via un thérapeute',
    '/admin/crm',
    'intake', NEW.id,
    '{}'::jsonb
  );
  RETURN NEW;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='crm_intake_submissions') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS crm_intake_notify ON public.crm_intake_submissions';
    EXECUTE 'CREATE TRIGGER crm_intake_notify AFTER INSERT ON public.crm_intake_submissions FOR EACH ROW EXECUTE FUNCTION public.trg_notify_intake_submission()';
  END IF;
END $$;
