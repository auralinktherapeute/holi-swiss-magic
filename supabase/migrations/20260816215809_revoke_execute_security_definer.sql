-- Durcissement : retirer EXECUTE à PUBLIC/anon sur les fonctions SECURITY DEFINER
-- qui n'ont aucune raison d'être appelées par un visiteur anonyme.
--
-- Contexte : PostgreSQL accorde EXECUTE à PUBLIC par défaut. 45 des 63 fonctions
-- SECURITY DEFINER n'avaient pas de REVOKE, donc le rôle anon pouvait les appeler
-- via l'API REST (confirmé en prod : admin_unread_count -> 200, admin_badge_counts
-- -> "forbidden", donc exécutées). La plupart sont protégées par une garde interne,
-- mais create_admin_notification / notify_admin_event / crm_daily_maintenance
-- écrivent sans garde (spam de notifications, http_post sortant, mutation CRM).
--
-- Principe de sûreté :
--   * Révoquer EXECUTE ne casse PAS les triggers (ils s'exécutent au nom du owner)
--     ni les appels supabaseAdmin (service_role reçoit un GRANT explicite).
--   * On ne touche PAS aux fonctions publiques (recherche annuaire) ni aux helpers
--     appelés dans les policies RLS (is_admin, is_therapist_owner, has_role,
--     is_elite_pro) : les révoquer casserait le site public ou la RLS.
--   * On préserve 'authenticated' là où le client connecté appelle la fonction
--     directement (dashboard thérapeute).
--
-- Idempotent : REVOKE/GRANT peuvent être rejoués sans effet de bord.
-- À appliquer via Lovable (jamais d'écriture directe sur qqwud).

-- ── GROUPE A ─ fonctions internes (triggers / cron / supabaseAdmin uniquement) ──
-- Aucun appel client. Révoquer à tous, ne rendre qu'à service_role.

do $$
declare
  f text;
  targets text[] := array[
    'create_admin_notification(text, text, text, text, text, uuid, jsonb)',
    'notify_admin_event(text, text, text, text)',
    'crm_daily_maintenance()',
    'resolve_admin_notifications()',
    'compute_therapist_health()',
    'compute_therapist_health_one(uuid)',
    'therapist_health_signals(uuid)',
    'anonymize_user_analytics(uuid)',
    'purge_user_analytics(uuid)'
  ];
begin
  foreach f in array targets loop
    if to_regprocedure('public.' || f) is not null then
      execute format('revoke execute on function public.%s from public, anon, authenticated', f);
      execute format('grant  execute on function public.%s to service_role', f);
    else
      raise notice 'GROUPE A : fonction absente, ignorée -> %', f;
    end if;
  end loop;
end $$;

-- ── GROUPE B ─ fonctions à garde interne / appelées par le client authentifié ──
-- Déni de anon, mais on conserve authenticated (dashboard) + service_role.
--   get_my_therapist_contact      : appelée côté client (dashboard.profil.tsx), filtre auth.uid()
--   reserve_next_invoice_number   : appelée avec le client authentifié de la requête
--   mark_notification_read/all    : opérations utilisateur, garde interne
--   admin_*                       : garde interne has_role('admin') ; anon n'a rien à y faire

do $$
declare
  f text;
  targets text[] := array[
    'get_my_therapist_contact()',
    'reserve_next_invoice_number(uuid)',
    'mark_notification_read(uuid)',
    'mark_all_notifications_read()',
    'admin_badge_counts()',
    'admin_unread_count()',
    'admin_therapist_client_stats()',
    'admin_specialty_coherence_report()'
  ];
begin
  foreach f in array targets loop
    if to_regprocedure('public.' || f) is not null then
      execute format('revoke execute on function public.%s from public, anon', f);
      execute format('grant  execute on function public.%s to authenticated, service_role', f);
    else
      raise notice 'GROUPE B : fonction absente, ignorée -> %', f;
    end if;
  end loop;
end $$;

-- ── NON TOUCHÉ (documenté volontairement) ───────────────────────────────────
-- Publiques (site anonyme) : search_therapists, search_specialties, resolve_city,
--   therapists_within_radius, get_therapist_intake_header, therapist_review_stats
-- Helpers RLS (révoquer casserait la RLS) : is_admin, is_therapist_owner,
--   has_role, is_elite_pro
