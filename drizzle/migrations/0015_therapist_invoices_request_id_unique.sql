-- Anti double soumission : une même demande (metadata.request_id) ne produit qu'une facture par thérapeute.
-- Réversible : DROP INDEX IF EXISTS public.ti_therapist_request_id_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS ti_therapist_request_id_uniq
  ON public.therapist_invoices (therapist_id, ((metadata->>'request_id')))
  WHERE (metadata->>'request_id') IS NOT NULL;