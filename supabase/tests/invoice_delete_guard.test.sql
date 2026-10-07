-- Test autonome (base locale jetable) : garde-fou de suppression + RLS entre deux thérapeutes.
-- Stub minimal du schéma de production ; la fonction et le trigger sont recopiés de
-- drizzle/migrations/0014_therapist_invoices_delete_guard.sql.
\set ON_ERROR_STOP on
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE public.therapists(id uuid PRIMARY KEY, user_id uuid);
CREATE TABLE public.therapist_invoices(
  id uuid PRIMARY KEY, therapist_id uuid, numero_facture text, statut text,
  locked_at timestamptz, sent_at timestamptz, billing_snapshot_at timestamptz, montant_paye numeric DEFAULT 0);
CREATE TABLE public.therapist_invoice_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid, montant numeric);
CREATE OR REPLACE FUNCTION public.is_therapist_owner(_t uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
$$ SELECT EXISTS(SELECT 1 FROM public.therapists WHERE id=_t AND user_id=auth.uid()) $$;
ALTER TABLE public.therapist_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Therapist manage own invoices" ON public.therapist_invoices FOR ALL TO authenticated
  USING (public.is_therapist_owner(therapist_id)) WITH CHECK (public.is_therapist_owner(therapist_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapist_invoices TO authenticated;
GRANT SELECT ON public.therapist_invoice_payments TO authenticated;

\i drizzle/migrations/0014_therapist_invoices_delete_guard.sql

INSERT INTO therapists VALUES ('00000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a'),
                              ('00000000-0000-0000-0000-00000000000b','10000000-0000-0000-0000-00000000000b');
INSERT INTO therapist_invoices(id,therapist_id,numero_facture,statut,locked_at,sent_at,montant_paye) VALUES
 ('a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','BROUILLON-1','brouillon',NULL,NULL,0),
 ('a0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000a','HS-2026-0001','validee',now(),NULL,0),
 ('a0000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000000a','BROUILLON-3','brouillon',NULL,NULL,0),
 ('a0000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000000a','BROUILLON-4','brouillon',NULL,now(),0),
 ('a0000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000000a','HS-2026-0002','brouillon',NULL,NULL,0),
 ('b0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','BROUILLON-B','brouillon',NULL,NULL,0);
INSERT INTO therapist_invoice_payments(invoice_id,montant) VALUES ('a0000000-0000-0000-0000-000000000003',10);

CREATE TEMP TABLE r(name text, ok boolean, info text); GRANT ALL ON r TO authenticated;
SET role authenticated;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-00000000000a"}',false) \g /dev/null
CREATE OR REPLACE FUNCTION pg_temp.try_del(_n text, _id uuid, _expect_ok boolean) RETURNS void LANGUAGE plpgsql AS $$
DECLARE c int; BEGIN
  DELETE FROM therapist_invoices WHERE id=_id; GET DIAGNOSTICS c = ROW_COUNT;
  INSERT INTO r VALUES(_n, (c=1)=_expect_ok, 'rows='||c);
EXCEPTION WHEN others THEN INSERT INTO r VALUES(_n, NOT _expect_ok, SQLERRM); END $$;
SELECT pg_temp.try_del('1 émise (locked) refusée','a0000000-0000-0000-0000-000000000002',false);
SELECT pg_temp.try_del('2 brouillon avec paiement refusé','a0000000-0000-0000-0000-000000000003',false);
SELECT pg_temp.try_del('3 brouillon déjà envoyé refusé','a0000000-0000-0000-0000-000000000004',false);
SELECT pg_temp.try_del('4 numéro définitif refusé','a0000000-0000-0000-0000-000000000005',false);
SELECT pg_temp.try_del('5 brouillon d''un autre thérapeute invisible (0 ligne)','b0000000-0000-0000-0000-000000000001',false);
INSERT INTO r SELECT '6 RLS : A ne voit pas les factures de B', count(*)=0, '' FROM therapist_invoices WHERE therapist_id='00000000-0000-0000-0000-00000000000b';
SELECT pg_temp.try_del('7 brouillon propre sans paiement supprimé','a0000000-0000-0000-0000-000000000001',true);
RESET role;
INSERT INTO r SELECT '8 aucune autre facture supprimée', count(*)=5, '' FROM therapist_invoices;
SELECT name, ok, left(info,90) FROM r ORDER BY name;
SELECT CASE WHEN bool_and(ok) THEN 'ALL PASS' ELSE 'FAILURE' END FROM r;
