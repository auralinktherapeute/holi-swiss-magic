-- Refuse en base la suppression de toute facture qui n'est pas un brouillon jamais émis et sans paiement.
CREATE OR REPLACE FUNCTION public.therapist_invoices_delete_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.statut IS DISTINCT FROM 'brouillon'
     OR OLD.locked_at IS NOT NULL
     OR OLD.sent_at IS NOT NULL
     OR OLD.billing_snapshot_at IS NOT NULL
     OR COALESCE(OLD.numero_facture, '') NOT LIKE 'BROUILLON-%'
     OR COALESCE(OLD.montant_paye, 0) <> 0
     OR EXISTS (SELECT 1 FROM public.therapist_invoice_payments p WHERE p.invoice_id = OLD.id)
  THEN
    RAISE EXCEPTION 'invoice_delete_forbidden: seule une facture brouillon jamais émise et sans paiement peut être supprimée. Utilisez l''annulation ou un avoir.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.therapist_invoices_delete_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ti_delete_guard ON public.therapist_invoices;
CREATE TRIGGER ti_delete_guard
  BEFORE DELETE ON public.therapist_invoices
  FOR EACH ROW EXECUTE FUNCTION public.therapist_invoices_delete_guard();