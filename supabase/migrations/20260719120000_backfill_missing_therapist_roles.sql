-- Rattrapage : les comptes créés via /inscription (email ou Google) n'ont
-- jamais reçu de ligne user_roles — le garde du dashboard les renvoyait en
-- boucle vers /connexion. Attribue le rôle therapist à tout profil thérapeute
-- dont l'utilisateur n'a encore aucun rôle. Idempotent.
INSERT INTO public.user_roles (user_id, role)
SELECT t.user_id, 'therapist'::public.app_role
FROM public.therapists t
WHERE t.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = t.user_id
  )
ON CONFLICT (user_id, role) DO NOTHING;

-- Comptes auth sans profil thérapeute ET sans rôle (inscription interrompue
-- avant la création du profil) : même self-heal.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'therapist'::public.app_role
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id
  )
ON CONFLICT (user_id, role) DO NOTHING;
