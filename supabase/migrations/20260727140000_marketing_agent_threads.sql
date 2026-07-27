-- Agent marketing pilotable depuis /admin/marketing : conversations et messages.
-- Admin-only (is_admin), entièrement idempotent.

create table if not exists public.marketing_agent_threads (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Nouvelle demande',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_agent_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.marketing_agent_threads(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  skills_used text[],                       -- compétences mobilisées pour cette réponse
  created_at timestamptz not null default now()
);

create index if not exists marketing_agent_messages_thread_idx
  on public.marketing_agent_messages(thread_id, created_at);
create index if not exists marketing_agent_threads_updated_idx
  on public.marketing_agent_threads(updated_at desc);

alter table public.marketing_agent_threads  enable row level security;
alter table public.marketing_agent_messages enable row level security;

drop policy if exists mat_admin on public.marketing_agent_threads;
create policy mat_admin on public.marketing_agent_threads for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists mam_admin on public.marketing_agent_messages;
create policy mam_admin on public.marketing_agent_messages for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Data API : la RLS reste la barrière réelle. anon n'a aucun accès.
grant select, insert, update, delete
  on public.marketing_agent_threads, public.marketing_agent_messages
  to authenticated, service_role;

notify pgrst, 'reload schema';
