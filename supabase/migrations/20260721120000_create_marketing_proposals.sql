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
  -- Multilingue : caption/hashtags par langue (FR = caption/hashtags par défaut).
  caption text not null,              -- FR
  caption_en text,
  caption_de text,
  caption_it text,
  hashtags text,                      -- FR
  hashtags_en text,
  hashtags_de text,
  hashtags_it text,
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

-- Notifie l'admin (email + WhatsApp via /api/public/admin-notify) à chaque
-- nouvelle proposition à valider. Réutilise notify_admin_event (même mécanisme
-- que les autres événements admin). N'échoue jamais l'insertion (exception avalée).
create or replace function public.trg_notify_marketing_proposal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status = 'en_attente_validation' then
    -- Notification best-effort : ne JAMAIS bloquer la création d'une proposition
    -- si la notif (ou la fonction notify_admin_event) échoue ou n'existe pas.
    begin
      perform public.notify_admin_event(
        'marketing_proposal',
        'Nouvelle proposition marketing à valider',
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

drop trigger if exists notify_marketing_proposal on public.marketing_proposals;
create trigger notify_marketing_proposal
  after insert on public.marketing_proposals
  for each row execute function public.trg_notify_marketing_proposal();
