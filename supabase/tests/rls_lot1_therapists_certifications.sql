-- ============================================================
-- LOT 1 SÉCURITÉ — validation RLS reproductible
-- public.therapists (UPDATE) et public.therapist_certifications
--
-- Exécution (psql, connexion service-role/superuser) :
--   psql "$DATABASE_URL" -f supabase/tests/rls_lot1_therapists_certifications.sql
--
-- Le script crée 3 utilisateurs de test (thérapeute A, thérapeute B, admin),
-- simule leur JWT via set_config('request.jwt.claims'), exécute 9 assertions,
-- puis annule TOUT (ROLLBACK) : aucune donnée n'est laissée en base.
-- Une assertion en échec fait échouer le script avec un message explicite.
-- ============================================================

BEGIN;

-- Utilisateurs de test dans auth.users (rollback en fin de script).
\set uid_a '11111111-1111-1111-1111-111111111111'
\set uid_b '22222222-2222-2222-2222-222222222222'
\set uid_admin '33333333-3333-3333-3333-333333333333'

INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES
  (:'uid_a', 'rls-a@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  (:'uid_b', 'rls-b@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  (:'uid_admin', 'rls-admin@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

INSERT INTO public.user_roles (user_id, role) VALUES (:'uid_admin', 'admin');

INSERT INTO public.therapists (user_id, slug, first_name, last_name, status)
VALUES (:'uid_a', 'rls-test-a', 'Alice', 'RlsA', 'active'),
       (:'uid_b', 'rls-test-b', 'Bob', 'RlsB', 'active');

CREATE TEMP TABLE ids AS
SELECT
  (SELECT id FROM public.therapists WHERE slug = 'rls-test-a') AS t_a,
  (SELECT id FROM public.therapists WHERE slug = 'rls-test-b') AS t_b;

INSERT INTO public.therapist_certifications (therapist_id, name, verification_status)
SELECT t_a, 'Certif A', 'declared' FROM ids
UNION ALL
SELECT t_b, 'Certif B', 'declared' FROM ids;

CREATE TEMP TABLE cids AS
SELECT
  (SELECT id FROM public.therapist_certifications WHERE name = 'Certif A') AS c_a,
  (SELECT id FROM public.therapist_certifications WHERE name = 'Certif B') AS c_b;

-- Helper : se faire passer pour un utilisateur authentifié.
CREATE OR REPLACE FUNCTION pg_temp.act_as(p_uid uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END $$;

CREATE OR REPLACE FUNCTION pg_temp.check(p_label text, p_expected int, p_actual int) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF p_expected <> p_actual THEN
    RAISE EXCEPTION 'ÉCHEC RLS [%] : attendu % ligne(s), obtenu %', p_label, p_expected, p_actual;
  END IF;
  RAISE NOTICE 'OK  [%] % ligne(s)', p_label, p_actual;
END $$;

DO $$
DECLARE
  v_a uuid; v_b uuid; v_ca uuid; v_cb uuid; n int;
  v_uid_a uuid := '11111111-1111-1111-1111-111111111111';
  v_uid_b uuid := '22222222-2222-2222-2222-222222222222';
  v_uid_admin uuid := '33333333-3333-3333-3333-333333333333';
BEGIN
  SELECT t_a, t_b INTO v_a, v_b FROM ids;
  SELECT c_a, c_b INTO v_ca, v_cb FROM cids;

  -- ---------- Thérapeute A ----------
  PERFORM pg_temp.act_as(v_uid_a);

  -- 1. A ne peut PAS modifier la fiche de B.
  WITH u AS (UPDATE public.therapists SET city = 'Pirate' WHERE id = v_b RETURNING 1)
  SELECT count(*) INTO n FROM u;
  PERFORM pg_temp.check('A update fiche de B (refus attendu)', 0, n);

  -- 2. A ne peut PAS supprimer la fiche de B.
  WITH d AS (DELETE FROM public.therapists WHERE id = v_b RETURNING 1)
  SELECT count(*) INTO n FROM d;
  PERFORM pg_temp.check('A delete fiche de B (refus attendu)', 0, n);

  -- 3. A peut modifier sa propre fiche (champs éditables).
  WITH u AS (UPDATE public.therapists SET city = 'Lausanne' WHERE id = v_a RETURNING 1)
  SELECT count(*) INTO n FROM u;
  PERFORM pg_temp.check('A update sa fiche', 1, n);

  -- 4. A ne peut PAS toucher aux champs administratifs.
  BEGIN
    UPDATE public.therapists SET verified = true WHERE id = v_a;
    RAISE EXCEPTION 'ÉCHEC RLS [A self-verify] : la mise à jour a été acceptée';
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN
    IF SQLERRM LIKE 'ÉCHEC RLS%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  [A self-verify bloqué] %', SQLERRM;
  END;

  -- 5. A ne peut PAS modifier la certification de B.
  WITH u AS (UPDATE public.therapist_certifications SET name = 'Pirate' WHERE id = v_cb RETURNING 1)
  SELECT count(*) INTO n FROM u;
  PERFORM pg_temp.check('A update certif de B (refus attendu)', 0, n);

  -- 6. A ne peut PAS supprimer la certification de B.
  WITH d AS (DELETE FROM public.therapist_certifications WHERE id = v_cb RETURNING 1)
  SELECT count(*) INTO n FROM d;
  PERFORM pg_temp.check('A delete certif de B (refus attendu)', 0, n);

  -- 7. A peut modifier sa propre certification (hors champs de vérification).
  WITH u AS (UPDATE public.therapist_certifications SET name = 'Certif A v2' WHERE id = v_ca RETURNING 1)
  SELECT count(*) INTO n FROM u;
  PERFORM pg_temp.check('A update sa certif', 1, n);

  -- 8. A ne peut PAS auto-valider sa certification.
  BEGIN
    UPDATE public.therapist_certifications SET verification_status = 'verified' WHERE id = v_ca;
    RAISE EXCEPTION 'ÉCHEC RLS [A self-verify certif] : la mise à jour a été acceptée';
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN
    IF SQLERRM LIKE 'ÉCHEC RLS%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  [A self-verify certif bloqué] %', SQLERRM;
  END;

  RESET ROLE;

  -- ---------- Admin ----------
  PERFORM pg_temp.act_as(v_uid_admin);

  -- 9. L'admin conserve ses droits (statut fiche + vérification certif).
  WITH u AS (UPDATE public.therapists SET verified = true WHERE id = v_b RETURNING 1)
  SELECT count(*) INTO n FROM u;
  PERFORM pg_temp.check('admin update fiche B', 1, n);

  WITH u AS (UPDATE public.therapist_certifications SET verification_status = 'verified' WHERE id = v_cb RETURNING 1)
  SELECT count(*) INTO n FROM u;
  PERFORM pg_temp.check('admin valide certif B', 1, n);

  RESET ROLE;

  RAISE NOTICE '=== Toutes les assertions RLS du Lot 1 sont passées ===';
END $$;

ROLLBACK;
