CREATE TABLE IF NOT EXISTS public.invoice_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.therapist_invoices(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_access_tokens_invoice_idx ON public.invoice_access_tokens(invoice_id);

GRANT SELECT, INSERT, UPDATE ON public.invoice_access_tokens TO authenticated;
GRANT ALL ON public.invoice_access_tokens TO service_role;

ALTER TABLE public.invoice_access_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Therapist manages own invoice links" ON public.invoice_access_tokens;
CREATE POLICY "Therapist manages own invoice links"
ON public.invoice_access_tokens FOR ALL TO authenticated
USING (public.is_therapist_owner(therapist_id))
WITH CHECK (public.is_therapist_owner(therapist_id));

DROP TRIGGER IF EXISTS update_invoice_access_tokens_updated_at ON public.invoice_access_tokens;
CREATE TRIGGER update_invoice_access_tokens_updated_at
BEFORE UPDATE ON public.invoice_access_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();