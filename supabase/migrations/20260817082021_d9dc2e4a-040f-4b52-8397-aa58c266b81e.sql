-- 1. Consentement newsletter sur les thérapeutes
ALTER TABLE public.therapists
  ADD COLUMN IF NOT EXISTS newsletter_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS newsletter_opt_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS newsletter_unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS newsletter_unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS therapists_newsletter_token_key
  ON public.therapists (newsletter_unsubscribe_token);

-- 2. Journal des envois
CREATE TABLE IF NOT EXISTS public.newsletter_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.newsletter_issues(id) ON DELETE CASCADE,
  is_test boolean NOT NULL DEFAULT false,
  segment text NOT NULL,
  version_label text,
  subject text,
  from_address text,
  resource_url text,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sending',
  error_message text,
  actor_id uuid,
  actor_email text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT newsletter_sends_status_check
    CHECK (status IN ('approved','sending','sent','partially_failed','failed','cancelled'))
);

CREATE INDEX IF NOT EXISTS newsletter_sends_issue_idx
  ON public.newsletter_sends (issue_id, started_at DESC);

-- Empêche deux envois réels simultanés pour la même newsletter
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_sends_one_in_progress
  ON public.newsletter_sends (issue_id)
  WHERE status = 'sending' AND is_test = false;

-- Empêche un second envoi réel réussi pour la même newsletter
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_sends_one_success
  ON public.newsletter_sends (issue_id)
  WHERE status IN ('sent','partially_failed') AND is_test = false;

CREATE TABLE IF NOT EXISTS public.newsletter_send_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id uuid NOT NULL REFERENCES public.newsletter_sends(id) ON DELETE CASCADE,
  therapist_id uuid,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  provider_message_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_send_recipients_unique
  ON public.newsletter_send_recipients (send_id, lower(email));

CREATE INDEX IF NOT EXISTS newsletter_send_recipients_send_idx
  ON public.newsletter_send_recipients (send_id);

GRANT SELECT ON public.newsletter_sends TO authenticated;
GRANT ALL ON public.newsletter_sends TO service_role;
GRANT SELECT ON public.newsletter_send_recipients TO authenticated;
GRANT ALL ON public.newsletter_send_recipients TO service_role;

ALTER TABLE public.newsletter_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_send_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read newsletter sends" ON public.newsletter_sends;
CREATE POLICY "Admins read newsletter sends"
  ON public.newsletter_sends FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins read newsletter send recipients" ON public.newsletter_send_recipients;
CREATE POLICY "Admins read newsletter send recipients"
  ON public.newsletter_send_recipients FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));