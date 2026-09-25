-- content_updated_at : date de la dernière modification ÉDITORIALE.
--
-- Pourquoi : `updated_at` est remis à now() par update_updated_at_column à CHAQUE
-- UPDATE (traductions automatiques, compteur de factures, newsletter, backfills…).
-- Au 25/09/2026, les 11 fiches publiques ont toutes updated_at = 25/09/2026 :
-- « Mis à jour le … » n'est donc pas sincère. Cette colonne n'avance QUE lorsque
-- le contenu visible change.
--
-- Colonnes éditoriales (comparaison NULL-safe par IS DISTINCT FROM) :
--   therapists          : bio, specialties, price_min, price_max, currency
--   articles            : body_fr, body_de, body_it, body_en
--   therapist_articles  : contenu
-- Pour élargir la liste plus tard : nouvelle migration qui remplace la fonction
-- (CREATE OR REPLACE) — pas de backfill à refaire.
--
-- Règles posées par les triggers (BEFORE INSERT OR UPDATE, SECURITY INVOKER) :
--   * UPDATE : colonne éditoriale modifiée -> now() ; sinon -> OLD.content_updated_at.
--     Écrire directement content_updated_at ne sert à rien, quel que soit le rôle
--     (ni avancer ni reculer la date). Correction manuelle = migration qui désactive
--     le trigger le temps de l'UPDATE, comme le backfill ci-dessous.
--   * INSERT : la création est une modification éditoriale -> now().
--     Seuls les rôles serveur (service_role, postgres, supabase_admin) peuvent
--     fournir une date explicite (import d'archives) ; NULL -> now().
--     anon / authenticated -> toujours now() (un thérapeute ne peut pas antidater
--     ni postdater un article qu'il crée).
--   * Nom préfixé « zz_ » : les triggers BEFORE s'exécutent par ordre alphabétique ;
--     celui-ci passe en DERNIER, il voit donc les valeurs finales de NEW et aucun
--     autre trigger ne peut réécrire la date après lui. Aucun trigger existant ne
--     touche aux colonnes éditoriales ni à content_updated_at (vérifié le 25/09/2026).
--
-- Reprise des données (backfill) — JAMAIS updated_at :
--   therapists         -> created_at
--   articles           -> coalesce(published_at, created_at)
--   therapist_articles -> coalesce(date_publication, created_at)
--   Fait AVANT la création des triggers, et en désactivant le temps de l'UPDATE les
--   triggers UPDATE activés de la table (dont update_updated_at_column) : le backfill
--   ne fait donc PAS avancer updated_at, et ne déclenche aucun effet de bord
--   (notifications, synchros). Le bloc DO est atomique : en cas d'erreur, la
--   désactivation est annulée avec le reste. L'état d'origine de chaque trigger
--   (O / A / R) est restauré à l'identique ; un trigger déjà désactivé le reste.
--   Ne remplit que les lignes où content_updated_at IS NULL.
--
-- Idempotent : rejouable sans erreur ni modification de données.
-- À appliquer via Lovable (prod qqwudmnfavvaukuldulr).

-- 1. Colonnes (sans DEFAULT à ce stade : un DEFAULT now() remplirait toutes les
--    lignes existantes avec la date du jour, précisément ce qu'on veut éviter).
alter table public.therapists         add column if not exists content_updated_at timestamptz;
alter table public.articles           add column if not exists content_updated_at timestamptz;
alter table public.therapist_articles add column if not exists content_updated_at timestamptz;

-- 2. Backfill, triggers UPDATE neutralisés le temps de l'opération.
do $$
declare
  spec   record;
  trg    record;
  saved  text[];
  names  text[];
  i      int;
  todo   boolean;
begin
  for spec in
    select * from (values
      ('therapists',         'created_at'),
      ('articles',           'coalesce(published_at, created_at)'),
      ('therapist_articles', 'coalesce(date_publication, created_at)')
    ) as v(tbl, expr)
  loop
    execute format('select exists (select 1 from public.%I where content_updated_at is null)', spec.tbl)
      into todo;
    continue when not todo;

    -- Triggers utilisateur activés qui se déclenchent sur UPDATE (bit 16 de tgtype).
    names := array[]::text[];
    saved := array[]::text[];
    for trg in
      select t.tgname, t.tgenabled
      from pg_trigger t
      where t.tgrelid = format('public.%I', spec.tbl)::regclass
        and not t.tgisinternal
        and t.tgenabled <> 'D'
        and (t.tgtype & 16) <> 0
    loop
      names := names || trg.tgname::text;
      saved := saved || trg.tgenabled::text;
      execute format('alter table public.%I disable trigger %I', spec.tbl, trg.tgname);
    end loop;

    execute format(
      'update public.%I set content_updated_at = %s where content_updated_at is null',
      spec.tbl, spec.expr);

    for i in 1 .. coalesce(array_length(names, 1), 0) loop
      execute format('alter table public.%I enable %s trigger %I',
        spec.tbl,
        case saved[i] when 'A' then 'always' when 'R' then 'replica' else '' end,
        names[i]);
    end loop;
  end loop;
end $$;

-- 3. Défaut et contrainte (toutes les lignes sont remplies : created_at est NOT NULL
--    sur les trois tables).
alter table public.therapists         alter column content_updated_at set default now();
alter table public.articles           alter column content_updated_at set default now();
alter table public.therapist_articles alter column content_updated_at set default now();
alter table public.therapists         alter column content_updated_at set not null;
alter table public.articles           alter column content_updated_at set not null;
alter table public.therapist_articles alter column content_updated_at set not null;

-- 4. Fonctions trigger (SECURITY INVOKER : elles ne lisent que NEW/OLD).
create or replace function public.therapists_set_content_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if current_user in ('service_role', 'postgres', 'supabase_admin') then
      new.content_updated_at := coalesce(new.content_updated_at, now());
    else
      new.content_updated_at := now();
    end if;
  elsif new.bio         is distinct from old.bio
     or new.specialties is distinct from old.specialties
     or new.price_min   is distinct from old.price_min
     or new.price_max   is distinct from old.price_max
     or new.currency    is distinct from old.currency then
    new.content_updated_at := now();
  else
    new.content_updated_at := old.content_updated_at;
  end if;
  return new;
end;
$$;

create or replace function public.articles_set_content_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if current_user in ('service_role', 'postgres', 'supabase_admin') then
      new.content_updated_at := coalesce(new.content_updated_at, now());
    else
      new.content_updated_at := now();
    end if;
  elsif new.body_fr is distinct from old.body_fr
     or new.body_de is distinct from old.body_de
     or new.body_it is distinct from old.body_it
     or new.body_en is distinct from old.body_en then
    new.content_updated_at := now();
  else
    new.content_updated_at := old.content_updated_at;
  end if;
  return new;
end;
$$;

create or replace function public.therapist_articles_set_content_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if current_user in ('service_role', 'postgres', 'supabase_admin') then
      new.content_updated_at := coalesce(new.content_updated_at, now());
    else
      new.content_updated_at := now();
    end if;
  elsif new.contenu is distinct from old.contenu then
    new.content_updated_at := now();
  else
    new.content_updated_at := old.content_updated_at;
  end if;
  return new;
end;
$$;

-- Réflexe du dépôt (20260816224910) : fonctions trigger non exposées.
revoke execute on function public.therapists_set_content_updated_at()         from public, anon, authenticated;
revoke execute on function public.articles_set_content_updated_at()           from public, anon, authenticated;
revoke execute on function public.therapist_articles_set_content_updated_at() from public, anon, authenticated;
grant  execute on function public.therapists_set_content_updated_at()         to service_role;
grant  execute on function public.articles_set_content_updated_at()           to service_role;
grant  execute on function public.therapist_articles_set_content_updated_at() to service_role;

-- 5. Triggers (créés APRÈS le backfill).
drop trigger if exists zz_therapists_content_updated_at on public.therapists;
create trigger zz_therapists_content_updated_at
  before insert or update on public.therapists
  for each row execute function public.therapists_set_content_updated_at();

drop trigger if exists zz_articles_content_updated_at on public.articles;
create trigger zz_articles_content_updated_at
  before insert or update on public.articles
  for each row execute function public.articles_set_content_updated_at();

drop trigger if exists zz_therapist_articles_content_updated_at on public.therapist_articles;
create trigger zz_therapist_articles_content_updated_at
  before insert or update on public.therapist_articles
  for each row execute function public.therapist_articles_set_content_updated_at();

-- 6. Droits. therapists : SELECT accordé colonne par colonne à anon/authenticated
--    -> GRANT indispensable (sinon « permission denied for table therapists » sur
--    toute la fiche). articles / therapist_articles : SELECT au niveau table, le
--    GRANT colonne est redondant mais explicite. AUCUN UPDATE accordé : sur
--    therapists, authenticated n'a d'UPDATE que sur une liste de colonnes figée
--    (20260817174909) qui n'inclut pas celle-ci ; sur articles/therapist_articles,
--    l'UPDATE de table d'authenticated couvre la colonne, mais le trigger la
--    réécrit avec OLD.
grant select (content_updated_at) on public.therapists         to anon, authenticated;
grant select (content_updated_at) on public.articles           to anon, authenticated;
grant select (content_updated_at) on public.therapist_articles to anon, authenticated;

notify pgrst, 'reload schema';
