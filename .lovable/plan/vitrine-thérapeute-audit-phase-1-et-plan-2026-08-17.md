# Vitrine thérapeute — audit (Phase 1) et plan

## PHASE 1 — Diagnostic : pourquoi les badges "Pro" ont disparu

Vérifié directement sur la base de production (API REST, projet `qqwud…`), pas déduit du code :

1. **Cause racine n°1 — colonne inexistante.** `src/routes/$lang.therapeute.$slug.tsx` teste `th.is_premium`
   (badge ⚡ Pro, galerie photos). La colonne `is_premium` **n'existe pas** dans `therapists` en production
   (l'API répond 400). Elle vient du schéma du bac à sable. La colonne réelle est `subscription_plan`.
   Résultat : `th.is_premium` vaut toujours `undefined` → **le badge Pro et la galerie ne s'affichent jamais**.
   Même problème dans `$lang.therapeutes.index.tsx` et `components/map/TherapistMap.tsx`.
2. **Cause racine n°2 — aucune donnée vérifiée.** Sur les 9 fiches actives, `verified = false` partout et
   `subscription_plan = 'free'` partout. Donc même le badge "Vérifié" (qui, lui, est correctement codé)
   n'a rien à afficher. Ce second point n'est **pas** un bug de code : c'est un état de données à trancher
   côté administration.
3. **Certifications non vérifiables.** `therapist_certifications` (name, issuer, year, file_url) n'a
   **aucune colonne d'état de vérification** ni de date/valideur. Les accréditations affichées sur la fiche
   viennent en fait du champ `therapists.accreditations` (JSON **déclaratif**, ex. ASCA/RME sans numéro).
   Aujourd'hui la page affiche donc du déclaré avec une icône de type "vérifié" — à corriger, c'est
   exactement l'interdit demandé.

## PHASE 1 — Audit du reste de la page

- **Données** : loader SSR `getTherapistBySlug` (client anon, lecture publique) + `useQuery` de revalidation.
  Les deux `select` divergent (le client demande `approaches`/`consultation_modes`, pas le serveur d'origine :
  à harmoniser). Pas de fuite de contact : `email`/`phone` ne sont pas dans le select public. OK.
- **Multilingue** : route `/{lang}/therapeute/{slug}`, `canonical` + `hreflang` fr/de/it/en + x-default déjà
  posés via `src/lib/seo.ts`. En revanche **title, description et H1 sont codés en dur en français**
  ("— … à Genève"), quelle que soit la langue. C'est le principal manque SEO local.
- **Données structurées** : JSON-LD `Person` existant. Manquent `BreadcrumbList`, `Service`/`Offer` (les
  prestations sont pourtant affichées), `sameAs`, `inLanguage`. `aggregateRating` doit rester conditionné aux
  avis approuvés réellement affichés (c'est le cas aujourd'hui — à préserver).
- **Score de visibilité** : la rubrique existe déjà (`therapist_health_scores`, 4 axes complétude / contenu /
  activité / visibilité, recommandations dans `therapist_health_recommendations`, calcul SQL
  `compute_therapist_health`, écrans `/admin/sante-profils` et dashboard). **Aucun score parallèle ne sera créé.**
- **Réservation, agenda, CRM, Resend** : hors périmètre, non modifiés.

## PHASE 2 — Plan d'implémentation

### 3. Restauration des badges (fichiers : `src/components/holiswiss/TrustBadges.tsx` (nouveau),
`$lang.therapeute.$slug.tsx`, `$lang.therapeutes.index.tsx`, `map/TherapistMap.tsx`, `lib/public.functions.ts`)
- Remplacer partout `is_premium` par un helper `isProPlan(subscription_plan)` — corrige la régression à la source.
- Nouveau composant `TrustBadges` : libellé, icône SVG, description accessible (`aria-label` + texte),
  état vérifié, date de vérification si disponible, source si affichable.
- Séparer visuellement **déclaré** et **vérifié** : les accréditations JSON restent affichées mais avec
  une mention "déclaré par le praticien" et une icône neutre, tant qu'aucun justificatif n'est validé.
- Migration additive sur `therapist_certifications` : `verification_status` (declared/verified/rejected/expired),
  `verified_at`, `verified_by`, `expires_at`, `source_label` + GRANT + RLS (lecture publique **uniquement**
  des lignes vérifiées, écriture du statut réservée à l'admin). Aucune donnée inventée : tout part en `declared`.

### 4. Structure de la vitrine
Réorganisation des sections existantes + ajout de "Pour qui ?", "Déroulement d'une séance", FAQ et bloc
"Informations pratiques / confidentialité". **Chaque section rendue conditionnelle** : rien à afficher = pas de bloc.
Le widget de réservation et l'agenda restent tels quels.

### 5. SEO local et langues
- `resolveProfileLang(canton, langues du thérapeute, langue d'URL)` dans `src/lib/seo.ts`.
- Title / description / H1 / fil d'ariane localisés via i18n (fr/de/it/en) avec le gabarit local
  ("Therapeut in Zürich", "Thérapeute à Genève", "Terapeuta in Ticino").
- Les textes rédigés par le thérapeute (bio, approche) **ne sont jamais traduits automatiquement**.

### 6. Données structurées
`Person` enrichi + `ProfessionalService` (adresse publique uniquement), `Service`/`Offer` alignés sur les
prestations visibles, `BreadcrumbList`, `sameAs` (site web et profils vérifiés seulement), `inLanguage`.
Règle de garde : tout champ absent de la page visible est omis du balisage.

### 7. Visibilité IA / GEO
Bloc de synthèse d'entité en haut de page (qui, où, pour qui, méthodes, langues, comment réserver) rendu
**en SSR** ; FAQ en clair ; articles signés reliés au profil (`author` + lien réciproque) avec dates de
publication et de mise à jour.

### 8. Score de visibilité (extension de l'existant, pas de doublon)
- Migration additive sur `therapist_health_scores` : sous-scores par catégorie demandée (profil, confiance,
  SEO local, langue, SEO technique, contenu expert, GEO, conversion, fraîcheur, réputation, accessibilité),
  et **deux totaux distincts** : `score_visibilite_total` et `score_conversion_total`.
- Écran admin existant enrichi : par catégorie → score, réussis, manquants, bloquants, 3 actions prioritaires,
  date de dernière analyse.

### 9. Contrôles automatiques
Un module d'audit par fiche produisant les contrôles listés (certification déclarée non vérifiée, badge sans
justificatif, certification expirée, tarif divergent profil/réservation, title/description/H1, image sans alt,
lien externe cassé, disponibilités absentes, FAQ absente, etc.), stockés dans
`therapist_health_recommendations` avec sévérité. Réutilise l'infrastructure de recommandations existante.

### 10. Kit de visibilité
Onglet admin/thérapeute générant title, meta, descriptions, FAQ, bio, JSON-LD — **toujours en brouillon**,
publication uniquement après validation humaine explicite.

### 11. Pages locales
Audit du système existant (`/{lang}/specialites/{slug}/{ville}`) ; le seuil actuel (au moins un praticien actif)
est conservé et durci si nécessaire. Aucune génération de masse.

### 12. Performance et accessibilité
`loading="lazy"` + dimensions sur les images, `alt` réels, focus visible, contrastes, `prefers-reduced-motion`,
cibles tactiles 44 px, contenu principal rendu côté serveur.

## Ordre de livraison proposé
1. Correctif badges Pro + `TrustBadges` + migration certifications (le plus urgent, c'est la régression).
2. SEO multilingue + données structurées + bloc GEO.
3. Restructuration des sections de la vitrine.
4. Extension du score existant + contrôles automatiques.
5. Kit de visibilité.

## Points nécessitant votre décision
- Aucun thérapeute n'est `verified = true` en production : voulez-vous que la vérification reste 100 % manuelle
  côté admin (aucun badge tant que rien n'est validé), ou faut-il un badge intermédiaire "déclaré" visible ?
- Les 9 fiches sont en plan `free` : le badge Pro n'apparaîtra donc qu'après un passage de plan. Confirmez-vous
  que Pro = `subscription_plan` ≠ `free` ?
