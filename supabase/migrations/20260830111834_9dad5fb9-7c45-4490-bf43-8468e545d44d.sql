-- Catalogues Tarif 590 (versionnés, alimentés par import admin uniquement)
CREATE TABLE IF NOT EXISTS public.tariff_catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version text NOT NULL,
  source text,
  valid_from date,
  valid_to date,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);

CREATE TABLE IF NOT EXISTS public.tariff_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL REFERENCES public.tariff_catalogs(id) ON DELETE CASCADE,
  code text NOT NULL,
  designation text NOT NULL,
  description text,
  unit text,
  valid_from date,
  valid_to date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (catalog_id, code)
);

CREATE INDEX IF NOT EXISTS tariff_positions_catalog_idx ON public.tariff_positions (catalog_id, code);

GRANT SELECT ON public.tariff_catalogs TO authenticated;
GRANT SELECT ON public.tariff_positions TO authenticated;
GRANT ALL ON public.tariff_catalogs TO service_role;
GRANT ALL ON public.tariff_positions TO service_role;

ALTER TABLE public.tariff_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tariff_catalogs_read" ON public.tariff_catalogs;
CREATE POLICY "tariff_catalogs_read" ON public.tariff_catalogs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tariff_catalogs_admin_write" ON public.tariff_catalogs;
CREATE POLICY "tariff_catalogs_admin_write" ON public.tariff_catalogs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "tariff_positions_read" ON public.tariff_positions;
CREATE POLICY "tariff_positions_read" ON public.tariff_positions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tariff_positions_admin_write" ON public.tariff_positions;
CREATE POLICY "tariff_positions_admin_write" ON public.tariff_positions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Catalogue de prestations facturables du thérapeute
CREATE TABLE IF NOT EXISTS public.billing_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text,
  duration_min integer NOT NULL DEFAULT 60,
  price numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CHF',
  vat_rate numeric(5,2) NOT NULL DEFAULT 0,
  internal_code text,
  tariff_position_id uuid REFERENCES public.tariff_positions(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_services_therapist_idx
  ON public.billing_services (therapist_id, is_active, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_services TO authenticated;
GRANT ALL ON public.billing_services TO service_role;

ALTER TABLE public.billing_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_services_owner" ON public.billing_services;
CREATE POLICY "billing_services_owner" ON public.billing_services
  FOR ALL TO authenticated
  USING (public.is_therapist_owner(therapist_id))
  WITH CHECK (public.is_therapist_owner(therapist_id));

DROP TRIGGER IF EXISTS billing_services_touch ON public.billing_services;
CREATE TRIGGER billing_services_touch BEFORE UPDATE ON public.billing_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS tariff_catalogs_touch ON public.tariff_catalogs;
CREATE TRIGGER tariff_catalogs_touch BEFORE UPDATE ON public.tariff_catalogs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS tariff_positions_touch ON public.tariff_positions;
CREATE TRIGGER tariff_positions_touch BEFORE UPDATE ON public.tariff_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();