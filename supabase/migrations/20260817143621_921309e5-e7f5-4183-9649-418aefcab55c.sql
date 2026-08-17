-- ============ Places fondateur (70 premiers thérapeutes) ============
CREATE TABLE IF NOT EXISTS public.founder_seats (
  seat_number int PRIMARY KEY CHECK (seat_number BETWEEN 1 AND 70),
  therapist_id uuid NOT NULL UNIQUE REFERENCES public.therapists(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'auto_activation',
  status text NOT NULL DEFAULT 'active',
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid,
  revoked_at timestamptz,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT founder_seats_source_chk CHECK (source IN ('auto_activation','admin_manual','commercial_offer','offer_accepted','backfill')),
  CONSTRAINT founder_seats_status_chk CHECK (status IN ('active','revoked'))
);

GRANT SELECT ON public.founder_seats TO authenticated;
GRANT ALL ON public.founder_seats TO service_role;
ALTER TABLE public.founder_seats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "founder_seats_select_own_or_admin" ON public.founder_seats;
CREATE POLICY "founder_seats_select_own_or_admin"
  ON public.founder_seats FOR SELECT TO authenticated
  USING (public.is_therapist_owner(therapist_id) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "founder_seats_admin_all" ON public.founder_seats;
CREATE POLICY "founder_seats_admin_all"
  ON public.founder_seats FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.founder_seat_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL,
  seat_number int,
  action text NOT NULL,
  source text,
  actor uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS founder_seat_events_therapist_idx ON public.founder_seat_events(therapist_id, created_at DESC);

GRANT SELECT ON public.founder_seat_events TO authenticated;
GRANT ALL ON public.founder_seat_events TO service_role;
ALTER TABLE public.founder_seat_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "founder_seat_events_admin_select" ON public.founder_seat_events;
CREATE POLICY "founder_seat_events_admin_select"
  ON public.founder_seat_events FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Attribution d'un numéro d'ordre immuable, sans doublon.
CREATE OR REPLACE FUNCTION public.claim_founder_seat(
  _therapist_id uuid,
  _source text DEFAULT 'auto_activation',
  _actor uuid DEFAULT NULL,
  _note text DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seat int;
  v_status text;
BEGIN
  SELECT seat_number, status INTO v_seat, v_status
  FROM public.founder_seats WHERE therapist_id = _therapist_id;

  IF v_seat IS NOT NULL THEN
    IF v_status = 'revoked' THEN
      UPDATE public.founder_seats
        SET status = 'active', revoked_at = NULL, updated_at = now(),
            source = COALESCE(_source, source), note = COALESCE(_note, note)
        WHERE therapist_id = _therapist_id;
      INSERT INTO public.founder_seat_events(therapist_id, seat_number, action, source, actor, note)
      VALUES (_therapist_id, v_seat, 'restored', _source, _actor, _note);
    END IF;
    RETURN v_seat;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('founder_seats'));

  SELECT n INTO v_seat
  FROM generate_series(1, 70) AS n
  WHERE NOT EXISTS (SELECT 1 FROM public.founder_seats fs WHERE fs.seat_number = n)
  ORDER BY n LIMIT 1;

  IF v_seat IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.founder_seats(seat_number, therapist_id, source, granted_by, note)
  VALUES (v_seat, _therapist_id, COALESCE(_source, 'auto_activation'), _actor, _note)
  ON CONFLICT (therapist_id) DO NOTHING;

  SELECT seat_number INTO v_seat FROM public.founder_seats WHERE therapist_id = _therapist_id;

  INSERT INTO public.founder_seat_events(therapist_id, seat_number, action, source, actor, note)
  VALUES (_therapist_id, v_seat, 'granted', _source, _actor, _note);

  RETURN v_seat;
END $$;

REVOKE EXECUTE ON FUNCTION public.claim_founder_seat(uuid, text, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_founder_seat(uuid, text, uuid, text) TO service_role;

-- Retrait (le numéro reste attaché au thérapeute, il n'est pas recyclé).
CREATE OR REPLACE FUNCTION public.revoke_founder_seat(_therapist_id uuid, _actor uuid DEFAULT NULL, _note text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_seat int;
BEGIN
  UPDATE public.founder_seats
    SET status = 'revoked', revoked_at = now(), updated_at = now(), note = COALESCE(_note, note)
    WHERE therapist_id = _therapist_id AND status = 'active'
    RETURNING seat_number INTO v_seat;
  IF v_seat IS NULL THEN RETURN false; END IF;
  INSERT INTO public.founder_seat_events(therapist_id, seat_number, action, actor, note)
  VALUES (_therapist_id, v_seat, 'revoked', _actor, _note);
  RETURN true;
END $$;

REVOKE EXECUTE ON FUNCTION public.revoke_founder_seat(uuid, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_founder_seat(uuid, uuid, text) TO service_role;

-- Attribution automatique à l'activation d'une fiche.
CREATE OR REPLACE FUNCTION public.trg_founder_seat_on_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('active','paused') THEN
    PERFORM public.claim_founder_seat(NEW.id, 'auto_activation', NULL, NULL);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS founder_seat_on_activation ON public.therapists;
CREATE TRIGGER founder_seat_on_activation
AFTER INSERT OR UPDATE OF status ON public.therapists
FOR EACH ROW EXECUTE FUNCTION public.trg_founder_seat_on_activation();

-- Reprise de l'existant : les plus anciens thérapeutes actifs d'abord.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM public.therapists
    WHERE status IN ('active','paused')
      AND id NOT IN (SELECT therapist_id FROM public.founder_seats)
    ORDER BY created_at ASC, id ASC
    LIMIT 70
  LOOP
    PERFORM public.claim_founder_seat(r.id, 'backfill', NULL, 'Reprise historique');
  END LOOP;
END $$;

-- Éligibilité : basée sur la place fondateur immuable, plus le COUNT courant.
CREATE OR REPLACE FUNCTION public.advanced_scoring_eligibility(_therapist_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT t.id, t.subscription_plan FROM public.therapists t WHERE t.id = _therapist_id
  ),
  seat AS (
    SELECT * FROM public.founder_seats WHERE therapist_id = _therapist_id
  ),
  grant_row AS (
    SELECT a.* FROM public.therapist_advanced_scoring_access a
    WHERE a.therapist_id = _therapist_id AND a.enabled
  )
  SELECT jsonb_build_object(
    'therapist_id', _therapist_id,
    'early_rank', (SELECT seat_number FROM seat),
    'seat_status', (SELECT status FROM seat),
    'seat_granted_at', (SELECT granted_at FROM seat),
    'seat_source', (SELECT source FROM seat),
    'is_early', COALESCE((SELECT status = 'active' FROM seat), false),
    'is_elite_pro', COALESCE((SELECT subscription_plan FROM me) = 'elite_pro', false),
    'grant_source', (SELECT source FROM grant_row),
    'granted_at', (SELECT granted_at FROM grant_row),
    'granted_note', (SELECT note FROM grant_row),
    'seats_used', (SELECT count(*) FROM public.founder_seats),
    'seats_total', 70
  );
$$;

REVOKE EXECUTE ON FUNCTION public.advanced_scoring_eligibility(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advanced_scoring_eligibility(uuid) TO service_role;

INSERT INTO public.app_settings(key, value) VALUES ('founder_seat_number_display', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;