ALTER TABLE public.crm_client_contacts
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS canton text,
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'CH';

ALTER TABLE public.therapist_invoices
  ADD COLUMN IF NOT EXISTS client_adresse2 text,
  ADD COLUMN IF NOT EXISTS client_canton text,
  ADD COLUMN IF NOT EXISTS billing_snapshot_at timestamptz;

COMMENT ON COLUMN public.therapist_invoices.billing_snapshot_at IS
  'Date de figement des coordonnees de facturation (renseignee a la validation/emission).';