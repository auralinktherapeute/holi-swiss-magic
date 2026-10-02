-- Agent Automation — phase 0 : fondation (additive, idempotente).
-- Aucune donnée insérée. Réglage global `automation_enabled` (app_settings) absent = désactivé.

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  action_key text not null unique,
  level text not null default 'observe'
    check (level in ('observe','recommend','prepare','execute_validated','automate')),
  enabled boolean not null default false,
  limits jsonb not null default '{}'::jsonb,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_proposals (
  id uuid primary key default gen_random_uuid(),
  action_key text not null,
  source_table text,
  source_id text,
  title text not null,
  rationale text,
  payload jsonb not null default '{}'::jsonb,
  prepared_preview jsonb,
  level text not null default 'recommend'
    check (level in ('observe','recommend','prepare','execute_validated','automate')),
  status text not null default 'open'
    check (status in ('open','snoozed','reanalysis_requested','modified','accepted','ignored','expired')),
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists automation_proposals_status_idx on public.automation_proposals (status, created_at desc);
create index if not exists automation_proposals_action_idx on public.automation_proposals (action_key);
create unique index if not exists automation_proposals_source_open_uidx
  on public.automation_proposals (action_key, source_table, source_id)
  where status in ('open','snoozed','reanalysis_requested','modified') and source_id is not null;

create table if not exists public.automation_decisions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.automation_proposals(id) on delete restrict,
  decision text not null check (decision in ('ignore','snooze','reanalyze','modify','accept')),
  reason text,
  modified_payload jsonb,
  snooze_until timestamptz,
  decided_by uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists automation_decisions_proposal_idx on public.automation_decisions (proposal_id, created_at desc);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.automation_proposals(id) on delete restrict,
  decision_id uuid references public.automation_decisions(id) on delete restrict,
  action_key text not null,
  level text not null check (level in ('observe','recommend','prepare','execute_validated','automate')),
  status text not null check (status in ('succeeded','failed','rolled_back')),
  before_state jsonb,
  after_state jsonb,
  rollback_payload jsonb,
  error text,
  executed_by uuid,
  rolled_back_at timestamptz,
  rolled_back_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists automation_runs_created_idx on public.automation_runs (created_at desc);
create index if not exists automation_runs_action_idx on public.automation_runs (action_key);

create table if not exists public.automation_outcomes (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.automation_runs(id) on delete restrict,
  metric text not null,
  value numeric,
  polarity text not null check (polarity in ('positive','negative','neutral')),
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists automation_outcomes_run_idx on public.automation_outcomes (run_id);

create or replace function public.automation_rules_human_only()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'automation_rules: modification réservée à un administrateur humain authentifié';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'automation_rules: suppression interdite (désactiver la règle)';
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists automation_rules_human_only on public.automation_rules;
create trigger automation_rules_human_only
  before insert or update or delete on public.automation_rules
  for each row execute function public.automation_rules_human_only();

create or replace function public.automation_append_only()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    raise exception '%: journal append-only, suppression interdite', tg_table_name;
  end if;
  if tg_table_name = 'automation_runs'
     and old.rolled_back_at is null and new.rolled_back_at is not null
     and new.status = 'rolled_back'
     and (to_jsonb(new) - array['rolled_back_at','rolled_back_by','status'])
       = (to_jsonb(old) - array['rolled_back_at','rolled_back_by','status']) then
    return new;
  end if;
  raise exception '%: journal append-only, modification interdite', tg_table_name;
end $$;

drop trigger if exists automation_runs_append_only on public.automation_runs;
create trigger automation_runs_append_only
  before update or delete on public.automation_runs
  for each row execute function public.automation_append_only();

drop trigger if exists automation_decisions_append_only on public.automation_decisions;
create trigger automation_decisions_append_only
  before update or delete on public.automation_decisions
  for each row execute function public.automation_append_only();

drop trigger if exists automation_outcomes_append_only on public.automation_outcomes;
create trigger automation_outcomes_append_only
  before update or delete on public.automation_outcomes
  for each row execute function public.automation_append_only();

revoke execute on function public.automation_rules_human_only() from public, anon;
revoke execute on function public.automation_append_only() from public, anon;

grant select, insert, update on public.automation_rules to authenticated;
grant select, update on public.automation_proposals to authenticated;
grant select, insert on public.automation_decisions to authenticated;
grant select on public.automation_runs to authenticated;
grant select on public.automation_outcomes to authenticated;
grant all on public.automation_rules, public.automation_proposals, public.automation_decisions,
  public.automation_runs, public.automation_outcomes to service_role;

alter table public.automation_rules enable row level security;
alter table public.automation_proposals enable row level security;
alter table public.automation_decisions enable row level security;
alter table public.automation_runs enable row level security;
alter table public.automation_outcomes enable row level security;

drop policy if exists "automation_rules admin read" on public.automation_rules;
create policy "automation_rules admin read" on public.automation_rules
  for select to authenticated using (public.is_admin(auth.uid()));
drop policy if exists "automation_rules admin insert" on public.automation_rules;
create policy "automation_rules admin insert" on public.automation_rules
  for insert to authenticated with check (public.is_admin(auth.uid()));
drop policy if exists "automation_rules admin update" on public.automation_rules;
create policy "automation_rules admin update" on public.automation_rules
  for update to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "automation_proposals admin read" on public.automation_proposals;
create policy "automation_proposals admin read" on public.automation_proposals
  for select to authenticated using (public.is_admin(auth.uid()));
drop policy if exists "automation_proposals admin update" on public.automation_proposals;
create policy "automation_proposals admin update" on public.automation_proposals
  for update to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "automation_decisions admin read" on public.automation_decisions;
create policy "automation_decisions admin read" on public.automation_decisions
  for select to authenticated using (public.is_admin(auth.uid()));
drop policy if exists "automation_decisions admin insert" on public.automation_decisions;
create policy "automation_decisions admin insert" on public.automation_decisions
  for insert to authenticated with check (public.is_admin(auth.uid()) and decided_by = auth.uid());

drop policy if exists "automation_runs admin read" on public.automation_runs;
create policy "automation_runs admin read" on public.automation_runs
  for select to authenticated using (public.is_admin(auth.uid()));

drop policy if exists "automation_outcomes admin read" on public.automation_outcomes;
create policy "automation_outcomes admin read" on public.automation_outcomes
  for select to authenticated using (public.is_admin(auth.uid()));
