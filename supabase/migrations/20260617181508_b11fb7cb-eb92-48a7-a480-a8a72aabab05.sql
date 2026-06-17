
-- 1) Restrict public availabilities to active therapists only
DROP POLICY IF EXISTS "Public read availabilities" ON public.availabilities;
CREATE POLICY "Public read availabilities"
ON public.availabilities
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.therapists t
    WHERE t.id = availabilities.therapist_id
      AND t.status = 'active'
  )
);

-- 2) Prevent therapists from self-elevating verified/status flags
-- The function public.prevent_therapist_self_elevation already exists; attach it as a trigger.
DROP TRIGGER IF EXISTS prevent_therapist_self_elevation_trg ON public.therapists;
CREATE TRIGGER prevent_therapist_self_elevation_trg
BEFORE UPDATE ON public.therapists
FOR EACH ROW
EXECUTE FUNCTION public.prevent_therapist_self_elevation();
