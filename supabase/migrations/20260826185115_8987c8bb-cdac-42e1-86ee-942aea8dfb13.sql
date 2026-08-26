-- ============================================================================
-- FAQ du profil public thérapeute
--
-- Chaque praticien peut publier quelques questions-réponses sur sa fiche.
-- Rien n'est activé d'office : `faq_enabled` vaut false, et le rendu public
-- exige EN PLUS au moins une entrée active — une FAQ activée mais vide ne
-- s'affiche pas.
--
-- L'interrupteur vit sur `therapists` plutôt que dans une table de réglages :
-- la fiche publique lit déjà cette table (via la vue `therapists_public`), donc
-- aucune jointure supplémentaire n'est nécessaire pour savoir s'il faut
-- interroger la FAQ.
--
-- MONOLINGUE — choix délibéré (Gérald, 26/08/2026)
--   Pas de question_de / answer_it : la FAQ s'affiche dans les quatre langues
--   telle que le praticien l'a écrite, comme sa bio. C'est cohérent avec la
--   règle actée la veille — une fiche n'est indexable que dans sa langue de
--   rédaction, faute de traduction (voir 25/08). Et c'est réaliste : quatre
--   thérapeutes sur neuf n'ont pas encore de bio, leur en demander quatre
--   versions garantirait des FAQ vides.
--   Revenir dessus coûterait une seconde migration et un éditeur à 4 onglets.
--
-- Idempotente. À appliquer via Lovable.
-- ============================================================================

alter table public.therapists
  add column if not exists faq_enabled boolean not null default false;

comment on column public.therapists.faq_enabled is
  'Le praticien a choisi d''afficher sa FAQ sur sa fiche publique. La section reste masquée tant qu''aucune entrée active n''existe.';

create table if not exists public.therapist_faqs (
  id           uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  question     text not null,
  answer       text not null,
  position     integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint therapist_faqs_question_len check (char_length(trim(question)) between 3 and 200),
  constraint therapist_faqs_answer_len   check (char_length(trim(answer))   between 3 and 2000)
);

comment on table public.therapist_faqs is
  'Questions-réponses publiées par un thérapeute sur sa fiche. Contenu destiné à être public : n''y placer aucune donnée personnelle de patient.';

create index if not exists therapist_faqs_owner_idx
  on public.therapist_faqs (therapist_id, position);

-- `updated_at` : on réutilise le trigger générique du projet s'il existe.
do $$
begin
  if to_regprocedure('public.update_updated_at_column()') is not null then
    drop trigger if exists therapist_faqs_set_updated_at on public.therapist_faqs;
    create trigger therapist_faqs_set_updated_at
      before update on public.therapist_faqs
      for each row execute function public.update_updated_at_column();
  else
    raise notice 'update_updated_at_column() absente : updated_at restera à la charge du code applicatif.';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- RLS — calquée sur `availabilities`, la table possédée la plus proche
-- ----------------------------------------------------------------------------
alter table public.therapist_faqs enable row level security;

-- Lecture publique : trois conditions cumulatives. L'entrée est active, le
-- praticien a activé sa FAQ, et sa fiche est elle-même active.
drop policy if exists "Public read active faqs" on public.therapist_faqs;
create policy "Public read active faqs"
  on public.therapist_faqs
  for select
  to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1 from public.therapists t
      where t.id = therapist_faqs.therapist_id
        and t.status = 'active'
        and t.faq_enabled = true
    )
  );

-- Écriture : strictement le propriétaire. Motif identique à
-- « Therapist manage availabilities ».
drop policy if exists "Therapist manage own faqs" on public.therapist_faqs;
create policy "Therapist manage own faqs"
  on public.therapist_faqs
  for all
  to authenticated
  using      (therapist_id in (select id from public.therapists where user_id = auth.uid()))
  with check (therapist_id in (select id from public.therapists where user_id = auth.uid()));

grant select on public.therapist_faqs to anon, authenticated;
grant insert, update, delete on public.therapist_faqs to authenticated;

-- ⚠️ La policy de lecture traverse `therapists`, dont la policy appelle
-- has_role(). Si la FAQ se vidait un jour sans explication, vérifier d'abord que
-- `anon` a toujours EXECUTE sur public.has_role — c'est ce qui avait vidé toute
-- la couche spécialité le 25/08/2026 (migration 20260825120000).