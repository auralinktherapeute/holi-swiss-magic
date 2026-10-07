ALTER TABLE public.crm_client_contacts
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_into_id uuid,
  ADD COLUMN IF NOT EXISTS consent_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_request_token text;
CREATE UNIQUE INDEX IF NOT EXISTS crm_client_contacts_consent_token_uidx
  ON public.crm_client_contacts(consent_request_token) WHERE consent_request_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.crm_client_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_client_audit_contact_idx ON public.crm_client_audit(contact_id, created_at DESC);
GRANT SELECT, INSERT ON public.crm_client_audit TO authenticated;
GRANT ALL ON public.crm_client_audit TO service_role;
ALTER TABLE public.crm_client_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit owner read" ON public.crm_client_audit;
CREATE POLICY "audit owner read" ON public.crm_client_audit FOR SELECT TO authenticated
  USING (public.is_therapist_owner(therapist_id));
DROP POLICY IF EXISTS "audit owner insert" ON public.crm_client_audit;
CREATE POLICY "audit owner insert" ON public.crm_client_audit FOR INSERT TO authenticated
  WITH CHECK (public.is_therapist_owner(therapist_id) AND actor_id = auth.uid());