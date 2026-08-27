-- Rendre lisible un import qui n'a rien retenu.
--
-- Constaté le 27/08/2026 en test : le praticien colle le calendrier des jours
-- fériés suisses, la synchronisation réussit, et l'écran annonce
-- « 0 créneau occupé importé ». Rien ne distingue alors :
--   · un flux dont tous les événements sont marqués « ne m'occupe pas » ;
--   · un flux vide ;
--   · une panne silencieuse.
--
-- Or le premier cas est parfaitement normal : ce calendrier contient 325
-- événements, TOUS en `TRANSP:TRANSPARENT` (vérifié) — un jour férié ne rend
-- pas indisponible. Zéro créneau est la bonne réponse ; il manquait seulement
-- de quoi l'expliquer.
--
-- Idempotent.

alter table public.therapist_calendar_sync
  add column if not exists import_last_seen    integer not null default 0,
  add column if not exists import_last_ignored integer not null default 0;

-- `anon` reste exclu de cette table (migration 20260827140000) : les colonnes
-- neuves n'ont donc rien à révoquer, mais `authenticated` doit les voir. Le
-- GRANT au niveau table couvre déjà les colonnes ajoutées ; on le réaffirme
-- pour que la migration soit lisible seule.
grant select, insert, update, delete on public.therapist_calendar_sync to authenticated;

comment on column public.therapist_calendar_sync.import_last_seen is
  'Nombre d''événements rencontrés au dernier import, retenus ou non.';
comment on column public.therapist_calendar_sync.import_last_ignored is
  'Écartés car marqués « ne m''occupe pas » (TRANSP:TRANSPARENT) ou annulés. Un calendrier de jours fériés l''est intégralement.';
