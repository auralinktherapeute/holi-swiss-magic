GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

DO $$
DECLARE
  admin_user_id uuid;
  therapist_user_id uuid;
BEGIN
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE lower(email) = 'contact@holiswiss.ch'
  LIMIT 1;

  SELECT id INTO therapist_user_id
  FROM auth.users
  WHERE lower(email) = 'henry-g76@hotmail.fr'
  LIMIT 1;

  IF admin_user_id IS NOT NULL THEN
    DELETE FROM public.user_roles
    WHERE user_id = admin_user_id
      AND role <> 'admin'::public.app_role;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  IF therapist_user_id IS NOT NULL THEN
    DELETE FROM public.user_roles
    WHERE user_id = therapist_user_id
      AND role <> 'therapist'::public.app_role;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (therapist_user_id, 'therapist'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;