# SEO — Pages publiques thérapeutes : audit et plan

## Ce qui existe déjà (vérifié dans le code)

Une bonne partie de la demande est **déjà en place** — inutile de la reconstruire :

- **SSR** : le site tourne déjà en TanStack Start avec SSR par défaut. Aucune migration de stack nécessaire.
- **Fiche publique** : `/{langue}/therapeute/{slug}` existe, accessible sans connexion, rendue côté serveur via un chargement serveur, avec titre + description uniques, canonical, hreflang FR/DE/IT/EN, et données structurées `Person` + `HealthAndBeautyBusiness`.
- **Visibilité** : contrôlée par `therapists.status = 'active'` (déjà utilisé partout : recherche, sitemap, RLS). Pas besoin d'un nouveau champ `is_public` — ce serait un deuxième drapeau concurrent, source de bugs.
- **Slug** : champ `therapists.slug` unique et stable, déjà généré.
- **Sitemap** : `/sitemap.xml` dynamique incluant pages statiques ×4 langues, fiches actives (1 URL par fiche, dans sa langue de rédaction), spécialités, spécialité × ville, familles, événements, blog, Voix d'experts.
- **robots.txt** : autorise les pages publiques, bloque `/admin/` et `/dashboard/`, déclare le sitemap.
- **Zones privées** : `/admin` et `/dashboard` sont en `ssr: false` + garde d'authentification, hors sitemap, bloquées par robots.

## Les vraies lacunes à combler

### 1. Pages de listing par canton (priorité haute)
Aujourd'hui le filtre canton n'est qu'un paramètre d'URL (`/therapeutes?canton=GE`) — non indexable, pas de titre propre. Le bloc « Holiswiss dans toute la Suisse » de l'accueil pointe vers ces URL non indexables : 26 liens internes gaspillés.

- Nouvelle route `/{langue}/therapeutes/canton/{canton}` en SSR.
- Titre/description uniques par canton et par langue (« Thérapeutes à Genève | Holiswiss »).
- H1 propre, liste de liens vers chaque fiche, JSON-LD `ItemList` + fil d'Ariane.
- Redirection 301 de `/therapeutes?canton=XX` vers la nouvelle URL.
- Mise à jour de `CantonDirectory` pour pointer vers les nouvelles routes.

### 2. Pages de listing par ville (priorité haute)
- Nouvelle route `/{langue}/therapeutes/ville/{ville}`, même structure.
- Générée uniquement pour les villes comptant au moins un thérapeute actif (pas de page vide).
- Lien vers la page canton parente et vers les combinaisons spécialité × ville existantes.

### 3. Listing par spécialité
Déjà couvert par `/{langue}/specialites/{slug}` et `/{langue}/specialites/{slug}/{ville}`. On ajoute seulement des alias de redirection `/therapeutes/specialite/{slug}` → page existante, pour éviter le contenu dupliqué.

### 4. Sitemap et maillage
- Ajout des URL canton et ville au sitemap.
- Bloc de maillage interne en pied de page : cantons principaux + villes principales.
- Depuis chaque fiche : liens « Autres thérapeutes à {ville} » et « dans le canton de {canton} ».

### 5. Lecture publique et performance
- Les listings publics passent par une fonction serveur publique existante (clé publiable + RLS lecture anonyme sur les thérapeutes actifs) — **aucune modification des politiques RLS ni de l'authentification**.
- Index base de données sur `therapists(status, canton)` et `therapists(status, city)` pour que les listings restent rapides.
- Mise en cache HTTP courte sur les listings.

### 6. Validation
- Vérification que le HTML servi contient bien le contenu (fiche, canton, ville) et non un conteneur vide.
- Contrôle des données structurées.
- Vérification que connexion, réservation, tableau de bord et CRM fonctionnent à l'identique.

## Détails techniques

- Nouveaux fichiers de route : `src/routes/$lang.therapeutes.canton.$canton.tsx`, `src/routes/$lang.therapeutes.ville.$citySlug.tsx`, plus deux routes de redirection.
- Nouvelles fonctions serveur publiques dans `src/lib/public.functions.ts` : `listTherapistsByCanton`, `listTherapistsByCity`, `listPublicCities` (client à clé publiable, colonnes publiques uniquement).
- Réutilisation de `seoLinks`, `ogLocale`, `hreflangLinks` de `src/lib/seo.ts` — pas de logique SEO dupliquée.
- Une migration ajoutant seulement deux index (aucun changement de schéma ni de RLS).
- `src/routes/sitemap[.]xml.ts` étendu avec les deux nouvelles familles d'URL.

## Ce que je ne fais pas (et pourquoi)

- Pas de champ `is_public` : doublon de `status`, risque de fiches invisibles ou fantômes.
- Pas de vue `public_profiles` : la RLS actuelle expose déjà uniquement les colonnes publiques (email/téléphone sont exclus des droits de lecture publique).
- Pas de migration de stack : le SSR est déjà actif.

## Checklist de validation

Avant : noter le nombre d'URL du sitemap, vérifier connexion + réservation.
Après :
1. Le sitemap contient les nouvelles URL canton et ville.
2. Une page canton et une page ville renvoient un HTML complet avec H1 et liens de fiches.
3. Titre et description uniques sur chaque nouvelle page.
4. Les anciennes URL à paramètre redirigent en 301.
5. Aucune URL `/admin` ou `/dashboard` dans le sitemap.
6. Connexion, réservation, tableau de bord thérapeute et CRM inchangés.
7. Soumission du sitemap dans Google Search Console (procédure fournie à la livraison).
