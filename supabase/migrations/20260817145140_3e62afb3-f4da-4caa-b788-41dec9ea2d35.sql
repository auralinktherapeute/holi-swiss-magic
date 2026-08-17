create table if not exists public.therapist_showcase_snapshots (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  score_visibilite integer,
  score_conversion integer,
  completed integer,
  total integer,
  checks jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_showcase_snapshots_therapist_created
  on public.therapist_showcase_snapshots (therapist_id, created_at desc);

grant select on public.therapist_showcase_snapshots to authenticated;
grant all on public.therapist_showcase_snapshots to service_role;

alter table public.therapist_showcase_snapshots enable row level security;

drop policy if exists "showcase_snapshots_owner_read" on public.therapist_showcase_snapshots;
create policy "showcase_snapshots_owner_read"
  on public.therapist_showcase_snapshots for select to authenticated
  using (public.is_therapist_owner(therapist_id) or public.is_admin(auth.uid()));