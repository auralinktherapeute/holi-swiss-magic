-- ============================================================================
-- Marketing — file de sujets soumis + rattrapage de `marketing_proposals`
-- Entièrement idempotente : rejouable sans effet de bord.
-- ============================================================================

create table if not exists public.marketing_topics (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  target_date date not null default (current_date + 1),
  network text,
  format text,
  note text,
  status text not null default 'en_attente'
    check (status in ('en_attente','traite','abandonne')),
  reject_reason text,
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

create table if not exists public.marketing_proposals (
  id uuid primary key default gen_random_uuid(),
  proposal_date date not null default current_date,
  network text not null,
  pillar text,
  angle text,
  format text,
  caption text not null,
  caption_en text,
  caption_de text,
  caption_it text,
  hashtags text,
  hashtags_en text,
  hashtags_de text,
  hashtags_it text,
  visual_brief text,
  visual_prompt text,
  suggested_time text,
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

alter table public.marketing_proposals
  add column if not exists source text not null default 'programme';
alter table public.marketing_proposals
  add column if not exists topic_id uuid;
alter table public.marketing_proposals
  add column if not exists score integer;

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
  'programme = publication du calendrier éditorial ; soumis = issue d''un sujet de marketing_topics.';
comment on column public.marketing_proposals.score is
  'Score /100 du Stratège. Seuil de production : 80.';

create index if not exists idx_marketing_proposals_status_date
  on public.marketing_proposals (status, proposal_date desc);
create index if not exists idx_marketing_proposals_source_date
  on public.marketing_proposals (source, proposal_date desc);

grant select, insert, update on public.marketing_proposals to authenticated;
grant all    on public.marketing_proposals to service_role;
grant select, insert, update on public.marketing_topics    to authenticated;
grant all    on public.marketing_topics    to service_role;

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

create or replace function public.trg_notify_marketing_proposal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status = 'en_attente_validation' then
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

revoke execute on function public.trg_notify_marketing_proposal() from public, anon, authenticated;

drop trigger if exists notify_marketing_proposal on public.marketing_proposals;
create trigger notify_marketing_proposal
  after insert on public.marketing_proposals
  for each row execute function public.trg_notify_marketing_proposal();