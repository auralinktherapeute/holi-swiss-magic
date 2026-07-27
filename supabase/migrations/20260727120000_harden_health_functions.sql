-- Durcissement : PostgreSQL accorde EXECUTE à PUBLIC par défaut sur toute
-- fonction. Les fonctions de l'agent Santé de Profil étaient donc appelables
-- avec la clé anonyme (publique, présente dans le bundle du site) : pas de
-- fuite de données (RLS admin-only sur les tables), mais un recalcul complet
-- déclenchable à volonté par n'importe qui.
--
-- L'application n'appelle ces fonctions que via le client service-role
-- (server functions), donc seul service_role a besoin du droit d'exécution.
--
-- is_admin() est volontairement épargnée : elle est évaluée à l'intérieur des
-- policies RLS pour le compte du rôle appelant et doit rester exécutable.

revoke execute on function public.compute_therapist_health() from public, anon, authenticated;
revoke execute on function public.compute_therapist_health_one(uuid) from public, anon, authenticated;
revoke execute on function public.therapist_health_signals(uuid) from public, anon, authenticated;

grant execute on function public.compute_therapist_health() to service_role;
grant execute on function public.compute_therapist_health_one(uuid) to service_role;
grant execute on function public.therapist_health_signals(uuid) to service_role;

notify pgrst, 'reload schema';
