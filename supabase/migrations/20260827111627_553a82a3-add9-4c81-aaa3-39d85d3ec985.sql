-- Retire à `anon` l'accès aux deux tables de synchronisation d'agenda.
--
-- Pourquoi c'était nécessaire alors que la migration précédente n'accordait
-- rien à `anon` : Supabase pose des `ALTER DEFAULT PRIVILEGES` sur le schéma
-- `public`, si bien que toute table CRÉÉE ENSUITE hérite automatiquement du
-- `SELECT` pour `anon` et `authenticated`. Ne rien accorder ne suffit donc pas
-- — il faut révoquer.
--
-- Constaté le 27/08/2026 sur la Data API de production :
--   appointments            → 401 (42501)  « Grant the required privileges »
--   therapist_calendar_sync → 200 []
--   therapist_external_busy → 200 []
-- Un tableau vide et non une erreur : `anon` avait bien le droit de lire, et
-- seule la RLS écartait les lignes. La table était vide, ce qui rendait le
-- symptôme indiscernable d'une vraie protection.
--
-- Ces deux tables ne tolèrent pas une protection à une seule couche :
-- `export_token` ouvre l'agenda d'un praticien sans mot de passe, et
-- `import_url` est l'adresse privée de son agenda personnel. Une policy posée
-- trop large un jour, ou une RLS désactivée le temps d'un débogage, suffirait.
--
-- Idempotent.

revoke all on public.therapist_calendar_sync from anon;
revoke all on public.therapist_external_busy from anon;

-- Le praticien connecté conserve exactement ce que la migration précédente
-- lui donnait : la RLS restreint ensuite aux lignes qui le concernent.
grant select, insert, update, delete on public.therapist_calendar_sync to authenticated;
grant select on public.therapist_external_busy to authenticated;

-- NOTE — décision volontairement NON prise ici.
--
-- La cause de fond est le `ALTER DEFAULT PRIVILEGES` du schéma `public`, qui
-- accorde `anon` à toute table future. Le corriger d'un
--   alter default privileges in schema public revoke all on tables from anon;
-- protégerait tout ce qui viendra — mais changerait le comportement du schéma
-- entier, y compris pour les tables que Lovable crée de son côté, sans qu'on
-- puisse l'éprouver ailleurs qu'en production. Cette migration se limite donc
-- aux deux tables concernées ; le durcissement global reste à arbitrer.