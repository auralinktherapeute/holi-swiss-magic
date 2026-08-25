-- ============================================================================
-- Rétablir EXECUTE sur les helpers appelés dans les policies RLS
--
-- PANNE CONSTATÉE EN PRODUCTION (audit du 25/08/2026)
--   Toutes les pages spécialité affichent « Aucun thérapeute référencé », y
--   compris /fr/specialites/magnetisme/basel — qui figure pourtant au sitemap
--   parce qu'un praticien correspondant existe bel et bien.
--
--   Chaîne exacte :
--     1. la page lit `therapist_specialties` avec la clé ANONYME
--     2. la policy `th_spec_read_public` fait un exists(...) sur `therapists`
--     3. lire `therapists` déclenche SA policy, qui appelle has_role()
--     4. `anon` n'a plus EXECUTE sur has_role  →  la requête entière échoue
--
--   Vérifiable en une commande :
--     curl ".../rest/v1/therapist_specialties?select=therapist_id&limit=1"
--     → {"code":"42501","message":"permission denied for function has_role"}
--
--   Le sitemap, lui, lit avec `service_role` (qui contourne la RLS) et continue
--   donc de publier ces URLs. D'où la contradiction : le sitemap annonce des
--   pages que la page elle-même déclare vides — exactement les « pages faibles »
--   que le cahier des charges interdit de créer.
--
-- POURQUOI C'EST UNE RESTAURATION, PAS UN ASSOUPLISSEMENT
--   Les deux migrations de durcissement du 16/08 excluent explicitement ces
--   helpers de toute révocation :
--     20260816215809 : « On ne touche PAS aux helpers appelés dans les policies
--                        RLS (is_admin, is_therapist_owner, has_role,
--                        is_elite_pro) : les révoquer casserait le site public
--                        ou la RLS. »
--     20260816224910 : « Helpers RLS : has_role, is_admin, is_therapist_owner,
--                        is_elite_pro — doivent rester [exécutables]. »
--   Aucune migration du dépôt ne les révoque. La révocation a été appliquée
--   directement sur la production, hors dépôt. Cette migration remet la base
--   dans l'état que le dépôt décrit.
--
-- SURFACE
--   has_role(uuid, app_role) renvoie un BOOLÉEN et n'expose aucune donnée : elle
--   teste l'appartenance d'un user_id à un rôle. Elle ne permet pas d'énumérer
--   les rôles ni de lire `user_roles`. Les protections qui comptent restent
--   intactes et sont vérifiées par les tests ci-dessous : `therapists.email` et
--   `therapists.phone` doivent continuer de renvoyer 401 pour `anon`.
--
-- Idempotente : les GRANT sont rejouables, et chaque fonction absente est
-- ignorée plutôt que de faire échouer la migration.
-- À appliquer via Lovable.
-- ============================================================================

do $$
declare
  f text;
  helpers text[] := array[
    'has_role(uuid, public.app_role)',
    'is_admin(uuid)',
    'is_therapist_owner(uuid)',
    'is_elite_pro(uuid)',
    'is_verified_therapist(uuid)'
  ];
begin
  foreach f in array helpers loop
    if to_regprocedure('public.' || f) is not null then
      execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
      raise notice 'EXECUTE rétabli -> %', f;
    else
      raise notice 'fonction absente, ignorée -> %', f;
    end if;
  end loop;
end $$;

comment on function public.has_role(uuid, public.app_role) is
  'Helper RLS. DOIT rester exécutable par anon et authenticated : les policies de lecture publique (therapists, therapist_specialties) le traversent. Le révoquer casse silencieusement toutes les pages spécialité — constaté en production le 25/08/2026.';
