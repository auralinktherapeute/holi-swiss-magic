-- Seed Gerald Henry's therapist profile + grant admin role
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'henry-g76@hotmail.fr' LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth user found for henry-g76@hotmail.fr';
  END IF;

  -- 1) Grant admin role (idempotent)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 2) Upsert therapist profile
  INSERT INTO public.therapists (
    user_id, slug, first_name, last_name, title, bio,
    specialties, approaches, languages,
    address, postal_code, city, country, latitude, longitude,
    consultation_modes, price_min, price_max, currency,
    email, status, verified, years_experience,
    services
  ) VALUES (
    v_user_id,
    'gerald-henry',
    'Gerald',
    'Henry',
    'Magnétiseur · Lithothérapeute · Radiesthésiste · Cartomancie',
    'Thérapeute passionné, je pratique les soins esséniens et énergétiques depuis une dizaine d''années. Magnétisme, lithothérapie, radiesthésie et cartomancie au service de votre équilibre.',
    ARRAY['Magnétiseur','Lithothérapeute','Radiesthésiste','Cartomancie'],
    ARRAY['Soins énergétiques','Soins esséniens'],
    ARRAY['fr'],
    NULL, '68220', 'Hesingue', 'FR', 47.5897, 7.5456,
    ARRAY['in_person'],
    60, 120, 'CHF',
    'henry-g76@hotmail.fr',
    'active',
    true,
    10,
    '[
      {"name":"Séance Magnétisme","duration_minutes":90,"price":90,"currency":"CHF","modes":["in_person"]},
      {"name":"Séance Lithothérapie","duration_minutes":90,"price":90,"currency":"CHF","modes":["in_person"]},
      {"name":"Séance Radiesthésie","duration_minutes":90,"price":90,"currency":"CHF","modes":["in_person"]},
      {"name":"Cartomancie","duration_minutes":90,"price":60,"currency":"CHF","modes":["in_person","online"]}
    ]'::jsonb
  )
  ON CONFLICT (user_id) DO UPDATE SET
    slug = EXCLUDED.slug,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    title = EXCLUDED.title,
    bio = EXCLUDED.bio,
    specialties = EXCLUDED.specialties,
    approaches = EXCLUDED.approaches,
    languages = EXCLUDED.languages,
    postal_code = EXCLUDED.postal_code,
    city = EXCLUDED.city,
    country = EXCLUDED.country,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    consultation_modes = EXCLUDED.consultation_modes,
    price_min = EXCLUDED.price_min,
    price_max = EXCLUDED.price_max,
    email = EXCLUDED.email,
    status = 'active',
    verified = true,
    years_experience = EXCLUDED.years_experience,
    services = EXCLUDED.services,
    updated_at = now();
END $$;