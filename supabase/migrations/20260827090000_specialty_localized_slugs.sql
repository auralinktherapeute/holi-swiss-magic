-- Slugs de spécialité localisés — `slug_it` et `slug_en`.
--
-- État avant : seule `slug_de` existait, et remplie pour 17 spécialités sur 31.
-- Conséquence en production : `specialtySlugForLang` retombait sur `slug` (le
-- slug FRANÇAIS) pour l'anglais et l'italien, d'où des URL comme
-- `/en/specialites/coaching-de-vie/payerne`.
--
-- `slug_fr` n'est délibérément PAS créée : le slug de base EST le slug
-- français — vérifié sur les 31 lignes, zéro différence. Une colonne de plus
-- serait une seconde source de vérité à tenir synchronisée, pour rien.
--
-- Moment choisi : aucune de ces URL n'est indexée (Search Console, 27/08/2026 :
-- « URL is unknown to Google », `last_crawl` nul). Le changement ne déplace donc
-- aucune URL publiée et n'appelle aucune redirection. Ce ne sera plus vrai
-- longtemps.
--
-- Idempotent.

alter table public.specialties
  add column if not exists slug_it text,
  add column if not exists slug_en text;

-- Slugification identique à `public.city_slug()` (migration du 25/08) et au
-- `cityToSlug` TypeScript : NFD puis retrait des diacritiques.
--
-- `translate()` est proscrit ici : il opère sur les OCTETS hors UTF-8 et
-- transformait « Genève » en `genaive` (bug du 25/08/2026).
create or replace function public.specialty_slug(_input text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select nullif(
    trim(both '-' from
      regexp_replace(
        regexp_replace(
          normalize(lower(coalesce(_input, '')), NFD),
          E'[\\u0300-\\u036F]', '', 'g'),
        '[^a-z0-9]+', '-', 'g')),
    '');
$$;

revoke execute on function public.specialty_slug(text) from public;
grant  execute on function public.specialty_slug(text) to service_role;

-- Remplissage. `coalesce` : une valeur déjà posée à la main n'est jamais
-- écrasée — seules les colonnes vides sont calculées.
update public.specialties set
  slug_de = coalesce(slug_de, public.specialty_slug(name_de)),
  slug_it = coalesce(slug_it, public.specialty_slug(name_it)),
  slug_en = coalesce(slug_en, public.specialty_slug(name_en));

-- Deux spécialités ne peuvent pas partager un slug dans une même langue.
create unique index if not exists specialties_slug_de_uniq on public.specialties (slug_de) where slug_de is not null;
create unique index if not exists specialties_slug_it_uniq on public.specialties (slug_it) where slug_it is not null;
create unique index if not exists specialties_slug_en_uniq on public.specialties (slug_en) where slug_en is not null;

-- Garde-fou : la résolution d'URL (`findActiveSpecialty`) cherche le slug reçu
-- dans les QUATRE colonnes à la fois avec `maybeSingle()`. Si un slug pointait
-- vers deux spécialités différentes, la page tomberait en erreur. Les index
-- ci-dessus protègent chaque colonne isolément, pas les collisions CROISÉES
-- (le `slug_en` de l'une valant le `slug` de l'autre) : on les vérifie ici, et
-- la migration échoue plutôt que de livrer des pages cassées.
do $$
declare n int;
begin
  select count(*) into n from (
    select v from (
      select slug as v, id from public.specialties where slug is not null
      union all select slug_de, id from public.specialties where slug_de is not null
      union all select slug_it, id from public.specialties where slug_it is not null
      union all select slug_en, id from public.specialties where slug_en is not null
    ) t group by v having count(distinct id) > 1
  ) c;
  if n > 0 then
    raise exception 'Slugs ambigus : % slug(s) désignent plusieurs spécialités. Résoudre avant de livrer.', n;
  end if;
end $$;

-- GRANT au niveau colonne : `anon` n'a pas de droit sur la table entière et
-- une colonne neuve n'hérite de rien.
grant select (slug_it, slug_en) on public.specialties to anon, authenticated;

comment on column public.specialties.slug_it is
  'Slug italien. Vide ⇒ repli sur `slug` (le slug français).';
comment on column public.specialties.slug_en is
  'Slug anglais. Vide ⇒ repli sur `slug` (le slug français).';
