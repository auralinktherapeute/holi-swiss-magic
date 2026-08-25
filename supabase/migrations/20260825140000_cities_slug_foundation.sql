-- ============================================================================
-- Fondation : un slug de ville, et un seul
--
-- POURQUOI
--   Deux sources concurrentes décidaient de l'URL d'une ville :
--     · le sitemap slugifie `therapists.city`   → « Genève »        → geneve
--     · la page slugifiait resolve_city().canonical_name → « Geneva » → geneva
--   Une tentative de déduplication des alias, le 25/08, a donc redirigé en 301
--   des URLs du sitemap vers des URLs qui n'y figuraient pas. Correctif annulé
--   le jour même (commit 8d54f9a). Cette migration pose la source unique qui
--   manquait ; le code ne la consommera que dans un second lot, une fois les
--   données vérifiées.
--
-- RÈGLE DE BACKFILL — préserver les URLs déjà publiées
--   1. Si des praticiens actifs exercent dans la ville, le slug est celui que
--      produit `therapists.city` : c'est littéralement l'URL déjà en ligne et
--      déjà au sitemap. On ne renomme rien.
--   2. Sinon, slug dérivé de `canonical_name`. Ces villes n'ont aucune page
--      publiée, le choix est donc sans conséquence sur l'index.
--   `canonical_name` reste inchangé : il sert à la résolution floue
--   (« ge », « genf », « ginevra »), pas aux URLs.
--
-- VILLES MANQUANTES
--   `resolve_city('coppet')` ne résout pas, alors que /specialites/…/coppet est
--   au sitemap : la page ne peut afficher personne faute de coordonnées. Les
--   villes absentes sont créées à partir des coordonnées que portent DÉJÀ les
--   fiches des praticiens (therapists.latitude/longitude) — aucune donnée
--   géographique n'est inventée ici.
--
-- Idempotente. À appliquer via Lovable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Slugification — miroir exact de cityToSlug() côté TypeScript
--
--    src/lib/city-slug.ts fait : lower → NFD → suppression des diacritiques →
--    [^a-z0-9]+ → '-' → trim '-'. Les deux implémentations DOIVENT rester
--    d'accord : c'est leur divergence qui a produit l'incident du 25/08.
--    `src/lib/seo-urls.test.ts` verrouille le côté TypeScript.
-- ----------------------------------------------------------------------------
create or replace function public.city_slug(_input text)
returns text
language sql
immutable
set search_path = public
as $$
  -- normalize(NFD) décompose « è » en « e » + accent combinant, puis on retire
  -- les combinants (U+0300–U+036F). C'est la transposition littérale du
  -- .normalize("NFD").replace(/\p{Diacritic}/gu,"") du TypeScript.
  -- (translate() n'a PAS été retenu : il opère sur les octets dès que la base
  --  n'est pas en UTF-8, et transforme alors « Genève » en « genaive ».)
  select nullif(
    trim(both '-' from
      regexp_replace(
        regexp_replace(
          normalize(lower(coalesce(_input, '')), NFD),
          E'[\\u0300-\\u036F]', '', 'g'
        ),
        '[^a-z0-9]+', '-', 'g'
      )
    ),
    ''
  )
$$;

comment on function public.city_slug(text) is
  'Slug d''URL pour une ville. Miroir de cityToSlug() dans src/lib/city-slug.ts — toute divergence entre les deux casse les URLs publiées.';

-- ----------------------------------------------------------------------------
-- 2) Colonne
-- ----------------------------------------------------------------------------
alter table public.cities add column if not exists slug text;

comment on column public.cities.slug is
  'Segment d''URL de la ville (/specialites/{spec}/{slug}). SOURCE UNIQUE : ni canonical_name (anglais : « Geneva ») ni display_name (« Genève, Suisse ») ne doivent servir à construire une URL.';

-- ----------------------------------------------------------------------------
-- 3) Créer les villes manquantes, à partir des coordonnées des praticiens
-- ----------------------------------------------------------------------------
insert into public.cities (canonical_name, display_name, aliases, country, lat, lng)
select
  t.city,
  t.city || ', Suisse',
  array[public.city_slug(t.city), lower(t.city)]::text[],
  'CH',
  avg(t.latitude)::double precision,
  avg(t.longitude)::double precision
from public.therapists t
where t.status = 'active'
  and t.city is not null and length(trim(t.city)) > 0
  and t.latitude is not null and t.longitude is not null
  and not exists (
    select 1 from public.cities c
    where public.city_slug(c.canonical_name) = public.city_slug(t.city)
       or public.city_slug(t.city) = any (
            select public.city_slug(a) from unnest(coalesce(c.aliases, '{}')) a
          )
  )
group by t.city;

-- ----------------------------------------------------------------------------
-- 4) Backfill — priorité aux villes qui ont déjà des pages en ligne
-- ----------------------------------------------------------------------------
with published as (
  select distinct t.city
  from public.therapists t
  where t.status = 'active' and t.city is not null and length(trim(t.city)) > 0
)
update public.cities c
   set slug = public.city_slug(p.city)
  from published p
 where c.slug is null
   and (
     public.city_slug(c.canonical_name) = public.city_slug(p.city)
     or public.city_slug(p.city) = any (
          select public.city_slug(a) from unnest(coalesce(c.aliases, '{}')) a
        )
   );

update public.cities
   set slug = public.city_slug(canonical_name)
 where slug is null;

-- ----------------------------------------------------------------------------
-- 5) Une ville, une adresse
-- ----------------------------------------------------------------------------
create unique index if not exists cities_slug_key
  on public.cities (slug) where slug is not null;

grant select on public.cities to anon, authenticated;
