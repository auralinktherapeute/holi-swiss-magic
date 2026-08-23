create table if not exists public.therapist_families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

grant select on public.therapist_families to anon, authenticated;
grant all on public.therapist_families to service_role;
alter table public.therapist_families enable row level security;

drop policy if exists "families_readable" on public.therapist_families;
create policy "families_readable" on public.therapist_families
  for select to anon, authenticated using (true);

drop policy if exists "families_admin_write" on public.therapist_families;
create policy "families_admin_write" on public.therapist_families
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

insert into public.therapist_families (name, slug, description, sort_order) values
  ('Médecines naturelles', 'medecines-naturelles', 'Naturopathie, phytothérapie, aromathérapie, homéopathie.', 1),
  ('Thérapies manuelles & corporelles', 'therapies-manuelles', 'Massages thérapeutiques, ostéopathie, réflexologie, fasciathérapie.', 2),
  ('Énergétique & soins vibratoires', 'energetique', 'Reiki, magnétisme, soins quantiques, lithothérapie.', 3),
  ('Psychothérapies & accompagnement psychique', 'psychotherapies', 'Approches humanistes, analytiques, systémiques, TCC.', 4),
  ('Hypnose & thérapies brèves', 'hypnose-therapies-breves', 'Hypnose ericksonienne, PNL, EFT, EMDR.', 5),
  ('Coaching & développement personnel', 'coaching-developpement', 'Coaching de vie, professionnel, bilan et transitions.', 6),
  ('Nutrition & micronutrition', 'nutrition', 'Diététique, micronutrition, jeûne accompagné, hygiène de vie.', 7),
  ('Mouvement, yoga & respiration', 'mouvement-yoga', 'Yoga, qi gong, sophrologie, cohérence cardiaque, pilates.', 8),
  ('Arts-thérapies & expression créative', 'arts-therapies', 'Art-thérapie, musicothérapie, danse-thérapie, écriture.', 9),
  ('Périnatalité, famille & enfance', 'perinatalite-famille', 'Accompagnement périnatal, parentalité, enfance et adolescence.', 10)
on conflict (slug) do nothing;

create or replace function public.is_verified_therapist(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.therapists t
    where t.user_id = _uid and t.verified = true and t.status = 'active'
  );
$$;
grant execute on function public.is_verified_therapist(uuid) to authenticated, service_role;

create table if not exists public.charter_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.therapist_families(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  charter_version text not null default 'v1',
  unique (user_id, family_id)
);

grant select, insert, delete on public.charter_acceptances to authenticated;
grant all on public.charter_acceptances to service_role;
alter table public.charter_acceptances enable row level security;

drop policy if exists "therapists_can_view_charter_acceptances" on public.charter_acceptances;
create policy "therapists_can_view_charter_acceptances" on public.charter_acceptances
  for select to authenticated
  using (public.is_verified_therapist(auth.uid()) or public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "therapists_can_accept_charter" on public.charter_acceptances;
create policy "therapists_can_accept_charter" on public.charter_acceptances
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_verified_therapist(auth.uid()));

drop policy if exists "users_can_revoke_own_charter" on public.charter_acceptances;
create policy "users_can_revoke_own_charter" on public.charter_acceptances
  for delete to authenticated using (user_id = auth.uid());

create table if not exists public.user_sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid references public.therapist_families(id) on delete set null,
  kind text not null check (kind in ('warning','suspension','ban')),
  reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

grant select on public.user_sanctions to authenticated;
grant all on public.user_sanctions to service_role;
alter table public.user_sanctions enable row level security;

drop policy if exists "sanctions_owner_or_admin_select" on public.user_sanctions;
create policy "sanctions_owner_or_admin_select" on public.user_sanctions
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "sanctions_admin_write" on public.user_sanctions;
create policy "sanctions_admin_write" on public.user_sanctions
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

create or replace function public.community_is_muted(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_sanctions s
    where s.user_id = _uid
      and s.kind in ('suspension','ban')
      and (s.expires_at is null or s.expires_at > now())
  );
$$;
grant execute on function public.community_is_muted(uuid) to authenticated, service_role;

create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.therapist_families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  is_flagged boolean not null default false,
  flagged_reason text,
  moderation_severity text,
  moderated_at timestamptz
);

create index if not exists idx_community_messages_family on public.community_messages (family_id, created_at desc);
create index if not exists idx_community_messages_user on public.community_messages (user_id);
create index if not exists idx_charter_acceptances_user_family on public.charter_acceptances (user_id, family_id);

grant select, insert, update, delete on public.community_messages to authenticated;
grant all on public.community_messages to service_role;
alter table public.community_messages enable row level security;

drop policy if exists "therapists_can_view_messages" on public.community_messages;
create policy "therapists_can_view_messages" on public.community_messages
  for select to authenticated
  using (public.is_verified_therapist(auth.uid()) or public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "therapists_with_charter_can_insert" on public.community_messages;
create policy "therapists_with_charter_can_insert" on public.community_messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_verified_therapist(auth.uid())
    and not public.community_is_muted(auth.uid())
    and exists (
      select 1 from public.charter_acceptances ca
      where ca.user_id = auth.uid() and ca.family_id = community_messages.family_id
    )
  );

drop policy if exists "users_can_update_own_messages" on public.community_messages;
create policy "users_can_update_own_messages" on public.community_messages
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users_can_delete_own_messages" on public.community_messages;
create policy "users_can_delete_own_messages" on public.community_messages
  for delete to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "admins_can_update_messages" on public.community_messages;
create policy "admins_can_update_messages" on public.community_messages
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

create or replace function public.community_messages_lock_moderation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin'::app_role) then
    new.is_flagged := old.is_flagged;
    new.flagged_reason := old.flagged_reason;
    new.moderation_severity := old.moderation_severity;
    new.moderated_at := old.moderated_at;
    new.user_id := old.user_id;
    new.family_id := old.family_id;
    new.created_at := old.created_at;
    if new.content is distinct from old.content then
      new.edited_at := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_community_messages_lock_moderation on public.community_messages;
create trigger trg_community_messages_lock_moderation
  before update on public.community_messages
  for each row execute function public.community_messages_lock_moderation();

create table if not exists public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.community_messages(id) on delete cascade,
  user_id uuid,
  family_id uuid references public.therapist_families(id) on delete set null,
  severity text not null default 'infraction',
  rule text,
  excerpt text,
  report_md text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

grant select on public.moderation_reports to authenticated;
grant all on public.moderation_reports to service_role;
alter table public.moderation_reports enable row level security;

drop policy if exists "reports_admin_only" on public.moderation_reports;
create policy "reports_admin_only" on public.moderation_reports
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'community_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.community_messages';
  end if;
end $$;

insert into public.app_settings (key, value)
values ('moderation_agent_secret', to_jsonb(gen_random_uuid()::text))
on conflict (key) do nothing;

insert into public.app_settings (key, value)
values ('moderation_endpoint', to_jsonb('https://project--2c2ca56b-598e-4651-bc14-8ba533771ae9.lovable.app/api/public/moderate-message'::text))
on conflict (key) do nothing;

create or replace function public.notify_moderator_agent()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_endpoint text;
  v_secret text;
begin
  select value #>> '{}' into v_endpoint from public.app_settings where key = 'moderation_endpoint';
  select value #>> '{}' into v_secret from public.app_settings where key = 'moderation_agent_secret';
  if v_endpoint is null then
    return new;
  end if;
  begin
    perform net.http_post(
      url := v_endpoint,
      headers := jsonb_build_object('Content-Type','application/json','x-moderation-secret', coalesce(v_secret,'')),
      body := jsonb_build_object(
        'message_id', new.id,
        'content', new.content,
        'user_id', new.user_id,
        'family_id', new.family_id
      )
    );
  exception when others then
    raise warning 'moderate-message: mise en file impossible pour % : %', new.id, sqlerrm;
  end;
  return new;
end $$;

revoke execute on function public.notify_moderator_agent() from public, anon, authenticated;

drop trigger if exists trigger_moderate_new_message on public.community_messages;
create trigger trigger_moderate_new_message
  after insert on public.community_messages
  for each row execute function public.notify_moderator_agent();