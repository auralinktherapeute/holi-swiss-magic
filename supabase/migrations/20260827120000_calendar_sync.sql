-- Synchronisation d'agenda — export iCal et import iCal.
--
-- Le praticien choisit : export seul, import seul, les deux, ou rien. Les deux
-- interrupteurs sont indépendants, rien n'est activé par défaut.
--
-- EXPORT  : Holiswiss publie un flux iCal en lecture seule à une URL secrète.
--           L'événement ne porte QUE le prénom et le type de séance — jamais
--           le nom complet, l'e-mail, le téléphone ni les notes. Une URL iCal
--           est un secret porteur : qui la détient lit tout, sans mot de passe,
--           et ces URL fuitent (historique, partage, appareil perdu). Il s'agit
--           de données de santé au sens de la nLPD.
-- IMPORT  : le praticien colle l'URL iCal privée de son agenda personnel ;
--           les périodes occupées bloquent les créneaux Holiswiss.
--
-- Aucune de ces deux tables n'est lisible par `anon` : `export_token` et
-- `import_url` sont des secrets, et `therapist_external_busy` décrit la vie
-- privée du praticien hors Holiswiss.
--
-- Idempotent.

create table if not exists public.therapist_calendar_sync (
  therapist_id            uuid primary key references public.therapists(id) on delete cascade,

  -- Export
  export_enabled          boolean not null default false,
  -- Secret de l'URL du flux. Engendré côté application (crypto), jamais en SQL :
  -- `gen_random_bytes` dépend de pgcrypto, absent de certains projets.
  export_token            text unique,
  export_token_created_at timestamptz,

  -- Import
  import_enabled          boolean not null default false,
  import_url              text,
  import_last_sync_at     timestamptz,
  import_last_status      text,   -- 'ok' | 'error'
  import_last_error       text,
  import_last_count       integer not null default 0,
  -- Récurrences non développées lors du dernier import : remontées au
  -- praticien plutôt que tues. Un créneau manqué est un double booking.
  import_skipped_recurring integer not null default 0,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Périodes occupées importées depuis l'agenda personnel.
--
-- Table distincte de `blocked_periods`, et non un ajout à celle-ci :
-- `blocked_periods` est en JOURS PLEINS (`start_date`/`end_date`) et contient
-- les congés saisis à la main. Y déverser un agenda importé bloquerait des
-- journées entières pour un rendez-vous d'une heure, et mêlerait
-- irrémédiablement ce que le praticien a écrit à ce qui vient du dehors.
create table if not exists public.therapist_external_busy (
  id           uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  uid          text,
  synced_at    timestamptz not null default now(),
  constraint therapist_external_busy_order check (ends_at > starts_at)
);

create index if not exists therapist_external_busy_lookup
  on public.therapist_external_busy (therapist_id, starts_at, ends_at);

alter table public.therapist_calendar_sync  enable row level security;
alter table public.therapist_external_busy  enable row level security;

-- Le praticien gère sa propre configuration. `anon` n'a aucune policy : le
-- flux public est servi par la service-role via le jeton, pas par la Data API.
drop policy if exists "Therapist manages own calendar sync" on public.therapist_calendar_sync;
create policy "Therapist manages own calendar sync"
  on public.therapist_calendar_sync
  for all to authenticated
  using      (therapist_id in (select id from public.therapists where user_id = auth.uid()))
  with check (therapist_id in (select id from public.therapists where user_id = auth.uid()));

-- Lecture seule pour le praticien : les écritures viennent de l'import, en
-- service-role. Rien ne justifie qu'un client insère des créneaux « externes ».
drop policy if exists "Therapist reads own external busy" on public.therapist_external_busy;
create policy "Therapist reads own external busy"
  on public.therapist_external_busy
  for select to authenticated
  using (therapist_id in (select id from public.therapists where user_id = auth.uid()));

-- GRANT au niveau colonne, comme partout ailleurs sur ce projet. `anon` est
-- délibérément absent des deux tables.
grant select, insert, update, delete on public.therapist_calendar_sync to authenticated;
grant select on public.therapist_external_busy to authenticated;

comment on table public.therapist_calendar_sync is
  'Configuration de synchronisation d''agenda. Contient des secrets (export_token, import_url) : jamais exposée à anon.';
comment on column public.therapist_calendar_sync.export_token is
  'Secret porteur présent dans l''URL du flux iCal. Le régénérer invalide immédiatement l''ancien lien.';
comment on table public.therapist_external_busy is
  'Créneaux occupés importés de l''agenda personnel du praticien. Vie privée hors Holiswiss : jamais public.';
