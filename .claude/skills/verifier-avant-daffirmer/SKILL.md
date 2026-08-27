---
name: verifier-avant-daffirmer
description: À charger AVANT d'annoncer qu'un correctif est déployé, qu'une table est protégée, qu'un changement est visible, qu'une migration a pris — et avant d'écrire toute commande de contrôle (grep, curl, psql, gh) sur Holiswiss. Contient les sondes calibrées du projet et la liste des commandes qui ont déjà produit de faux négatifs (grep -c, $? après pipeline, 200 [] sur table vide, GRANT anon hérité). Charger aussi avant de conclure qu'une fonctionnalité est terminée.
---

# Vérifier avant d'affirmer — Holiswiss

Chaque règle est ici parce qu'elle a **déjà** été enfreinte sur ce dépôt, la plupart
plusieurs fois. Elles ne sont pas théoriques.

## La règle qui les résume

**Énoncer ce que la commande devrait renvoyer AVANT de la lancer.** Si le résultat est
`0`, `1` ou vide, soupçonner la commande avant de soupçonner le code.

Corollaire : une vérification qui ne peut pas échouer ne vérifie rien. Avant de faire
confiance à un test ou à un garde-fou, réintroduire le défaut et constater qu'il tombe.

## Commandes qui mentent

| Piège | Ce qui se passe | À faire |
|---|---|---|
| `grep -c motif f` | Compte les **LIGNES**. Le HTML servi et le CSS minifié tiennent sur **une seule ligne** → `1` au lieu de `9`, ou `0` à tort. *(3 occurrences)* | `grep -o motif f \| wc -l` |
| `cmd \| tail` puis `$?` | Rend le code de `tail`, jamais celui de `cmd`. | `set -o pipefail`, ou lancer `cmd` seule |
| Globs entre guillemets passés à une fonction shell | Le découpage de mots ne re-développe pas les globs → chemins inexistants → `0` partout, silencieusement. | Passer les chemins en `"$@"` |
| `echo "ok"` après un heredoc | S'affiche même si le heredoc a échoué. | `psql -v ON_ERROR_STOP=1`, tester le code de retour |
| `curl` en rafale sur holiswiss.ch | Cloudflare étrangle : réponses vides ou tronquées, qu'on prend pour une régression du site. | Espacer (≥1 s), User-Agent de navigateur, ou `npm run seo:check` |
| Stub de test plus permissif que la prod | Masque exactement le bug qu'il devrait révéler (droits table entière vs colonne ; `SQL_ASCII` vs UTF-8). | Reproduire les droits réels, colonne par colonne |
| Vérifier le résultat d'un test sans vérifier sa MISE EN PLACE | Une « collision » rejetée par une contrainte unique n'est pas une collision : le garde-fou n'a rien eu à attraper. | Confirmer que l'état de départ est bien celui voulu |

## Sondes calibrées — Data API de production (`qqwud`)

Ne jamais conclure sans témoin positif **et** témoin négatif connus.

| Réponse | Signification |
|---|---|
| `404` `PGRST205` | La table n'existe pas |
| `401` `42501` | La table existe et `anon` n'y a **aucun** droit (référence : `appointments`) |
| `200` + lignes | Lecture publique effective (référence : `specialties`) |
| `200 []` | **Ambigu** : soit RLS filtre tout, soit la table est vide. Ne prouve RIEN sur une table vide. |
| `400` sur `?select=colonne` | La colonne n'existe pas |

```bash
KEY=$(grep -hE '^SUPABASE_PUBLISHABLE_KEY=' .env | sed -E 's/.*="//;s/".*//')
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://qqwudmnfavvaukuldulr.supabase.co/rest/v1/<table>?select=<colonne>&limit=1" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

## Droits Supabase — deux pièges opposés

**Une colonne neuve lue publiquement exige un GRANT explicite.** `anon` n'a pas de droit
sur la table entière, seulement colonne par colonne. Sans lui : `permission denied for
table therapists` sur **toute** la fiche. *(commis sur `faq_enabled`)*

```sql
grant select (ma_colonne) on public.therapists to anon, authenticated;
```

**Mais « ne rien accorder » n'est PAS « refuser ».** Supabase pose des
`ALTER DEFAULT PRIVILEGES` sur le schéma `public` : toute table créée ensuite hérite du
`SELECT` pour `anon`. Une table qui porte un secret doit révoquer explicitement.

```sql
revoke all on public.ma_table from anon;
```

Et toute fonction `SECURITY DEFINER` doit être révoquée de `PUBLIC` — sauf les helpers
appelés dans les policies RLS, qui doivent rester exécutables.

## Prétendre qu'un changement est visible

`tsc` propre + tests verts + build réussi ne disent **rien** sur l'apparence. Convertir
des hexadécimaux en tokens ne change **aucun pixel** tant que les tokens portent les
anciennes valeurs (`--primary: #b86ef9`). Un commit « refonte visuelle » entièrement
invisible a déjà été livré ainsi.

```bash
grep -o '<classe-ou-hex>' .output/public/assets/*.css | wc -l
```

Et un aperçu validé est un contrat : livrer la direction choisie **avec** ce qui la
distinguait, pas une version amputée.

## Une fonctionnalité s'arrête à son EFFET

Écrire dans une table sans que rien ne la lise produit une promesse fausse à l'écran.
Avant d'annoncer une fonctionnalité, chercher qui **consomme** la donnée :

```bash
grep -rn "ma_table" src/ --include="*.ts" --include="*.tsx" | grep -v routeTree
```

Si les seules occurrences sont l'écriture, la fonctionnalité n'est pas livrée.

## Avertissements de build : jamais du bruit

`Invalid param name "token.ics"` annonçait un **404 permanent** sur la route, sans faire
échouer la compilation. Lire les avertissements du build avant de conclure au succès.

Rappel connexe : une erreur de typecheck sur une route neuve est normale en local,
`src/routeTree.gen.ts` étant généré — mais vérifier qu'elle disparaît après `npm run build`,
et que la route apparaît vraiment dans le fichier généré.

## Mesurer un périmètre avant de l'annoncer

Un chiffre tiré d'un sous-dossier a déjà orienté une recommandation entière, invalidée dès
la mesure complète (« 86 occurrences » annoncées, **1092 dans 118 fichiers** en réalité).

## Proposer un test à quelqu'un

Le jeu de données doit pouvoir produire le résultat attendu. Un calendrier de jours fériés
a été proposé pour éprouver l'import de créneaux : ses 325 événements sont tous
`TRANSP:TRANSPARENT`, donc zéro était structurellement la seule réponse possible.

## Rédaction

Ne jamais déduire le genre d'un prénom (libellés, accords) : rien en base ne le renseigne
et l'inférence se trompe sur de vraies personnes.

## Livrer un changement de schéma

1. Fichier idempotent dans `supabase/migrations/AAAAMMJJHHMMSS_nom.sql`
2. Le tester sur PostgreSQL 16 local avec un stub **fidèle** (rôles `anon`,
   `authenticated`, `service_role` ; droits colonne par colonne ; UTF-8 ;
   `LC_ALL=C` sinon le serveur refuse de démarrer)
3. Commit + push
4. Demander à Lovable d'appliquer la migration
5. **Re-sonder la production** — ne jamais déduire de l'application qu'elle a produit
   l'effet voulu

Pousser un fichier `.github/workflows/` échoue avec le jeton OAuth de `gh` (portée
`workflow` absente) : passer par SSH, ou `gh auth refresh -h github.com -s workflow`.
