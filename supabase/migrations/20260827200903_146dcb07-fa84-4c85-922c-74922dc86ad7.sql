create table if not exists public.featured_therapist (
  id integer primary key default 1 check (id = 1),
  therapist_id uuid references public.therapists(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

grant select on public.featured_therapist to anon, authenticated;
grant all on public.featured_therapist to service_role;

alter table public.featured_therapist enable row level security;

drop policy if exists featured_therapist_public_read on public.featured_therapist;
create policy featured_therapist_public_read
  on public.featured_therapist
  for select
  to anon, authenticated
  using (true);

insert into public.featured_therapist (id, therapist_id)
values (1, null)
on conflict (id) do nothing;