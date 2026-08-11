-- =====================================================================
-- Analytics admin — sessions utilisateurs connectés, pages vues,
-- vues de profil thérapeute, clics de réservation.
-- Tracking basé sur les comptes connectés (pas de Google Analytics).
-- Auto-contenu : ne dépend d'aucune fonction/type créés par une autre
-- migration (le check admin est inline sur user_roles, vérifié en
-- production le 11/08/2026 : id, user_id, role existent bien sur qqwud).
-- Entièrement idempotent : peut être rejoué sans risque.
-- =====================================================================

-- 1) Sessions utilisateurs connectés (thérapeutes, clients, admins) -------
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_type text not null check (user_type in ('admin', 'moderator', 'therapist', 'user')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_seen_at timestamptz not null default now(),
  -- Calculée automatiquement seulement quand la session a une fin explicite
  -- (déconnexion ou beacon de fermeture d'onglet). Pour les rapports, préférer
  -- coalesce(ended_at, last_seen_at) - started_at, qui couvre aussi les
  -- sessions jamais closes explicitement (onglet fermé sans beacon, crash...).
  duration_seconds integer generated always as (
    case when ended_at is not null
      then greatest(0, extract(epoch from (ended_at - started_at))::int)
    end
  ) stored,
  device_type text check (device_type in ('mobile', 'tablet', 'desktop', 'other')),
  user_agent text,
  ip_country text,
  created_at timestamptz not null default now()
);

create index if not exists user_sessions_user_idx on public.user_sessions(user_id);
create index if not exists user_sessions_started_idx on public.user_sessions(started_at desc);
create index if not exists user_sessions_type_started_idx on public.user_sessions(user_type, started_at desc);
-- Sessions encore "ouvertes" (pour DAU/MAU en temps réel et le sweep de clôture)
create index if not exists user_sessions_open_idx on public.user_sessions(last_seen_at) where ended_at is null;

alter table public.user_sessions enable row level security;

drop policy if exists user_sessions_admin_read on public.user_sessions;
create policy user_sessions_admin_read on public.user_sessions for select
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role::text = 'admin'
  ));
-- Aucune policy insert/update/delete pour anon/authenticated : toutes les
-- écritures passent exclusivement par les server functions (service_role),
-- jamais depuis le navigateur.

grant select, insert, update, delete on public.user_sessions to service_role;
grant select on public.user_sessions to authenticated;

-- 2) Pages vues (visiteurs connectés ET anonymes) -------------------------
create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_type text check (user_type in ('admin', 'moderator', 'therapist', 'user')),
  session_id uuid references public.user_sessions(id) on delete set null,
  path text not null,
  referrer text,
  created_at timestamptz not null default now()
);

create index if not exists page_views_user_idx on public.page_views(user_id);
create index if not exists page_views_created_idx on public.page_views(created_at desc);
create index if not exists page_views_session_idx on public.page_views(session_id);
create index if not exists page_views_path_idx on public.page_views(path);

alter table public.page_views enable row level security;

drop policy if exists page_views_admin_read on public.page_views;
create policy page_views_admin_read on public.page_views for select
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role::text = 'admin'
  ));

grant select, insert, update, delete on public.page_views to service_role;
grant select on public.page_views to authenticated;

-- 3) Vues de profil thérapeute --------------------------------------------
create table if not exists public.therapist_profile_views (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  viewer_user_id uuid references auth.users(id) on delete cascade,
  viewer_type text check (viewer_type in ('admin', 'moderator', 'therapist', 'user')),
  session_id uuid references public.user_sessions(id) on delete set null,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create index if not exists tpv_therapist_idx on public.therapist_profile_views(therapist_id);
create index if not exists tpv_viewer_idx on public.therapist_profile_views(viewer_user_id);
create index if not exists tpv_created_idx on public.therapist_profile_views(created_at desc);
create index if not exists tpv_therapist_created_idx on public.therapist_profile_views(therapist_id, created_at desc);

alter table public.therapist_profile_views enable row level security;

drop policy if exists tpv_admin_read on public.therapist_profile_views;
create policy tpv_admin_read on public.therapist_profile_views for select
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role::text = 'admin'
  ));

grant select, insert, update, delete on public.therapist_profile_views to service_role;
grant select on public.therapist_profile_views to authenticated;

-- 4) Clics sur "Réserver" (pour le taux de clics profil -> réservation) ---
create table if not exists public.therapist_booking_clicks (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  viewer_user_id uuid references auth.users(id) on delete cascade,
  viewer_type text check (viewer_type in ('admin', 'moderator', 'therapist', 'user')),
  session_id uuid references public.user_sessions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists tbc_therapist_idx on public.therapist_booking_clicks(therapist_id);
create index if not exists tbc_created_idx on public.therapist_booking_clicks(created_at desc);

alter table public.therapist_booking_clicks enable row level security;

drop policy if exists tbc_admin_read on public.therapist_booking_clicks;
create policy tbc_admin_read on public.therapist_booking_clicks for select
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role::text = 'admin'
  ));

grant select, insert, update, delete on public.therapist_booking_clicks to service_role;
grant select on public.therapist_booking_clicks to authenticated;

-- 5) nLPD — droit à l'oubli : purge ou anonymisation ciblée ---------------
-- Indépendant de la suppression de compte (deleteMyAccount / cascade FK) :
-- utilisable pour une demande ponctuelle sur un utilisateur qui garde son
-- compte mais demande l'effacement de ses données de tracking analytics.
create or replace function public.purge_user_analytics(_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role::text = 'admin'
  ) then
    raise exception 'Accès refusé.';
  end if;

  delete from public.page_views where user_id = _uid;
  delete from public.therapist_profile_views where viewer_user_id = _uid;
  delete from public.therapist_booking_clicks where viewer_user_id = _uid;
  delete from public.user_sessions where user_id = _uid;
end;
$$;

revoke execute on function public.purge_user_analytics(uuid) from public, anon, authenticated;
grant execute on function public.purge_user_analytics(uuid) to service_role;

-- Anonymise sans supprimer les compteurs : utile pour garder des stats
-- agrégées correctes (volumes) tout en retirant le lien vers l'identité.
-- Les sessions restent liées à un compte par définition (user_id not null) :
-- les "anonymiser" reviendrait à les supprimer, donc on les supprime.
create or replace function public.anonymize_user_analytics(_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role::text = 'admin'
  ) then
    raise exception 'Accès refusé.';
  end if;

  update public.page_views set user_id = null, user_type = null where user_id = _uid;
  update public.therapist_profile_views set viewer_user_id = null, viewer_type = null where viewer_user_id = _uid;
  update public.therapist_booking_clicks set viewer_user_id = null, viewer_type = null where viewer_user_id = _uid;
  delete from public.user_sessions where user_id = _uid;
end;
$$;

revoke execute on function public.anonymize_user_analytics(uuid) from public, anon, authenticated;
grant execute on function public.anonymize_user_analytics(uuid) to service_role;

-- 6) Sweep optionnel : clôturer les sessions inactives depuis 30 min ------
-- Le beacon de fermeture d'onglet (best-effort) et la déconnexion explicite
-- couvrent la majorité des cas ; ce sweep rattrape les onglets fermés sans
-- beacon (crash, mode avion...). Pas branché sur un cron par cette migration
-- — à activer via pg_cron si le besoin de précision se confirme :
--   select cron.schedule('close-stale-sessions', '*/15 * * * *',
--     $$select public.close_stale_sessions()$$);
create or replace function public.close_stale_sessions()
returns void
language sql
security definer
set search_path = public
as $$
  update public.user_sessions
  set ended_at = last_seen_at
  where ended_at is null
    and last_seen_at < now() - interval '30 minutes';
$$;

revoke execute on function public.close_stale_sessions() from public, anon, authenticated;
grant execute on function public.close_stale_sessions() to service_role;
