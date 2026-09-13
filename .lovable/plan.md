# Diagnostic performance / résilience — lecture seule

Aucun fichier applicatif, aucune base, aucune configuration n'a été modifié. Rien n'a été publié.

## 1. Ce que les mesures donnent réellement aujourd'hui

Mesures faites depuis l'environnement de travail, sans cookie ni identifiant, deux passages par adresse (froid puis chaud), plus un troisième passage espacé. Temps en secondes, jusqu'au premier octet (TTFB).

| Adresse | holiswiss.ch (1er / 2e / 3e) | domaine lovable | local |
|---|---|---|---|
| /fr | 3,97 / 0,36 / 0,41 | 302 (redirection) | 0,80 / 0,08 |
| /fr/therapeutes | 1,19 / 1,13 / 0,34 | 302 | 0,97 / 0,08 |
| /fr/therapeutes/canton/GE | 0,29 / 1,28 | 302 | 0,08 / 0,12 |
| /fr/therapeutes/ville/geneve | 0,25 / 0,28 | 302 | 0,07 / 0,06 |
| /fr/therapeute/henry-gerald | 1,00 / 0,90 / 1,88 | 302 | 1,17 / 0,62 |
| /sitemap.xml | 0,68 / 0,50 | 302 | 0,38 / 0,33 |
| /robots.txt | 0,24 / 0,18 | 302 | 0,004 |

Résolution du nom : 0,00–0,08 s. Établissement de la connexion sécurisée : 0,03–0,11 s. Ces deux postes ne sont jamais le problème.

Conclusions prudentes :
- **Les 7 à 13 secondes de l'audit du 13 septembre ne se reproduisent pas** ici, sur aucune des sept adresses. Le pire cas observé est un unique premier appel de /fr à 3,97 s, puis 0,36 s ensuite : signature typique d'un démarrage à froid, pas d'une lenteur permanente.
- **La comparaison avec le domaine lovable est impossible en l'état** : il répond 302 vers le domaine principal, donc il ne sert pas la page. Ce n'est pas une anomalie, c'est la redirection vers le domaine principal.
- **Ces chiffres ne prouvent aucune cause interne.** Ils mélangent réseau, plateforme et traitement serveur. Le site n'expose aujourd'hui aucune mesure du temps passé dans le code et dans la base : cette part reste inconnue. La fiche de praticien, la plus lente et la plus variable (0,9 → 1,9 s), est aussi celle qui fait le plus d'allers-retours base (voir plus bas), ce qui est cohérent, sans être démontré.

En-têtes observés en production : les pages HTML sont servies en `no-cache, must-revalidate, max-age=0` (aucun cache, ni navigateur ni intermédiaire). `/sitemap.xml` est en `public, max-age=3600` avec `ETag` et `Last-Modified`. `/robots.txt` ne porte aucune règle de cache.

## 2. Ce que le code fait en cas de panne

Preuves (fichier : fonction) :

- `src/routes/$lang.therapeutes.canton.$canton.tsx` → `loader` : `catch { return { therapists: [] } }`
- `src/routes/$lang.therapeutes.ville.$citySlug.tsx` → `loader` : `catch { return { therapists: [], cityName: null, canton: null } }`
- `src/routes/$lang.therapeutes.index.tsx` → `loader` : `catch { return { seoTherapists: [] } }`
- `src/routes/$lang.therapeutes.famille.$familySlug.tsx`, `$lang.therapeutes.holistique.tsx` : même schéma
- `src/routes/$lang.therapeute.$slug.tsx` → `loader` : `catch { return { therapist: null, ... } }`
- `src/lib/public.functions.ts` → `getTherapistBySlug` : lève bien une erreur sur la requête principale, mais **ignore silencieusement** les erreurs des lectures secondaires (avis, diplômes, certifications d'organismes, articles, événements) via `data: rows` sans lecture de `error`.

Conséquence, en clair : si la base est momentanément indisponible, ces pages ne signalent pas la panne. Elles répondent **200 avec une liste vide**. Pour une ville ou un canton, la page vide ajoute en plus `robots: noindex,follow` (`head()` des deux fichiers) — donc une panne de quelques minutes peut demander aux moteurs de désindexer des pages qui, en réalité, ont du contenu. Une fiche de praticien en panne renvoie 200 avec un profil absent, au lieu d'une page « introuvable » ou d'une erreur temporaire.

À l'inverse, le plan de site fait déjà exactement ce qu'il faut : `src/routes/sitemap[.]xml.ts` → handler `GET` renvoie **503** avec `Cache-Control: no-store` et `Retry-After: 3600` quand la génération échoue, précisément pour ne pas faire croire à la disparition d'URL. C'est le modèle à copier ailleurs.

Caches côté serveur pour les lectures publiques : il n'y en a pas. Les seuls mécanismes existants concernent `brain.functions.ts`, `llms-full.txt`, le plan de site et l'API publique de certification. Aucune invalidation n'existe donc à écrire ou à corriger aujourd'hui.

Coût de la fiche praticien (`getTherapistBySlug`) : requête profil, puis avis, puis diplômes, puis certifications d'organismes, puis (en parallèle) articles et événements, puis **une URL signée par image d'événement**, chacune étant un aller-retour supplémentaire. Deux clients différents sont construits dans le même appel (client public et client d'administration).

## 3. Blocages rencontrés

- Impossible de comparer le domaine lovable : il redirige (302) et ne rend pas les pages.
- Impossible de séparer « temps réseau » et « temps de traitement » : aucune mesure interne n'existe. Toute affirmation sur la part base de données serait une supposition.
- La production sert la version publiée, antérieure au dernier lot : les mesures ne portent pas sur le code le plus récent.
- Le serveur local ne parle pas à la base de production : ses temps ne sont pas comparables en valeur absolue.

## 4. Petit lot proposé (à décider, rien n'est fait)

Ordre de valeur décroissante, sans toucher au fonctionnement nominal.

1. **Distinguer une panne d'un vrai vide** (le point le plus important). Les chargements ci-dessus arrêteraient d'inventer une liste vide : en cas d'échec technique, la page répondrait par une erreur temporaire (503, `no-store`, `Retry-After`) comme le fait déjà le plan de site. Un résultat réellement vide continuerait de répondre 200, avec son message « aucun thérapeute pour l'instant » et son `noindex` — comportement inchangé. Les lectures secondaires de la fiche (avis, diplômes, événements) resteraient tolérantes : la fiche s'affiche même si un bloc manque.
2. **Rendre le temps interne mesurable** : journaliser la durée de chaque lecture publique côté serveur, sans donnée personnelle. Cela permettra, la prochaine fois, de répondre « c'est la base » ou « c'est le réseau » avec une preuve, au lieu d'un raisonnement.
3. **Réduire les allers-retours de la fiche praticien** : lancer les lectures indépendantes en parallèle et ne signer les images qu'une fois. Aucun changement visible pour le visiteur.
4. **Cache court, uniquement si vous le souhaitez** : réservé aux listes publiques anonymes (annuaire, canton, ville) et au plan de site. Durée proposée : 5 minutes, donc une nouvelle fiche ou une modification peut mettre jusqu'à 5 minutes à apparaître dans ces listes. Exclu par principe : tout ce qui dépend d'un compte connecté, d'un filtre personnel ou de données privées — jamais de mise en cache ni de partage d'un résultat personnalisé entre visiteurs. La fiche individuelle resterait sans cache.

## Détails techniques

- Fichiers concernés par le point 1 : `src/routes/$lang.therapeutes.index.tsx`, `$lang.therapeutes.canton.$canton.tsx`, `$lang.therapeutes.ville.$citySlug.tsx`, `$lang.therapeutes.famille.$familySlug.tsx`, `$lang.therapeutes.holistique.tsx`, `$lang.therapeute.$slug.tsx`, et la lecture des `error` ignorées dans `src/lib/public.functions.ts`.
- Aucune migration, aucun changement de schéma, aucune politique de sécurité touchée dans ce lot.
- Aucune publication : la mise en ligne resterait à votre initiative.
