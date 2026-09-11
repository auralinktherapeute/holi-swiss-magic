-- Organismes certificateurs externes
CREATE TABLE public.certification_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  logo_url text,
  badge_color text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.certification_organizations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.certification_organizations TO authenticated;
GRANT ALL ON public.certification_organizations TO service_role;

ALTER TABLE public.certification_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cert_orgs_public_read"
  ON public.certification_organizations FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "cert_orgs_admin_write"
  ON public.certification_organizations FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Statut d'une certification par organisme
CREATE TYPE public.org_certification_status AS ENUM ('pending','active','suspended','expired','revoked');

CREATE TABLE public.therapist_org_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.certification_organizations(id) ON DELETE CASCADE,
  status public.org_certification_status NOT NULL DEFAULT 'pending',
  certified_since date,
  external_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX therapist_org_certifications_unique
  ON public.therapist_org_certifications (therapist_id, organization_id);
CREATE INDEX therapist_org_certifications_active_idx
  ON public.therapist_org_certifications (therapist_id) WHERE status = 'active';

-- Lecture publique restreinte aux colonnes non sensibles (jamais external_reference)
GRANT SELECT (id, therapist_id, organization_id, status, certified_since)
  ON public.therapist_org_certifications TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.therapist_org_certifications TO authenticated;
GRANT ALL ON public.therapist_org_certifications TO service_role;

ALTER TABLE public.therapist_org_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "therapist_org_certs_public_read_active"
  ON public.therapist_org_certifications FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

CREATE POLICY "therapist_org_certs_admin_read"
  ON public.therapist_org_certifications FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "therapist_org_certs_admin_write"
  ON public.therapist_org_certifications FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_cert_orgs_updated_at
  BEFORE UPDATE ON public.certification_organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_therapist_org_certs_updated_at
  BEFORE UPDATE ON public.therapist_org_certifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();