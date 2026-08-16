-- Advisors 0028/0029 (SECURITY DEFINER exécutable par anon/authenticated) — 2e passe.
--
-- La 1re passe (20260816215809) a couvert les fonctions écrivantes à risque + un filet
-- défensif. Ici on ferme le reste QUI PEUT L'ÊTRE SANS RÉGRESSION :
--
--   * 12 fonctions TRIGGER : elles retournent `trigger`, ne sont donc jamais appelables
--     via l'API REST (PostgREST ne les expose pas) et s'exécutent au nom du owner quand
--     leur trigger se déclenche. Retirer anon/authenticated n'a aucun effet fonctionnel.
--   * therapist_review_stats(uuid) et waiting_list_count() : AUCUN appelant dans tout le
--     code (ni .rpc() côté client, ni fonction SQL, ni cron) — vestiges, on les verrouille.
--
-- NE SONT PAS TOUCHÉES (verront un warning résiduel, par conception) :
--   * Helpers RLS : has_role, is_admin, is_therapist_owner, is_elite_pro — doivent rester
--     exécutables (les policies les évaluent au nom du rôle courant) ; les révoquer casserait la RLS.
--   * Fonctions publiques appelées par le site anonyme : search_therapists, search_specialties,
--     resolve_city, therapists_within_radius, get_therapist_intake_header (publicClient = anon).
--   * Groupe B de la 1re passe : authenticated conservé volontairement (dashboard).
--
-- Idempotent. À appliquer via Lovable.

do $$
declare
  f text;
  -- fonctions trigger (aucun argument) + 2 fonctions sans appelant
  targets text[] := array[
    'check_verifier_not_producer()',
    'mvp_check_verifier_not_self()',
    'prevent_therapist_self_elevation()',
    'reviews_force_pending_on_edit()',
    'reviews_lock_reviewer_fields()',
    'therapists_fill_coords_from_city()',
    'therapists_lock_admin_fields()',
    'trg_notify_article_pending()',
    'trg_notify_marketing_proposal()',
    'trg_notify_new_review()',
    'trg_notify_therapist_article_pending()',
    'waiting_list_protect_invitation_fields()',
    'therapist_review_stats(uuid)',
    'waiting_list_count()'
  ];
begin
  foreach f in array targets loop
    if to_regprocedure('public.' || f) is not null then
      execute format('revoke execute on function public.%s from public, anon, authenticated', f);
      execute format('grant  execute on function public.%s to service_role', f);
    else
      raise notice 'fonction absente, ignorée -> %', f;
    end if;
  end loop;
end $$;
