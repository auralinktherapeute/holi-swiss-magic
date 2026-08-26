-- ─────────────────────────────────────────────────────────────
-- P0 — Socle facturation suisse (additif, aucune suppression)
-- ─────────────────────────────────────────────────────────────

-- 1. Réglages émetteur
ALTER TABLE public.therapist_invoice_settings
  ADD COLUMN IF NOT EXISTS raison_sociale text,
  ADD COLUMN IF NOT EXISTS numero_ide text,
  ADD COLUMN IF NOT EXISTS telephone text,
  ADD COLUMN IF NOT EXISTS email_pro text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS titulaire_nom text,
  ADD COLUMN IF NOT EXISTS titulaire_adresse text,
  ADD COLUMN IF NOT EXISTS titulaire_npa text,
  ADD COLUMN IF NOT EXISTS titulaire_ville text,
  ADD COLUMN IF NOT EXISTS titulaire_pays text NOT NULL DEFAULT 'CH',
  ADD COLUMN IF NOT EXISTS qr_iban text,
  ADD COLUMN IF NOT EXISTS devise_defaut text NOT NULL DEFAULT 'CHF',
  ADD COLUMN IF NOT EXISTS delai_paiement_jours integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS conditions_paiement text,
  ADD COLUMN IF NOT EXISTS mention_tva text,
  ADD COLUMN IF NOT EXISTS mode_tva text NOT NULL DEFAULT 'exclusive',
  ADD COLUMN IF NOT EXISTS pied_de_page text;

ALTER TABLE public.therapist_invoice_settings
  DROP CONSTRAINT IF EXISTS tis_mode_tva_chk;
ALTER TABLE public.therapist_invoice_settings
  ADD CONSTRAINT tis_mode_tva_chk CHECK (mode_tva IN ('exclusive','inclusive'));

ALTER TABLE public.therapist_invoice_settings
  DROP CONSTRAINT IF EXISTS tis_devise_chk;
ALTER TABLE public.therapist_invoice_settings
  ADD CONSTRAINT tis_devise_chk CHECK (devise_defaut IN ('CHF','EUR'));

-- 2. Factures : cycle de vie complet
ALTER TABLE public.therapist_invoices
  ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'brouillon',
  ADD COLUMN IF NOT EXISTS date_prestation date,
  ADD COLUMN IF NOT EXISTS date_echeance date,
  ADD COLUMN IF NOT EXISTS client_nom text,
  ADD COLUMN IF NOT EXISTS client_adresse text,
  ADD COLUMN IF NOT EXISTS client_npa text,
  ADD COLUMN IF NOT EXISTS client_ville text,
  ADD COLUMN IF NOT EXISTS client_pays text NOT NULL DEFAULT 'CH',
  ADD COLUMN IF NOT EXISTS client_email text,
  ADD COLUMN IF NOT EXISTS reference_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS communication text,
  ADD COLUMN IF NOT EXISTS montant_remise numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS montant_paye numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conditions_paiement text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS credit_note_of_id uuid REFERENCES public.therapist_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS corrects_invoice_id uuid REFERENCES public.therapist_invoices(id) ON DELETE SET NULL;

ALTER TABLE public.therapist_invoices DROP CONSTRAINT IF EXISTS ti_statut_chk;
ALTER TABLE public.therapist_invoices
  ADD CONSTRAINT ti_statut_chk CHECK (statut IN (
    'brouillon','validee','envoyee','consultee','partiellement_payee',
    'payee','en_retard','annulee','avoir','erreur_envoi'));

ALTER TABLE public.therapist_invoices DROP CONSTRAINT IF EXISTS ti_reference_type_chk;
ALTER TABLE public.therapist_invoices
  ADD CONSTRAINT ti_reference_type_chk CHECK (reference_type IN ('qrr','scor','none'));

CREATE UNIQUE INDEX IF NOT EXISTS therapist_invoices_numero_uniq
  ON public.therapist_invoices (therapist_id, numero_facture);

-- 3. Lignes de facture
CREATE TABLE IF NOT EXISTS public.therapist_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.therapist_invoices(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  description text NOT NULL,
  date_prestation date,
  quantite numeric NOT NULL DEFAULT 1 CHECK (quantite > 0),
  prix_unitaire numeric NOT NULL DEFAULT 0 CHECK (prix_unitaire >= 0),
  remise_pct numeric NOT NULL DEFAULT 0 CHECK (remise_pct >= 0 AND remise_pct <= 100),
  tva_taux numeric NOT NULL DEFAULT 0 CHECK (tva_taux >= 0 AND tva_taux <= 100),
  montant_ht numeric NOT NULL DEFAULT 0,
  tva_montant numeric NOT NULL DEFAULT 0,
  montant_ttc numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapist_invoice_lines TO authenticated;
GRANT ALL ON public.therapist_invoice_lines TO service_role;
ALTER TABLE public.therapist_invoice_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Therapist manage own invoice lines" ON public.therapist_invoice_lines;
CREATE POLICY "Therapist manage own invoice lines" ON public.therapist_invoice_lines
  FOR ALL TO authenticated
  USING (public.is_therapist_owner(therapist_id))
  WITH CHECK (public.is_therapist_owner(therapist_id));
CREATE INDEX IF NOT EXISTS til_invoice_idx ON public.therapist_invoice_lines(invoice_id, position);
DROP TRIGGER IF EXISTS til_touch ON public.therapist_invoice_lines;
CREATE TRIGGER til_touch BEFORE UPDATE ON public.therapist_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Paiements
CREATE TABLE IF NOT EXISTS public.therapist_invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.therapist_invoices(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  montant numeric NOT NULL CHECK (montant <> 0),
  date_paiement date NOT NULL DEFAULT CURRENT_DATE,
  mode_paiement text NOT NULL DEFAULT 'virement',
  reference_bancaire text,
  is_refund boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapist_invoice_payments TO authenticated;
GRANT ALL ON public.therapist_invoice_payments TO service_role;
ALTER TABLE public.therapist_invoice_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Therapist manage own invoice payments" ON public.therapist_invoice_payments;
CREATE POLICY "Therapist manage own invoice payments" ON public.therapist_invoice_payments
  FOR ALL TO authenticated
  USING (public.is_therapist_owner(therapist_id))
  WITH CHECK (public.is_therapist_owner(therapist_id));
CREATE INDEX IF NOT EXISTS tip_invoice_idx ON public.therapist_invoice_payments(invoice_id);
DROP TRIGGER IF EXISTS tip_touch ON public.therapist_invoice_payments;
CREATE TRIGGER tip_touch BEFORE UPDATE ON public.therapist_invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Journal d'audit financier
CREATE TABLE IF NOT EXISTS public.therapist_invoice_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.therapist_invoices(id) ON DELETE SET NULL,
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_user_id uuid,
  before_data jsonb,
  after_data jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.therapist_invoice_audit TO authenticated;
GRANT ALL ON public.therapist_invoice_audit TO service_role;
ALTER TABLE public.therapist_invoice_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Therapist read own invoice audit" ON public.therapist_invoice_audit;
CREATE POLICY "Therapist read own invoice audit" ON public.therapist_invoice_audit
  FOR SELECT TO authenticated
  USING (public.is_therapist_owner(therapist_id) OR public.has_role(auth.uid(),'admin'::app_role));
DROP POLICY IF EXISTS "Therapist insert own invoice audit" ON public.therapist_invoice_audit;
CREATE POLICY "Therapist insert own invoice audit" ON public.therapist_invoice_audit
  FOR INSERT TO authenticated
  WITH CHECK (public.is_therapist_owner(therapist_id));
CREATE INDEX IF NOT EXISTS tia_invoice_idx ON public.therapist_invoice_audit(invoice_id, created_at DESC);

-- 6. Taux de TVA de référence (configurables)
CREATE TABLE IF NOT EXISTS public.vat_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  rate numeric NOT NULL CHECK (rate >= 0 AND rate <= 100),
  country text NOT NULL DEFAULT 'CH',
  is_active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vat_rates TO authenticated;
GRANT ALL ON public.vat_rates TO service_role;
ALTER TABLE public.vat_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read vat rates" ON public.vat_rates;
CREATE POLICY "Authenticated read vat rates" ON public.vat_rates
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin manage vat rates" ON public.vat_rates;
CREATE POLICY "Admin manage vat rates" ON public.vat_rates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
DROP TRIGGER IF EXISTS vat_touch ON public.vat_rates;
CREATE TRIGGER vat_touch BEFORE UPDATE ON public.vat_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.vat_rates (code, label, rate, note) VALUES
  ('none', 'Non soumis / exonéré', 0, 'Vérifiez votre statut avec votre fiduciaire ou l''AFC.'),
  ('reduced', 'Taux réduit 2,6 %', 2.6, 'Biens de première nécessité, presse, médicaments.'),
  ('special', 'Taux spécial hébergement 3,8 %', 3.8, 'Prestations d''hébergement uniquement.'),
  ('standard', 'Taux normal 8,1 %', 8.1, 'Taux ordinaire suisse.')
ON CONFLICT (code) DO NOTHING;

-- 7. Verrouillage des factures validées
CREATE OR REPLACE FUNCTION public.therapist_invoices_lock_финансы()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL THEN
    IF NEW.numero_facture IS DISTINCT FROM OLD.numero_facture
       OR NEW.montant_ht IS DISTINCT FROM OLD.montant_ht
       OR NEW.tva_taux IS DISTINCT FROM OLD.tva_taux
       OR NEW.tva_montant IS DISTINCT FROM OLD.tva_montant
       OR NEW.montant_total IS DISTINCT FROM OLD.montant_total
       OR NEW.montant_remise IS DISTINCT FROM OLD.montant_remise
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.date_emission IS DISTINCT FROM OLD.date_emission
       OR NEW.client_nom IS DISTINCT FROM OLD.client_nom
       OR NEW.client_adresse IS DISTINCT FROM OLD.client_adresse
       OR NEW.client_npa IS DISTINCT FROM OLD.client_npa
       OR NEW.client_ville IS DISTINCT FROM OLD.client_ville
       OR NEW.qr_reference IS DISTINCT FROM OLD.qr_reference
       OR NEW.reference_type IS DISTINCT FROM OLD.reference_type
       OR NEW.therapist_id IS DISTINCT FROM OLD.therapist_id THEN
      RAISE EXCEPTION 'invoice_locked: une facture validée ne peut pas être modifiée. Créez une facture rectificative ou un avoir.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS therapist_invoices_lock ON public.therapist_invoices;
CREATE TRIGGER therapist_invoices_lock BEFORE UPDATE ON public.therapist_invoices
  FOR EACH ROW EXECUTE FUNCTION public.therapist_invoices_lock_финансы();

-- Lignes immuables une fois la facture verrouillée
CREATE OR REPLACE FUNCTION public.therapist_invoice_lines_locked()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_locked timestamptz;
BEGIN
  SELECT locked_at INTO v_locked FROM public.therapist_invoices
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF v_locked IS NOT NULL THEN
    RAISE EXCEPTION 'invoice_locked: les lignes d''une facture validée sont immuables.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS til_locked ON public.therapist_invoice_lines;
CREATE TRIGGER til_locked BEFORE INSERT OR UPDATE OR DELETE ON public.therapist_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.therapist_invoice_lines_locked();

REVOKE EXECUTE ON FUNCTION public.therapist_invoices_lock_финансы() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.therapist_invoice_lines_locked() FROM public, anon, authenticated;