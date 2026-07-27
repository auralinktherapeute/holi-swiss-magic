# Plan de visibilité Holiswiss — établi le 27/07/2026

> Document de travail. Constat mesuré, pas supposé : Search Console, base de production
> et sitemap en ligne vérifiés le 27/07/2026.

## 📌 Avancement au 27/07/2026 (fin de journée)

| Point | État |
|---|---|
| **1a** Soumissions manuelles d'indexation | 🔄 **en cours par Gérald** — quelques pages soumises |
| **1b** Liens entrants | ⬜ non commencé — **le vrai levier de fond** |
| **2** Sitemap fantôme de 2007 supprimé | ✅ fait |
| **3** Ancrage alémanique du contenu | ⬜ 10 sujets rédigés dans `sujets-alemanique.md`, aucun produit |
| **4** Titre pollué par un `#` markdown | ⬜ à corriger dans l'éditeur admin |

**Livré en plus** (hors plan initial, découvert en chemin) :
- Slugs allemands des articles : **9/38** (`articles.slug_de`) — appliqué
- Slugs allemands des spécialités : **17/31** (`specialties.slug_de`) — appliqué
- **Titres des pages spécialités corrigés** : ils étaient fabriqués depuis le slug, donc la
  page allemande de « naturopathie » s'intitulait « Naturopathie » au lieu de
  « Naturheilkunde ». Impact SEO supérieur à celui des URL.
- Codes cantonaux dans le champ ville corrigés (2 fiches) — appliqué

**Reste en attente d'application par Lovable :** `20260727140000_marketing_agent_threads.sql`
(conversations de l'agent marketing).

---

## Le constat

| Mesure | Valeur |
|---|---|
| Clics Google, 90 jours | **2** |
| Impressions, 90 jours | **45** |
| Pages de blog indexées | **0 sur 152** |
| État des URL de blog | **« URL is unknown to Google »** — jamais découvertes |
| Sitemap | 472 URL soumises · **0 indexée** · dernier téléchargement 09/07 |

**Ce qui n'est PAS le problème** (vérifié) : le contenu allemand existe (38/38 articles avec
`title_de` et `body_de`), `/de/blog` fonctionne, `robots.txt` est ouvert aux robots IA,
les `hreflang` sont complets, le sitemap contient bien les 152 articles, `/de/blog` est
lié depuis l'accueil.

**Ce qui EST le problème** : un domaine jeune sans liens entrants n'obtient quasiment aucun
budget de crawl. Google a téléchargé le sitemap et n'a rien crawlé. Tant que cette porte
reste fermée, écrire davantage ne produit aucun effet.

> À noter : `/de` est la **seule** page qui génère des clics (2 clics, position 3,2).
> L'allemand n'est pas en retard — il est en avance.

---

## 1. Faire découvrir le blog

### 1a. Demandes d'indexation manuelles (Search Console)

Quota d'environ 10–12 URL par jour. Ordre par intention de recherche décroissante :
les pages « remboursement » d'abord — forte anxiété, recherche récurrente, réponses
en ligne souvent floues.

**Jour 1 — les deux pages d'entrée + le remboursement**
```
https://holiswiss.ch/fr/blog
https://holiswiss.ch/de/blog
https://holiswiss.ch/fr/blog/therapies-remboursees-suisse-lamal
https://holiswiss.ch/de/blog/therapies-remboursees-suisse-lamal
https://holiswiss.ch/fr/blog/remboursement-lamal-assurances-complementaires-therapies-holistiques-suisse
https://holiswiss.ch/de/blog/remboursement-lamal-assurances-complementaires-therapies-holistiques-suisse
https://holiswiss.ch/fr/blog/hypnose-therapeutique-suisse-mythes-realites-remboursement
https://holiswiss.ch/de/blog/hypnose-therapeutique-suisse-mythes-realites-remboursement
https://holiswiss.ch/fr/blog/therapie-craniosacrale-suisse-bienfaits-remboursement
https://holiswiss.ch/de/blog/therapie-craniosacrale-suisse-bienfaits-remboursement
```

**Jour 2 — guides à forte intention**
```
https://holiswiss.ch/fr/blog/difference-kinesitherapeute-osteopathe-chiropracteur-suisse
https://holiswiss.ch/de/blog/difference-kinesitherapeute-osteopathe-chiropracteur-suisse
https://holiswiss.ch/fr/blog/naturopathie-suisse-romande-guide-naturopathes
https://holiswiss.ch/de/blog/naturopathie-suisse-romande-guide-naturopathes
https://holiswiss.ch/fr/blog/mal-de-dos-lombaire-osteopathe-chiropracteur-suisse
https://holiswiss.ch/de/blog/mal-de-dos-lombaire-osteopathe-chiropracteur-suisse
https://holiswiss.ch/fr/blog/acupuncture-geneve-lausanne-comment-ca-marche
https://holiswiss.ch/de/blog/acupuncture-geneve-lausanne-comment-ca-marche
https://holiswiss.ch/fr/blog/aromatherapie-suisse-huiles-essentielles-guide
https://holiswiss.ch/de/blog/aromatherapie-suisse-huiles-essentielles-guide
```

**Jours 3–4** : poursuivre avec les guides restants, puis les fiches thérapeutes complètes
(Gerald Henry, Caroline Roch, Dominique Jourdain, Émilie Chardon — les seules dont le contenu
est assez riche pour mériter l'indexation).

> ⚠️ L'API Inspection **lit** l'index, elle ne le force pas. IndexNow alimente **Bing**, pas
> Google. La tâche d'indexation quotidienne existante ne peut donc pas provoquer l'indexation
> Google — seule la soumission manuelle dans l'interface Search Console le peut. C'est
> probablement pourquoi elle tourne sans effet visible.

### 1b. Liens entrants — le vrai levier de fond

Sans liens, l'indexation manuelle ne tient pas dans la durée : Google ne reviendra pas.
Cibles suisses, par rapport effort/rendement :

| Cible | Nature du lien | Effort | Priorité |
|---|---|---|---|
| **Google Business Profile** | Fiche d'entreprise vérifiée | Faible | ⭐⭐⭐ |
| **local.ch / search.ch** | Annuaires suisses de référence | Faible | ⭐⭐⭐ |
| **ASCA** (asca.ch) | Ressource pour praticiens agréés | Moyen | ⭐⭐⭐ |
| **RME / EMR** (emr.ch) | Idem | Moyen | ⭐⭐⭐ |
| **NVS / SVNH** | Associations de branche alémaniques | Moyen | ⭐⭐⭐ |
| Associations cantonales | Page « partenaires » / ressources | Moyen | ⭐⭐ |
| **startupticker.ch** | Presse startup suisse | Moyen | ⭐⭐ |
| Écoles de naturopathie / sophrologie | Ressource pour jeunes diplômés | Moyen | ⭐⭐ |
| Blogs bien-être suisses | Article invité | Élevé | ⭐ |

**Angle d'approche** : ne pas demander un lien. Proposer une **ressource utile** —
par exemple le guide du remboursement ASCA/RME/EMR, qui manque cruellement en ligne et
sert directement les membres de ces associations. Le lien vient ensuite, naturellement.

Chaque praticien inscrit qui met un lien vers sa fiche depuis son propre site compte aussi :
c'est le levier le plus simple et le plus honnête.

---

## 2. Nettoyer Search Console

Un sitemap fantôme traîne dans la propriété :

```
http://www.holiswiss.ch/sitemap.xml.gz
soumis le 25/04/2007 · 1 erreur · 5 avertissements · 0 URL
```

Vestige d'un précédent propriétaire du domaine. **À supprimer** dans Search Console →
*Sitemaps* → sélectionner cette ligne → *Supprimer le sitemap*. Puis resoumettre
`https://holiswiss.ch/sitemap.xml` pour déclencher un nouveau téléchargement
(le dernier date du 09/07).

---

## 3. Ancrer le contenu en Suisse alémanique

Analyse des 38 articles allemands :

| Ancrage géographique | Nombre |
|---|---|
| Suisse romande uniquement | 7 |
| Les deux | 31 |
| **Suisse alémanique uniquement** | **0** |

Les articles allemands sont des **traductions** d'articles pensés pour Genève et Lausanne.
On y lit « Osteopathie und Gelenkschmerzen in der **Suisse romande** ». Un lecteur zurichois
n'y trouve rien qui le concerne.

**Ce n'est pas un défaut de traduction, c'est un défaut d'ancrage.** Il faut des articles
conçus pour l'alémanique, pas traduits depuis le français. Sujets à produire — voir
`marketing/sujets-alemanique.md`.

⚠️ Prérequis de cohérence : ne pas promettre de praticiens là où il n'y en a aucun.
**0 thérapeute inscrit à ZH, BE, AG, SG, LU.** Un article « Naturheilpraktiker Zürich »
qui n'aboutit sur aucune fiche déçoit le lecteur et dessert le site. Faire progresser
contenu et recrutement de front.

---

## 4. Corriger le titre pollué

L'article `lithotherapie-suisse-cristaux-bien-etre-holistique` a un titre allemand qui
commence par un `#` markdown :

```
# Lithotherapie in der Schweiz: Kristalle und energetisches Wohlbefinden
```

Retirer le `# ` en tête via l'éditeur d'article de l'admin (icône crayon dans *Articles*).
Ce caractère se retrouve tel quel dans le `<title>` et les résultats de recherche.
