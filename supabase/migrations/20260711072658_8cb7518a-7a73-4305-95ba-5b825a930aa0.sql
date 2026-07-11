
-- =========================================================================
-- Helper: therapist ownership check via therapists.user_id = auth.uid()
-- =========================================================================
CREATE OR REPLACE FUNCTION public.is_therapist_owner(_therapist_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.therapists
    WHERE id = _therapist_id AND user_id = auth.uid()
  );
$$;

-- =========================================================================
-- 1. FORFAITS
-- =========================================================================

-- service_packages -------------------------------------------------------
CREATE TABLE public.service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  nom text NOT NULL,
  description text,
  prix_total numeric(10,2) NOT NULL CHECK (prix_total >= 0),
  nombre_seances_incluses integer NOT NULL CHECK (nombre_seances_incluses > 0),
  validite_jours integer CHECK (validite_jours IS NULL OR validite_jours > 0),
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_service_packages_therapist ON public.service_packages(therapist_id) WHERE actif;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_packages TO authenticated;
GRANT SELECT ON public.service_packages TO anon;
GRANT ALL ON public.service_packages TO service_role;

ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active packages"
  ON public.service_packages FOR SELECT TO anon, authenticated
  USING (actif = true);

CREATE POLICY "Therapist manage own packages"
  ON public.service_packages FOR ALL TO authenticated
  USING (public.is_therapist_owner(therapist_id))
  WITH CHECK (public.is_therapist_owner(therapist_id));

CREATE POLICY "Admin manage all packages"
  ON public.service_packages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_service_packages_updated
  BEFORE UPDATE ON public.service_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- client_packages --------------------------------------------------------
CREATE TABLE public.client_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.crm_client_contacts(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.service_packages(id) ON DELETE RESTRICT,
  nombre_seances_utilisees integer NOT NULL DEFAULT 0 CHECK (nombre_seances_utilisees >= 0),
  date_achat date NOT NULL DEFAULT CURRENT_DATE,
  date_expiration date,
  statut_paiement text NOT NULL DEFAULT 'a_regler'
    CHECK (statut_paiement IN ('paye','acompte','a_regler')),
  statut text NOT NULL DEFAULT 'actif'
    CHECK (statut IN ('actif','expire','epuise')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_client_packages_therapist ON public.client_packages(therapist_id);
CREATE INDEX idx_client_packages_client ON public.client_packages(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_packages TO authenticated;
GRANT ALL ON public.client_packages TO service_role;

ALTER TABLE public.client_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapist manage own client packages"
  ON public.client_packages FOR ALL TO authenticated
  USING (public.is_therapist_owner(therapist_id))
  WITH CHECK (public.is_therapist_owner(therapist_id));

CREATE POLICY "Admin manage all client packages"
  ON public.client_packages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_client_packages_updated
  BEFORE UPDATE ON public.client_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger : recalcule le statut (actif/expire/epuise) et fixe date_expiration à l'insert
CREATE OR REPLACE FUNCTION public.trg_client_package_recompute_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total int; v_validite int;
BEGIN
  SELECT nombre_seances_incluses, validite_jours INTO v_total, v_validite
  FROM public.service_packages WHERE id = NEW.package_id;

  IF TG_OP = 'INSERT' AND NEW.date_expiration IS NULL AND v_validite IS NOT NULL THEN
    NEW.date_expiration := NEW.date_achat + (v_validite || ' days')::interval;
  END IF;

  IF NEW.nombre_seances_utilisees >= v_total THEN
    NEW.statut := 'epuise';
  ELSIF NEW.date_expiration IS NOT NULL AND NEW.date_expiration < CURRENT_DATE THEN
    NEW.statut := 'expire';
  ELSE
    NEW.statut := 'actif';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_client_packages_status
  BEFORE INSERT OR UPDATE ON public.client_packages
  FOR EACH ROW EXECUTE FUNCTION public.trg_client_package_recompute_status();

-- client_package_sessions ------------------------------------------------
CREATE TABLE public.client_package_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_package_id uuid NOT NULL REFERENCES public.client_packages(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  date_decompte timestamptz NOT NULL DEFAULT now(),
  type_seance_reelle text,
  commentaire text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cps_package ON public.client_package_sessions(client_package_id);
CREATE INDEX idx_cps_therapist ON public.client_package_sessions(therapist_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_package_sessions TO authenticated;
GRANT ALL ON public.client_package_sessions TO service_role;

ALTER TABLE public.client_package_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapist manage own package sessions"
  ON public.client_package_sessions FOR ALL TO authenticated
  USING (public.is_therapist_owner(therapist_id))
  WITH CHECK (public.is_therapist_owner(therapist_id));

CREATE POLICY "Admin manage all package sessions"
  ON public.client_package_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger : incrémente le compteur du client_package
CREATE OR REPLACE FUNCTION public.trg_client_package_increment_usage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.client_packages
      SET nombre_seances_utilisees = nombre_seances_utilisees + 1,
          updated_at = now()
      WHERE id = NEW.client_package_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.client_packages
      SET nombre_seances_utilisees = GREATEST(nombre_seances_utilisees - 1, 0),
          updated_at = now()
      WHERE id = OLD.client_package_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_cps_increment
  AFTER INSERT OR DELETE ON public.client_package_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trg_client_package_increment_usage();

-- =========================================================================
-- 2. QUESTIONNAIRES
-- =========================================================================

CREATE TABLE public.questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  titre text NOT NULL,
  description text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_questionnaires_therapist ON public.questionnaires(therapist_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.questionnaires TO authenticated;
GRANT SELECT ON public.questionnaires TO anon;
GRANT ALL ON public.questionnaires TO service_role;

ALTER TABLE public.questionnaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active questionnaires"
  ON public.questionnaires FOR SELECT TO anon, authenticated
  USING (actif = true);

CREATE POLICY "Therapist manage own questionnaires"
  ON public.questionnaires FOR ALL TO authenticated
  USING (public.is_therapist_owner(therapist_id))
  WITH CHECK (public.is_therapist_owner(therapist_id));

CREATE POLICY "Admin manage all questionnaires"
  ON public.questionnaires FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_questionnaires_updated
  BEFORE UPDATE ON public.questionnaires
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- questionnaire_questions ------------------------------------------------
CREATE TABLE public.questionnaire_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id uuid NOT NULL REFERENCES public.questionnaires(id) ON DELETE CASCADE,
  ordre integer NOT NULL DEFAULT 0,
  type_reponse text NOT NULL
    CHECK (type_reponse IN ('texte_libre','choix_unique','choix_multiple','echelle','oui_non')),
  question text NOT NULL,
  options jsonb,
  obligatoire boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_qq_questionnaire ON public.questionnaire_questions(questionnaire_id, ordre);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.questionnaire_questions TO authenticated;
GRANT SELECT ON public.questionnaire_questions TO anon;
GRANT ALL ON public.questionnaire_questions TO service_role;

ALTER TABLE public.questionnaire_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read questions of active questionnaires"
  ON public.questionnaire_questions FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.questionnaires q
    WHERE q.id = questionnaire_id AND q.actif = true
  ));

CREATE POLICY "Therapist manage own questions"
  ON public.questionnaire_questions FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.questionnaires q
    WHERE q.id = questionnaire_id AND public.is_therapist_owner(q.therapist_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.questionnaires q
    WHERE q.id = questionnaire_id AND public.is_therapist_owner(q.therapist_id)
  ));

-- questionnaire_assignments ----------------------------------------------
CREATE TABLE public.questionnaire_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id uuid NOT NULL REFERENCES public.questionnaires(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  service_type_id uuid,
  package_id uuid REFERENCES public.service_packages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (service_type_id IS NOT NULL OR package_id IS NOT NULL)
);
CREATE INDEX idx_qa_service ON public.questionnaire_assignments(service_type_id);
CREATE INDEX idx_qa_package ON public.questionnaire_assignments(package_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.questionnaire_assignments TO authenticated;
GRANT SELECT ON public.questionnaire_assignments TO anon;
GRANT ALL ON public.questionnaire_assignments TO service_role;

ALTER TABLE public.questionnaire_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read questionnaire assignments"
  ON public.questionnaire_assignments FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Therapist manage own assignments"
  ON public.questionnaire_assignments FOR ALL TO authenticated
  USING (public.is_therapist_owner(therapist_id))
  WITH CHECK (public.is_therapist_owner(therapist_id));

-- client_questionnaire_responses -----------------------------------------
CREATE TABLE public.client_questionnaire_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.crm_client_contacts(id) ON DELETE SET NULL,
  questionnaire_id uuid NOT NULL REFERENCES public.questionnaires(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  reponses jsonb NOT NULL DEFAULT '{}'::jsonb,
  statut text NOT NULL DEFAULT 'repondu'
    CHECK (statut IN ('repondu','ignore')),
  patient_email text,
  patient_name text,
  date_soumission timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cqr_therapist ON public.client_questionnaire_responses(therapist_id);
CREATE INDEX idx_cqr_client ON public.client_questionnaire_responses(client_id);
CREATE INDEX idx_cqr_appointment ON public.client_questionnaire_responses(appointment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_questionnaire_responses TO authenticated;
GRANT INSERT ON public.client_questionnaire_responses TO anon;
GRANT ALL ON public.client_questionnaire_responses TO service_role;

ALTER TABLE public.client_questionnaire_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a response"
  ON public.client_questionnaire_responses FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.questionnaires q
            WHERE q.id = questionnaire_id AND q.actif = true
              AND q.therapist_id = client_questionnaire_responses.therapist_id)
  );

CREATE POLICY "Therapist read own responses"
  ON public.client_questionnaire_responses FOR SELECT TO authenticated
  USING (public.is_therapist_owner(therapist_id));

CREATE POLICY "Therapist update own responses"
  ON public.client_questionnaire_responses FOR UPDATE TO authenticated
  USING (public.is_therapist_owner(therapist_id))
  WITH CHECK (public.is_therapist_owner(therapist_id));

CREATE POLICY "Therapist delete own responses"
  ON public.client_questionnaire_responses FOR DELETE TO authenticated
  USING (public.is_therapist_owner(therapist_id));

CREATE POLICY "Admin manage all responses"
  ON public.client_questionnaire_responses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================================
-- 3. FACTURATION SUISSE
-- =========================================================================

CREATE TABLE public.therapist_invoice_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL UNIQUE REFERENCES public.therapists(id) ON DELETE CASCADE,
  iban_ou_qr_iban text NOT NULL,
  adresse_rue text NOT NULL,
  adresse_npa text NOT NULL,
  adresse_ville text NOT NULL,
  adresse_pays text NOT NULL DEFAULT 'CH',
  numero_tva text,
  assujetti_tva boolean NOT NULL DEFAULT false,
  taux_tva numeric(5,2),
  next_invoice_number integer NOT NULL DEFAULT 1,
  remise_a_zero_annuelle boolean NOT NULL DEFAULT false,
  invoice_number_year integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapist_invoice_settings TO authenticated;
GRANT ALL ON public.therapist_invoice_settings TO service_role;

ALTER TABLE public.therapist_invoice_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapist manage own invoice settings"
  ON public.therapist_invoice_settings FOR ALL TO authenticated
  USING (public.is_therapist_owner(therapist_id))
  WITH CHECK (public.is_therapist_owner(therapist_id));

CREATE POLICY "Admin read all invoice settings"
  ON public.therapist_invoice_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_tis_updated
  BEFORE UPDATE ON public.therapist_invoice_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- therapist_invoices (dédiée facturation auto suisse — distincte de invoices existante)
CREATE TABLE public.therapist_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.crm_client_contacts(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  client_package_id uuid REFERENCES public.client_packages(id) ON DELETE SET NULL,
  numero_facture text NOT NULL,
  annee_facturation integer NOT NULL,
  montant_ht numeric(10,2) NOT NULL,
  tva_taux numeric(5,2),
  tva_montant numeric(10,2),
  montant_total numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'CHF',
  statut_paiement text NOT NULL DEFAULT 'en_attente'
    CHECK (statut_paiement IN ('en_attente','payee','en_retard','annulee')),
  qr_reference text,
  pdf_url text,
  date_emission timestamptz NOT NULL DEFAULT now(),
  date_paiement timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (therapist_id, numero_facture)
);
CREATE INDEX idx_ti_therapist ON public.therapist_invoices(therapist_id);
CREATE INDEX idx_ti_client ON public.therapist_invoices(client_id);
CREATE INDEX idx_ti_status ON public.therapist_invoices(statut_paiement);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapist_invoices TO authenticated;
GRANT ALL ON public.therapist_invoices TO service_role;

ALTER TABLE public.therapist_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapist manage own invoices"
  ON public.therapist_invoices FOR ALL TO authenticated
  USING (public.is_therapist_owner(therapist_id))
  WITH CHECK (public.is_therapist_owner(therapist_id));

CREATE POLICY "Admin read all invoices"
  ON public.therapist_invoices FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_ti_updated
  BEFORE UPDATE ON public.therapist_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- Fonction : réserve atomiquement le prochain numéro de facture
-- =========================================================================
CREATE OR REPLACE FUNCTION public.reserve_next_invoice_number(_therapist_id uuid)
RETURNS TABLE(numero_facture text, annee integer, seq integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_settings public.therapist_invoice_settings%ROWTYPE;
  v_year int := EXTRACT(YEAR FROM now())::int;
  v_seq int;
  v_prefix text;
  v_t public.therapists%ROWTYPE;
BEGIN
  IF NOT (public.is_therapist_owner(_therapist_id) OR public.has_role(auth.uid(),'admin'::app_role) OR auth.uid() IS NULL) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_settings FROM public.therapist_invoice_settings
    WHERE therapist_id = _therapist_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invoice_settings_missing';
  END IF;

  IF v_settings.remise_a_zero_annuelle AND v_settings.invoice_number_year IS DISTINCT FROM v_year THEN
    v_settings.next_invoice_number := 1;
  END IF;

  v_seq := v_settings.next_invoice_number;

  UPDATE public.therapist_invoice_settings
    SET next_invoice_number = v_seq + 1,
        invoice_number_year = v_year,
        updated_at = now()
    WHERE therapist_id = _therapist_id;

  SELECT * INTO v_t FROM public.therapists WHERE id = _therapist_id;
  v_prefix := 'HS-' || upper(coalesce(left(v_t.first_name,1),'') || coalesce(left(v_t.last_name,1),''));

  numero_facture := v_prefix || '-' || v_year::text || '-' || lpad(v_seq::text, 4, '0');
  annee := v_year;
  seq := v_seq;
  RETURN NEXT;
END $$;

REVOKE ALL ON FUNCTION public.reserve_next_invoice_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_next_invoice_number(uuid) TO authenticated, service_role;
