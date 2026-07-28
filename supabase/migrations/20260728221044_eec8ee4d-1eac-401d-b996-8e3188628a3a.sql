CREATE TABLE IF NOT EXISTS public.subscription_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  invoice_number TEXT NOT NULL,
  hosted_invoice_url TEXT,
  invoice_pdf_url TEXT,
  amount_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_subtotal NUMERIC(12,2),
  amount_tax NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'CHF',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','paid','uncollectible','void','refunded','failed','pending')),
  billing_reason TEXT,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_start DATE,
  period_end DATE,
  plan_name TEXT,
  customer_name TEXT,
  customer_email TEXT,
  company_name TEXT,
  billing_address TEXT,
  payment_method TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_invoices_therapist_idx
  ON public.subscription_invoices(therapist_id, invoice_date DESC);

GRANT SELECT ON public.subscription_invoices TO authenticated;
GRANT ALL ON public.subscription_invoices TO service_role;

ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "therapist reads own subscription invoices" ON public.subscription_invoices;
CREATE POLICY "therapist reads own subscription invoices"
  ON public.subscription_invoices FOR SELECT
  TO authenticated
  USING (
    public.is_therapist_owner(therapist_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE OR REPLACE FUNCTION public.tg_subscription_invoices_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS subscription_invoices_touch ON public.subscription_invoices;
CREATE TRIGGER subscription_invoices_touch
  BEFORE UPDATE ON public.subscription_invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_subscription_invoices_touch();