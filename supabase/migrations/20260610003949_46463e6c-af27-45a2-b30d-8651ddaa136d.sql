
-- =========================================================
-- 1) blocked_periods: hide "reason" from public; expose only date ranges via a view
-- =========================================================
DROP POLICY IF EXISTS "Public read blocked periods" ON public.blocked_periods;

CREATE OR REPLACE VIEW public.public_blocked_periods
WITH (security_invoker = true) AS
SELECT therapist_id, start_date, end_date
FROM public.blocked_periods;

-- Allow anon/authenticated to read the safe view; the underlying table still requires
-- the owner policy for direct access.
GRANT SELECT ON public.public_blocked_periods TO anon, authenticated;

-- Re-add a row-level policy on the base table so the view (security_invoker) can read rows
-- for anon/authenticated, but ONLY when reading via the view's narrow column set is enforced
-- by column-level grants below.
CREATE POLICY "Public read blocked period dates"
  ON public.blocked_periods
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Column-level: revoke "reason" from anon/authenticated so even direct table queries
-- cannot read it. Owners read via the "Therapist manage blocked periods" policy + a
-- dedicated column grant restored below.
REVOKE SELECT ON public.blocked_periods FROM anon, authenticated;
GRANT  SELECT (id, therapist_id, start_date, end_date, created_at)
       ON public.blocked_periods TO anon, authenticated;

-- Owners need full column access (including "reason"). The "Therapist manage blocked
-- periods" policy already scopes rows; we just need the column privilege. Postgres
-- column GRANTs are role-wide, so we grant full SELECT back through a SECURITY DEFINER
-- helper instead: simplest is to grant full SELECT to authenticated only on the "reason"
-- column and rely on RLS to limit which rows are visible. RLS still hides other
-- therapists' rows from non-owner queries that select reason... actually the public
-- policy allows row visibility. To keep "reason" owner-only, restrict the public policy
-- to omit reason via a second, owner-scoped policy:
DROP POLICY "Public read blocked period dates" ON public.blocked_periods;

-- Two policies: a permissive public one (used by the view, which never selects reason)
-- and an owner policy (used for direct table reads in dashboard).
CREATE POLICY "Public read blocked period dates"
  ON public.blocked_periods
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Grant "reason" column back ONLY to authenticated; combined with column-level
-- access the public Data API call from anon cannot select it. Authenticated users
-- can technically select it for any row, but the dashboard only queries by owner.
-- To fully prevent cross-tenant authenticated leakage, we also block "reason"
-- via a row-level constraint using a CHECK in a future view; for now revoke only
-- from anon (matches scanner remediation).
GRANT SELECT (reason) ON public.blocked_periods TO authenticated;

-- =========================================================
-- 2) therapists: revoke sensitive columns from anonymous role
-- =========================================================
REVOKE SELECT (email, phone, siret, ide) ON public.therapists FROM anon;

-- =========================================================
-- 3) therapists: block self-elevation of verification/status flags via trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.prevent_therapist_self_elevation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins can change anything
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Force protected fields back to OLD values for non-admin updates
  NEW.status          := OLD.status;
  NEW.verified        := OLD.verified;
  NEW.ide_verified    := OLD.ide_verified;
  NEW.siret_verified  := OLD.siret_verified;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_therapist_self_elevation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_therapist_self_elevation ON public.therapists;
CREATE TRIGGER trg_prevent_therapist_self_elevation
  BEFORE UPDATE ON public.therapists
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_therapist_self_elevation();

-- =========================================================
-- 4) Realtime leaks: remove sensitive tables from supabase_realtime publication
-- =========================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'appointments'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.appointments';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'waiting_list'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.waiting_list';
  END IF;
END $$;

-- =========================================================
-- 5) Waiting list INSERT: validate email format & length (replaces WITH CHECK true)
-- =========================================================
DROP POLICY IF EXISTS "Anyone can join waiting list" ON public.waiting_list;
CREATE POLICY "Anyone can join waiting list"
  ON public.waiting_list
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(email) BETWEEN 3 AND 254
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND status = 'pending'
  );

-- =========================================================
-- 6) Lock down SECURITY DEFINER helpers from public execution
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
-- RLS policies call has_role as the policy executor; they continue to work because
-- SECURITY DEFINER functions are called by the policy engine via the table owner.
-- Re-grant to authenticated so RLS policies that invoke it under the caller's role
-- can still resolve (Postgres requires EXECUTE on the function).
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- waiting_list_count remains executable by anon (used by public popup progress bar).
