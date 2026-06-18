INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'henry-g76@hotmail.fr'
ON CONFLICT (user_id, role) DO NOTHING;