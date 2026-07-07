## Diagnostic

Le champ de recherche de `/therapeutes` n'est **pas** un vrai moteur de recherche : c'est uniquement un géocodeur de ville.

```
search "shiatsu" → geocodeCity("shiatsu") → { ok: false } → "Ville introuvable" → 0 résultat
```

Conséquences observées (capture jointe) :
- Taper `shiatsu` → 0 thérapeute alors que le filtre `?specialite=shiatsu` en trouverait.
- Taper un **nom**, un **tag**, une **spécialité secondaire**, une **description** → jamais retourné.
- Taper `shiatsu lausanne` → géocodage échoue sur la chaîne entière, rien ne matche.
- Aucune tolérance accent/casse côté SQL, aucun ranking, aucun fallback.

La base est pourtant riche : `first_name`, `last_name`, `title`, `short_bio`, `bio`, `city`, `canton`, `specialties[]`, `approaches[]`, `services jsonb`, plus la table `therapist_specialties` liée à `specialties(name_fr/de/it/en, aliases[])` et `specialty_families`.

## Architecture cible

Un seul RPC `search_therapists(_q, _lat, _lng, _radius_m, _spec_slug, _family_slug, _limit)` qui :

1. **Tokenise** la requête (split espaces, `unaccent` + `lower`).
2. Pour chaque token, tente en parallèle :
   - correspondance **ville** (via `public.cities` alias + `normalize_city_text`) → si trouvée, applique un filtre géographique 80 km avec `ST_DWithin`.
   - correspondance **spécialité** (nom multilangue + `aliases[]` via `specialties`) → filtre `therapist_specialties`.
   - correspondance **texte** sur les champs thérapeute (voir scoring).
3. Les tokens non résolus en ville/spécialité restent en tokens texte : chaque thérapeute doit matcher **tous** les tokens texte restants sur au moins un champ (AND entre tokens, OR entre champs) → gère naturellement `"shiatsu lausanne"`, `"lausanne shiatsu"`, `"marie geneve massage"`.
4. **Fallback** : si 0 résultat en AND strict, relance en OR (mode tolérant) et marque les résultats "approchant".

### Scoring (points cumulés, tri desc)

| Match | Points |
|---|---|
| Nom/prénom exact (token = nom) | 100 |
| Nom/prénom prefix | 70 |
| Slug exact | 90 |
| Ville exacte | 60 |
| Canton exact | 40 |
| Spécialité principale (via pivot, name/alias) | 55 |
| Spécialité secondaire / `approaches[]` / `specialties[]` texte | 35 |
| `title` contient token | 25 |
| `short_bio` contient token | 15 |
| `bio` / `services` contient token | 8 |
| Bonus `verified` | +5 |
| Bonus `subscription_plan = 'elite_pro'` | +10 |
| Bonus proximité géo (si ville détectée) | jusqu'à +20 selon distance |

Ranking final = somme sur tous les tokens matchés + bonus profil.

## Modifications base de données (une migration)

1. **Extension** : `unaccent` (déjà présent d'après `normalize_search`).
2. **Colonne générée** `search_tokens tsvector` sur `therapists` :
   ```
   to_tsvector('simple', unaccent(coalesce(first_name,'')||' '||coalesce(last_name,'')||' '
                       ||coalesce(title,'')||' '||coalesce(city,'')||' '||coalesce(canton,'')||' '
                       ||coalesce(short_bio,'')||' '||coalesce(bio,'')||' '
                       ||array_to_string(coalesce(specialties,'{}'),' ')||' '
                       ||array_to_string(coalesce(approaches,'{}'),' ')))
   ```
   + index GIN.
3. **Fonction `search_therapists(...)`** (SECURITY DEFINER, STABLE) qui implémente la logique ci-dessus, réutilise `normalize_city_text`, `resolve_city`, la table `specialties` (nom + `aliases`) et `therapist_specialties`. Retourne les mêmes colonnes que `therapists_within_radius` + `score float` + `matched_city text` + `matched_specialty text`.
4. Grants: `EXECUTE` à `anon`, `authenticated`.

Aucune modification de policy — le RPC lit uniquement des thérapeutes `status='active'`, déjà autorisés en lecture publique.

## Modifications UI (`src/routes/$lang.therapeutes.index.tsx`)

- Remplacer les 3 queries (`geo`, `nearby`, `defaultList` filtré) par **une seule** `useQuery(["therapists-search", debounced, spec, famille])` qui :
  - si `debounced.length < 2` et pas de filtre → `search_therapists(_q=null, ...)` (liste par défaut triée verified/premium).
  - sinon → `search_therapists(_q=debounced, _spec_slug, _family_slug)`.
- Debounce déjà à 400 ms — le passer à **250 ms** pour ressenti "instantané".
- Bandeau contextuel :
  - si `matched_city` → "X thérapeutes autour de **Lausanne** correspondant à **shiatsu**".
  - sinon → "X thérapeutes correspondant à **shiatsu**".
  - si 0 résultat strict et fallback OR → "Aucun résultat exact. Voici des profils approchants."
- Etat vide utile : liens vers les familles + spécialités populaires (déjà via `SpecialtyExplorer`).
- Aucun changement au `SpecialtyExplorer`, à la carte, aux filtres URL, aux breakpoints mobile.
- Le mode "hors ligne" du géocodeur Google est supprimé de ce flux (plus de faux "Ville introuvable"). `geocodeCity` reste utilisé ailleurs.

## Cas de test à valider

| Entrée | Attendu |
|---|---|
| `shiatsu` | Tous les thérapeutes shiatsu (spécialité + alias + texte) |
| `Shiatsu` | Idem (insensible casse) |
| `shiatsu lausanne` | Shiatsu ∩ (Lausanne exact OU ≤80 km) |
| `lausanne shiatsu` | Idem |
| `marie` | Tous les prénoms/nom "Marie…" |
| `geneve` (sans accent) | Ville Genève |
| `emdr fribourg` | EMDR autour de Fribourg |
| `ayurveda` | Match via `aliases` de la table specialties |
| Nom exact d'un thérapeute | Ce thérapeute en tête (score 100) |
| Requête vide | Liste par défaut, verified/premium en tête |
| `xyzabc` | 0 résultat + suggestions familles |
| Filtre URL `?specialite=shiatsu` + recherche `lausanne` | Shiatsu ∩ Lausanne |

## Exemple Shiatsu

Thérapeute `Henry Gerald`, Lausanne, `specialties=['Shiatsu','Reiki']`, spécialité pivot = `shiatsu`.

- `q="shiatsu"` : match pivot (+55) + tableau (+35) + tsvector (+8) → score ~98, en tête.
- `q="shiatsu lausanne"` : token `lausanne` résolu en ville → filtre 80 km + bonus distance (+20). Token `shiatsu` match pivot (+55). Score ~130.
- `q="henry"` : match `first_name` (+100). En tête.

## Livraison

1. Migration SQL (colonne `search_tokens` + fonction `search_therapists` + grants).
2. Refonte du fichier `src/routes/$lang.therapeutes.index.tsx` : hooks de recherche unifiés, bandeau contextuel, fallback.
3. Vérification Playwright rapide sur `shiatsu`, `shiatsu lausanne`, nom, ville.

Aucun changement de schéma destructif, aucun impact sur les autres pages ou sur les policies existantes.