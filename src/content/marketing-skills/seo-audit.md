# Audit SEO — Holiswiss

**Lis d'abord `.agents/product-marketing.md`.**

## Le point de vigilance n°1 : le rendu pour les crawlers

Holiswiss est une application **TanStack Start (React)**. Le risque majeur d'un tel site est
que le contenu n'existe qu'après exécution du JavaScript. Googlebot sait généralement l'exécuter ;
**les crawlers des moteurs IA, souvent non.**

Vérifier en premier, avant toute autre chose :

```bash
# Ce que voit réellement un robot (Cloudflare bloque curl sans User-Agent navigateur)
curl -sL -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0 Safari/537.36" \
  "https://holiswiss.ch/fr/therapeute/{slug}" | wc -c
```

Puis contrôler que la page contient bien, **dans le HTML source** : le `<title>`, la
meta description, le `h1`, la bio du praticien, le JSON-LD, les `hreflang`.
Une fiche dont le HTML brut ne fait que quelques centaines d'octets utiles est invisible pour l'IA.

## Ordre d'audit

**1. Indexation**
- `sitemap.xml` à jour, incluant les 4 langues
- `robots.txt` n'excluant pas les crawlers IA (GPTBot, PerplexityBot, ClaudeBot, Google-Extended)
  → décision stratégique : pour Holiswiss, **on veut être crawlé** par ces agents
- Pages orphelines : une fiche accessible uniquement par la recherche interne ne sera pas indexée

**2. Multilingue** — le point faible actuel
- `hreflang` réciproques entre fr/de/it/en + `x-default`
- Une URL distincte par langue
- ⚠️ **38 articles, tous en FR.** Les versions DE/IT/EN annoncées en `hreflang` mais inexistantes
  génèrent des erreurs — n'annoncer que ce qui existe vraiment.

**3. Contenu mince** — le risque principal d'un annuaire jeune
- Fiches sans bio (plusieurs en production) : ~76 mots utiles → invisibles
- Pages de résultats vides ou quasi vides
- Doublons entre catégories d'articles proches

**4. Balisage** — voir compétence `schema`

**5. Performance & Core Web Vitals**
- LCP sur la fiche thérapeute (souvent la photo)
- Poids des images non optimisées

**6. Qualité éditoriale**
- Recherche d'allégations thérapeutiques dans tout le contenu publié :
  `grep -riE "guérit|guérir|soigne|traite la|remède"` — chaque occurrence est un risque légal
  **et** un frein à la citation par les IA

## Diagnostics à connaître

| Symptôme | Cause probable |
|---|---|
| Fiche indexée, aucune impression | Contenu trop mince, aucun mot-clé travaillé |
| Trafic FR correct, nul en DE | Pas de contenu allemand — pas un bug technique |
| Bien classé, peu de clics | Meta description absente ou peu engageante |
| Non cité par les IA | Pas de format Q/R, pas de JSON-LD en SSR, ou contenu trop mince |
| Page canton vide | Aucun praticien sur ce canton — voir seuil dans `programmatic-seo` |

## Livrable

Un tableau : **problème · gravité · pages touchées · effort · gain attendu**, trié par
rapport gain/effort. Toujours distinguer ce qui est **technique** (corrigeable en une fois) de
ce qui relève du **contenu** (travail continu). Pour Holiswiss, la majorité des faiblesses sont
éditoriales, pas techniques : le dire clairement plutôt que de faire croire à un bug.
