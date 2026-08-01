-- ============================================================================
-- Marketing — file de sujets soumis + rattrapage de `marketing_proposals`
--
-- Contexte (01/08/2026) :
--   `marketing_proposals` a été écrite en migration le 21/07 mais JAMAIS appliquée
--   en production (qqwud) → /admin/marketing plante au chargement de la liste.
--   Cette migration la crée pour de bon, corrige son trigger de notification, et
--   ajoute `marketing_topics` : la file des sujets soumis à la main pour le
--   lendemain, EN SUPPLÉMENT de la publication programmée.
--
-- Entièrement idempotente : rejouable sans effet de bord.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) marketing_topics — sujets soumis manuellement
-- ----------------------------------------------------------------------------
create table if not exists public.marketing_topics (
  id uuid primary key default gen_random_uuid(),
  subject text not null,                       -- le sujet, en texte libre
  target_date date not null default (current_date + 1),
  network text,                                -- instagram | linkedin | tiktok (libre)
  format text,                                 -- carrousel | reel | post (libre)
  note text,                                   -- consigne complémentaire éventuelle
  status text not null default 'en_attente'
    check (status in ('en_attente','traite','abandonne')),
  reject_reason text,                          -- si l'angle n'a pas atteint 80/100
  submitted_by text not null default 'admin',
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.marketing_topics is
  'File des sujets marketing soumis à la main. Le pipeline quotidien les traite en priorité, en supplément de la publication programmée du jour.';
comment on column public.marketing_topics.reject_reason is
  'Renseigné si le sujet n''a pas atteint le seuil de 80/100 : contient l''angle de repli proposé par le Stratège.';

create index if not exists idx_marketing_topics_pending
  on public.marketing_topics (status, target_date);

-- ----------------------------------------------------------------------------
-- 2) marketing_proposals — création (absente de la prod) + colonnes de liaison
-- ----------------------------------------------------------------------------
create table if not exists public.marketing_proposals (
  id uuid primary key default gen_random_uuid(),
  proposal_date date not null default current_date,
  network text not null,                 -- instagram | linkedin | tiktok
  pillar text,                           -- standard | chaise_en_face | concret_suisse | preuve
  angle text,
  format text,
  caption text not null,                 -- FR
  caption_en text,
  caption_de text,
  caption_it text,
  hashtags text,                         -- FR
  hashtags_en text,
  hashtags_de text,
  hashtags_it text,
  visual_brief text,
  visual_prompt text,
  suggested_time text,                   -- "18:30"
  lang text not null default 'fr',
  status text not null default 'en_attente_validation'
    check (status in ('en_attente_validation','valide','correction_demandee','refuse','publie')),
  correction_note text,
  validated_at timestamptz,
  published_at timestamptz,
  external_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Colonnes ajoutées le 01/08 (et rattrapées si la table préexistait).
alter table public.marketing_proposals
  add column if not exists source text not null default 'programme';
alter table public.marketing_proposals
  add column if not exists topic_id uuid;
alter table public.marketing_proposals
  add column if not exists score integer;

-- Contraintes ajoutées séparément pour rester idempotent.
do $$ begin
  alter table public.marketing_proposals
    add constraint marketing_proposals_source_check
    check (source in ('programme','soumis'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.marketing_proposals
    add constraint marketing_proposals_topic_fk
    foreign key (topic_id) references public.marketing_topics(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.marketing_proposals
    add constraint marketing_proposals_score_check
    check (score is null or (score >= 0 and score <= 100));
exception when duplicate_object then null; end $$;

comment on column public.marketing_proposals.source is
  'programme = publication du calendrier éditorial ; soumis = issue d''un sujet de marketing_topics. Les deux coexistent le même jour.';
comment on column public.marketing_proposals.score is
  'Score /100 du Stratège. Seuil de production : 80.';

create index if not exists idx_marketing_proposals_status_date
  on public.marketing_proposals (status, proposal_date desc);
create index if not exists idx_marketing_proposals_source_date
  on public.marketing_proposals (source, proposal_date desc);

-- ----------------------------------------------------------------------------
-- 3) Droits — sans GRANT explicite, la Data API renvoie une erreur de permission
-- ----------------------------------------------------------------------------
grant select, insert, update on public.marketing_proposals to authenticated;
grant all    on public.marketing_proposals to service_role;
grant select, insert, update on public.marketing_topics    to authenticated;
grant all    on public.marketing_topics    to service_role;

-- ----------------------------------------------------------------------------
-- 4) RLS — admin uniquement, des deux côtés
-- ----------------------------------------------------------------------------
alter table public.marketing_proposals enable row level security;
alter table public.marketing_topics    enable row level security;

drop policy if exists "Admins manage marketing proposals" on public.marketing_proposals;
create policy "Admins manage marketing proposals"
  on public.marketing_proposals for all
  to authenticated
  using      (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admins manage marketing topics" on public.marketing_topics;
create policy "Admins manage marketing topics"
  on public.marketing_topics for all
  to authenticated
  using      (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ----------------------------------------------------------------------------
-- 5) Notification — correction d'un bug silencieux
--
--    L'ancienne version appelait `public.notify_admin_event`, qui n'est définie
--    NULLE PART dans le dépôt. L'exception étant avalée, la notification
--    n'échouait pas : elle ne partait tout simplement jamais. On bascule sur
--    `create_admin_notification`, le mécanisme réellement en service.
-- ----------------------------------------------------------------------------
create or replace function public.trg_notify_marketing_proposal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status = 'en_attente_validation' then
    -- Best-effort : ne JAMAIS bloquer l'insertion si la notification échoue.
    begin
      perform public.create_admin_notification(
        'marketing_proposal',
        case when NEW.source = 'soumis'
             then 'Sujet soumis — proposition à valider'
             else 'Nouvelle proposition marketing à valider' end,
        coalesce(NEW.network, '') || ' — ' || coalesce(NEW.angle, left(NEW.caption, 80)),
        '/admin/marketing'
      );
    exception when others then
      null;
    end;
  end if;
  return NEW;
end;
$$;

-- PostgreSQL accorde EXECUTE à PUBLIC par défaut : une fonction SECURITY DEFINER
-- doit être explicitement révoquée (règle de sécurité du projet).
revoke execute on function public.trg_notify_marketing_proposal() from public, anon, authenticated;

drop trigger if exists notify_marketing_proposal on public.marketing_proposals;
create trigger notify_marketing_proposal
  after insert on public.marketing_proposals
  for each row execute function public.trg_notify_marketing_proposal();
