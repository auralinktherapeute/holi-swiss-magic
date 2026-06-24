
-- Payment methods table (private, owner-only)
CREATE TABLE public.therapist_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method_type text NOT NULL CHECK (method_type IN ('twint','revolut','paypal','postfinance','iban','other')),
  label text,
  value text NOT NULL,
  bank_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapist_payment_methods TO authenticated;
GRANT ALL ON public.therapist_payment_methods TO service_role;

ALTER TABLE public.therapist_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner only - read"
  ON public.therapist_payment_methods FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owner only - insert"
  ON public.therapist_payment_methods FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner only - update"
  ON public.therapist_payment_methods FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner only - delete"
  ON public.therapist_payment_methods FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_tpm_user ON public.therapist_payment_methods(user_id);

CREATE TRIGGER update_tpm_updated_at
  BEFORE UPDATE ON public.therapist_payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Invoices: store which payment methods are enabled on each invoice
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_method_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];
