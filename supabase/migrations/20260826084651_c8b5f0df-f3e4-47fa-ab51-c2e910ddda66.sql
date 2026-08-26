CREATE OR REPLACE FUNCTION public.therapist_invoices_lock_financials()
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

REVOKE EXECUTE ON FUNCTION public.therapist_invoices_lock_financials() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS therapist_invoices_lock ON public.therapist_invoices;
CREATE TRIGGER therapist_invoices_lock BEFORE UPDATE ON public.therapist_invoices
  FOR EACH ROW EXECUTE FUNCTION public.therapist_invoices_lock_financials();

DROP FUNCTION IF EXISTS public.therapist_invoices_lock_финансы();