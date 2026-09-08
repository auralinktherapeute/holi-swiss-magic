# Audit d'indexabilité — 2026-09-08

Généré par `scripts/seo/audit-indexability.mjs`. **447 URLs** analysées, une par une,
depuis le sitemap en ligne.

> Cet audit mesure l'**indexabilité** — la capacité d'une page à être indexée — et la qualité des
> signaux qu'elle envoie. Il ne dit PAS si une page est indexée : seul Search Console le sait.
> Un HTTP 200 d'IndexNow ne prouve rien non plus.

## Classification

| Catégorie | URLs | Part |
|---|---:|---:|
| INDEXABLE_ET_PRIORITAIRE | 229 | 51 % |
| INDEXABLE_MAIS_A_AMELIORER | 197 | 44 % |
| NON_INDEXABLE_VOLONTAIRE | 16 | 4 % |
| A_DEDUPLIQUER_OU_CONSOLIDER | 5 | 1 % |

## Par type de page

| Type | URLs | Indexables et prioritaires |
|---|---:|---:|
| article | 252 | 192 |
| listing | 76 | 8 |
| specialty | 68 | 0 |
| static | 32 | 16 |
| therapist | 11 | 9 |
| home | 4 | 4 |
| parole | 3 | 0 |
| event | 1 | 0 |

## Top problèmes

| Problème | URLs |
|---|---:|
| contenu mince (< 250 mots) | 169 |
| orphelines (0 lien entrant) | 56 |
| title dupliqué | 17 |
| meta robots noindex | 16 |

## URLs bloquées techniquement

_aucune_

## À dédupliquer ou consolider

- `/fr/contact` — contenu mince (130 mots) ; title dupliqué
- `/en/contact` — contenu mince (124 mots) ; title dupliqué
- `/fr/blog/remboursement-asca-rme-naturopathie-acupuncture-suisse` — title dupliqué
- `/it/blog/remboursement-asca-rme-naturopathie-acupuncture-suisse` — title dupliqué
- `/en/blog/remboursement-asca-rme-naturopathie-acupuncture-suisse` — title dupliqué

## Ce que le fichier détaillé contient

`data/seo/indexability-audit.csv` — une ligne par URL, 26 colonnes :
statut HTTP, redirections, robots, canonical, title, H1, volume de contenu, liens entrants,
mode de rendu, catégorie, raison de blocage, signaux de qualité, action recommandée, priorité.
