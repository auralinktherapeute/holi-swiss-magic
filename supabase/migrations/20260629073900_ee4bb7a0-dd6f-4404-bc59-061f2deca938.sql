GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

WITH admin_user AS (
  SELECT id FROM auth.users WHERE lower(email) = 'contact@holiswiss.ch' LIMIT 1
), therapist_user AS (
  SELECT id FROM auth.users WHERE lower(email) = 'henry-g76@hotmail.fr' LIMIT 1
)
DELETE FROM public.user_roles ur
WHERE (ur.user_id IN (SELECT id FROM admin_user) AND ur.role <> 'admin')
   OR (ur.user_id IN (SELECT id FROM therapist_user) AND ur.role <> 'therapist');

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE lower(email) = 'contact@holiswiss.ch'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'therapist'::public.app_role FROM auth.users WHERE lower(email) = 'henry-g76@hotmail.fr'
ON CONFLICT (user_id, role) DO NOTHING;