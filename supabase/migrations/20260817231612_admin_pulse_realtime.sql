-- ═══════════════════════════════════════════════════════════════════════════
-- Cerveau HoliSwiss (/admin/cerveau) — signal temps réel SANS diffusion de PII
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Contexte : `therapists`, `waiting_list` et `appointments` ont été RETIRÉES de
-- la publication `supabase_realtime` (migrations du 18/06/2026, section
-- « Realtime leaks ») parce qu'elles diffusaient des données personnelles à tout
-- client abonné. On ne les y remet pas.
--
-- À la place : une table de SIGNAL anonyme. Chaque écriture métier y dépose une
-- ligne sans aucun contenu — seulement « quelque chose a bougé sur ce nœud ».
-- Le cerveau s'y abonne en Realtime, puis redemande les COMPTEURS agrégés au
-- serveur. Résultat : tout est temps réel, rien de personnel ne transite.
--
-- Idempotent. À appliquer par Lovable.

-- ── 1) Table de signal ─────────────────────────────────────────────────────
create table if not exists public.admin_pulse (
  id           bigint generated always as identity primary key,
  node_id      text        not null,  -- id du nœud dans le graphe du cerveau
  source_table text        not null,
  event        text        not null,  -- INSERT | UPDATE | DELETE
  created_at   timestamptz not null default now()
);

comment on table public.admin_pulse is
  'Signal anonyme pour le cerveau admin (/admin/cerveau). Ne contient jamais de données métier : seulement quel nœud a bougé et quand.';

create index if not exists admin_pulse_created_at_idx
  on public.admin_pulse (created_at desc);

-- ── 2) RLS : lecture réservée aux admins ───────────────────────────────────
alter table public.admin_pulse enable row level security;

drop policy if exists admin_pulse_select_admin on public.admin_pulse;
create policy admin_pulse_select_admin
  on public.admin_pulse
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

revoke all on public.admin_pulse from anon, authenticated;
grant select on public.admin_pulse to authenticated;   -- filtré par la policy ci-dessus
grant all    on public.admin_pulse to service_role;

-- ── 3) Émetteur de signal ──────────────────────────────────────────────────
-- Un dashboard ne doit JAMAIS pouvoir bloquer une écriture métier (inscription
-- d'un thérapeute, dépôt d'un avis…). D'où le trigger AFTER + le bloc EXCEPTION
-- qui avale toute erreur.
create or replace function public.emit_admin_pulse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.admin_pulse (node_id, source_table, event)
    values (tg_argv[0], tg_table_name, tg_op);

    -- Purge opportuniste (~1 écriture sur 100) : le signal ne sert qu'au live.
    if random() < 0.01 then
      delete from public.admin_pulse where created_at < now() - interval '24 hours';
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$$;

-- PostgreSQL vérifie EXECUTE à la CRÉATION du trigger, pas à son exécution :
-- révoquer ici n'empêche pas les triggers ci-dessous de fonctionner.
revoke execute on function public.emit_admin_pulse() from public, anon, authenticated;
grant  execute on function public.emit_admin_pulse() to service_role;

-- ── 4) Branchement sur les tables suivies ──────────────────────────────────
-- `to_regclass` : une table absente est ignorée au lieu de faire échouer la migration.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('therapists',          'routes_admin_therapeutes_tsx'),
      ('waiting_list',        'routes_admin_liste_attente_tsx'),
      ('reviews',             'routes_admin_avis_tsx'),
      ('articles',            'routes_admin_articles_tsx'),
      ('events',              'routes_admin_evenements_tsx'),
      ('notifications',       'routes_admin_notifications_tsx'),
      ('delegation_requests', 'routes_admin_delegation_tsx'),
      ('ai_agent_logs',       'routes_admin_agents_tsx'),
      ('crm_leads',           'routes_admin_crm_tsx'),
      ('therapist_articles',  'routes_admin_paroles_tsx')
    ) as v(tbl, node)
  loop
    if to_regclass('public.' || t.tbl) is not null then
      execute format('drop trigger if exists trg_admin_pulse on public.%I', t.tbl);
      execute format(
        'create trigger trg_admin_pulse
           after insert or update or delete on public.%I
           for each row execute function public.emit_admin_pulse(%L)',
        t.tbl, t.node);
    end if;
  end loop;
end $$;

-- ── 5) Publication Realtime — la table de signal UNIQUEMENT ────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_pulse'
  ) then
    alter publication supabase_realtime add table public.admin_pulse;
  end if;
end $$;
