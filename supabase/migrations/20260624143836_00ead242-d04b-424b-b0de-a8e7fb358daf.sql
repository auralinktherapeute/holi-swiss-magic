
-- Add therapist branding columns for invoicing
ALTER TABLE public.therapists
  ADD COLUMN IF NOT EXISTS invoice_counter integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS payment_link text;

-- Invoices table
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.crm_client_contacts(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','cancelled')),
  issued_at date NOT NULL DEFAULT CURRENT_DATE,
  due_at date,
  client_name text NOT NULL,
  client_address text,
  notes text,
  payment_link text,
  currency text NOT NULL DEFAULT 'CHF',
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapists manage their own invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid()))
  WITH CHECK (therapist_id IN (SELECT id FROM public.therapists WHERE user_id = auth.uid()));

CREATE INDEX idx_invoices_therapist ON public.invoices(therapist_id);
CREATE INDEX idx_invoices_contact ON public.invoices(contact_id);

-- Invoice items
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapists manage their own invoice items"
  ON public.invoice_items FOR ALL TO authenticated
  USING (invoice_id IN (
    SELECT i.id FROM public.invoices i
    JOIN public.therapists t ON t.id = i.therapist_id
    WHERE t.user_id = auth.uid()
  ))
  WITH CHECK (invoice_id IN (
    SELECT i.id FROM public.invoices i
    JOIN public.therapists t ON t.id = i.therapist_id
    WHERE t.user_id = auth.uid()
  ));

CREATE INDEX idx_invoice_items_invoice ON public.invoice_items(invoice_id);

-- updated_at trigger
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
