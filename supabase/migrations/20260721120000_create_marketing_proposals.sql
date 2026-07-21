-- Rubrique admin « Marketing / Réseaux sociaux » : propositions de publications
-- produites par l'équipe d'agents marketing, validées manuellement par l'admin.
-- Aucune publication réelle sans passage au statut 'valide' par un admin.
create table if not exists public.marketing_proposals (
  id uuid primary key default gen_random_uuid(),
  proposal_date date not null default current_date,
  network text not null,                 -- instagram | linkedin | tiktok
  pillar text,                           -- preuve_sociale | educatif | demo_outil | marque
  angle text,
  format text,
  caption text not null,
  hashtags text,
  visual_brief text,
  visual_prompt text,
  suggested_time text,                   -- "18:30"
  lang text not null default 'fr',
  status text not null default 'en_attente_validation'
    check (status in ('en_attente_validation','valide','correction_demandee','refuse','publie')),
  correction_note text,                  -- demande de correction de l'admin
  validated_at timestamptz,
  published_at timestamptz,
  external_ref text,                     -- id du post planifié (Postiz) après publication
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketing_proposals enable row level security;

grant select, insert, update on public.marketing_proposals to authenticated;
grant all on public.marketing_proposals to service_role;

drop policy if exists "Admins manage marketing proposals" on public.marketing_proposals;
create policy "Admins manage marketing proposals"
  on public.marketing_proposals for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create index if not exists idx_marketing_proposals_status_date
  on public.marketing_proposals (status, proposal_date desc);
