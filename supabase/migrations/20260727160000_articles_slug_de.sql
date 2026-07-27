-- Slugs allemands localisés pour le blog. Jusqu'ici les 4 langues partageaient le
-- slug français (ex. /de/blog/mal-de-dos-lombaire-osteopathe-chiropracteur-suisse) :
-- une URL en allemand faite de mots français. slug_de reste optionnel — un article
-- non encore localisé continue d'utiliser `slug` sur toutes les langues, sans régression.

alter table public.articles add column if not exists slug_de text;

create unique index if not exists articles_slug_de_key
  on public.articles(slug_de) where slug_de is not null;

-- Localisation des 9 articles prioritaires (remboursement + guides à forte intention),
-- traduits pour un lecteur suisse alémanique plutôt que romand.
update public.articles set slug_de = 'krankenkasse-rueckerstattung-therapien-schweiz'
  where slug = 'therapies-remboursees-suisse-lamal' and slug_de is null;

update public.articles set slug_de = 'rueckerstattung-naturheilpraktik-asca-emr-schweiz'
  where slug = 'remboursement-lamal-assurances-complementaires-therapies-holistiques-suisse' and slug_de is null;

update public.articles set slug_de = 'hypnose-schweiz-mythen-kostenrueckerstattung'
  where slug = 'hypnose-therapeutique-suisse-mythes-realites-remboursement' and slug_de is null;

update public.articles set slug_de = 'craniosacral-therapie-schweiz-rueckerstattung'
  where slug = 'therapie-craniosacrale-suisse-bienfaits-remboursement' and slug_de is null;

update public.articles set slug_de = 'unterschied-physiotherapie-osteopathie-chiropraktik-schweiz'
  where slug = 'difference-kinesitherapeute-osteopathe-chiropracteur-suisse' and slug_de is null;

update public.articles set slug_de = 'naturheilkunde-schweiz-leitfaden'
  where slug = 'naturopathie-suisse-romande-guide-naturopathes' and slug_de is null;

update public.articles set slug_de = 'osteopathie-rueckenschmerzen-schweiz'
  where slug = 'mal-de-dos-lombaire-osteopathe-chiropracteur-suisse' and slug_de is null;

update public.articles set slug_de = 'akupunktur-schweiz-leitfaden'
  where slug = 'acupuncture-geneve-lausanne-comment-ca-marche' and slug_de is null;

update public.articles set slug_de = 'aromatherapie-schweiz-aetherische-oele'
  where slug = 'aromatherapie-suisse-huiles-essentielles-guide' and slug_de is null;

notify pgrst, 'reload schema';
