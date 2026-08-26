-- Badge « Formateur » — direction « Étayé ».
--
-- Déclaratif, jamais vérifié : Holiswiss ne contrôle pas qui forme qui. Le
-- badge suit donc le style « déclaré » des badges de confiance, et ne doit
-- jamais ressembler à une certification validée.
--
-- Le badge n'est affiché que si `is_trainer` est vrai ET `trainer_subjects`
-- est renseigné : cocher sans compléter n'affiche rien. La règle vit dans
-- `buildTrustBadges`, pas ici — la base stocke, elle ne décide pas.
--
-- Idempotent : réexécutable sans effet de bord.

alter table public.therapists
  add column if not exists is_trainer          boolean not null default false,
  add column if not exists trainer_subjects    text,
  add column if not exists trainer_institution text,
  add column if not exists trainer_since       smallint;

-- Année plausible. `not valid` : la contrainte s'applique aux écritures
-- futures sans faire échouer la migration sur d'éventuelles données
-- existantes — il n'y en a pas ici, mais la migration reste rejouable.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.therapists'::regclass
      and conname  = 'therapists_trainer_since_plausible'
  ) then
    alter table public.therapists
      add constraint therapists_trainer_since_plausible
      check (
        trainer_since is null
        or (trainer_since >= 1950 and trainer_since <= extract(year from now())::int + 1)
      ) not valid;
  end if;
end $$;

-- GRANT au niveau colonne — indispensable.
--
-- `anon` n'a PAS de droit sur la table entière : il dispose de droits colonne
-- par colonne. Une colonne neuve n'hérite de rien. C'est exactement l'oubli
-- du 26/08/2026 sur `faq_enabled`, qui renvoyait « permission denied for
-- table therapists » sur toute la fiche publique.
grant select (is_trainer, trainer_subjects, trainer_institution, trainer_since)
  on public.therapists to anon, authenticated;

comment on column public.therapists.is_trainer is
  'Le praticien déclare dispenser des formations. Déclaratif, jamais vérifié par Holiswiss.';
comment on column public.therapists.trainer_subjects is
  'Matières enseignées, en toutes lettres. Le badge public reste masqué tant que ce champ est vide.';
comment on column public.therapists.trainer_institution is
  'École ou organisme où le praticien enseigne. Facultatif.';
comment on column public.therapists.trainer_since is
  'Année depuis laquelle le praticien forme. Facultatif.';