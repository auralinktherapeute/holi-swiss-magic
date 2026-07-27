# HoliSwiss — contexte projet

> ⚠️ Ne pas confondre avec **HoliSource** (annuaire Alsace, Supabase `dqmuj…`, tables en français
> `therapeutes`). C'est un **autre projet**. Ici tout est en anglais : `therapists`, `reviews`, `articles`.

---

## 🚨 RÈGLE N°1 — DEUX BASES SUPABASE, NE PAS SE TROMPER DE CIBLE

| | Projet | Rôle | Accès |
|---|---|---|---|
| **PRODUCTION** | **`qqwudmnfavvaukuldulr`** | **Ce que holiswiss.ch sert vraiment.** Vrais inscrits, vrais articles. | Lecture : REST anon (clé dans `.env`). **Écriture : via Lovable uniquement.** |
| Bac à sable | `gpldaaqwvwopttachrma` | Prototypes + archives des agents Python. **Invisible du site.** | MCP Supabase (lecture/écriture) |

**Le piège :** l'outil MCP Supabase est branché sur `gpld`. C'est le chemin de moindre effort — et c'est
**la mauvaise base** pour toute fonctionnalité destinée au site. Une feature construite sur `gpld`
n'apparaîtra jamais en production (erreur commise le 26/07/2026, une journée perdue).

`qqwud` **n'appartient pas au compte Supabase de Gérald** (il est détenu par Lovable) : il n'apparaît pas
dans `list_projects` et **aucune permission ne peut être accordée**. Ce n'est pas contournable.

### Avant toute fonctionnalité touchant la base — vérifier, jamais présumer

```bash
# La colonne existe-t-elle en PROD ? 200 = oui, 400 = non, 404 = table absente
KEY=$(grep -hE '^SUPABASE_PUBLISHABLE_KEY=' .env | sed -E 's/.*="//;s/".*//')
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://qqwudmnfavvaukuldulr.supabase.co/rest/v1/therapists?select=<colonne>&limit=1" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

**Les deux schémas divergent réellement** — quelques pièges avérés :

| | PROD `qqwud` | `gpld` (ne pas copier) |
|---|---|---|
| Avis | `comment`, `author_name`, `status='approved'` | `body`, `title`, `validated`/`published` |
| Thérapeute | `bio`, `verified`, `price_min`, `subscription_plan`, `consultation_modes` | `description`, `is_premium`, `modalite` |
| Autres | `availabilities`, `appointments`, `therapist_articles` | `disponibilites`, `rendez_vous`, `subscriptions`, `indexed_urls` |

### Livrer un changement de schéma en production

1. Écrire un fichier idempotent dans `supabase/migrations/AAAAMMJJHHMMSS_nom.sql`
2. **Le tester** sur un PostgreSQL local (`/usr/local/opt/postgresql@16`) avec un stub du schéma qqwud —
   créer les rôles `anon`, `authenticated`, `service_role`, sinon les `GRANT` échouent
3. Commit + push
4. Demander à **Lovable** : « Applique la migration `supabase/migrations/<fichier>.sql` »

Contraintes de l'outil Lovable : il **refuse les écritures dans `storage.buckets`** (créer les buckets via
son outil dédié ; les policies sur `storage.objects` passent). Il faut des **`GRANT` explicites** sur toute
nouvelle table, sinon la Data API renvoie une erreur de permission.

### Sécurité — réflexe obligatoire

PostgreSQL accorde `EXECUTE` à `PUBLIC` **par défaut** sur toute fonction. Un `GRANT` explicite ne
retire pas ce droit. Toute fonction `SECURITY DEFINER` doit donc être explicitement révoquée :

```sql
revoke execute on function public.ma_fonction() from public, anon, authenticated;
grant  execute on function public.ma_fonction() to service_role;
```

Exception : les helpers appelés **dans les policies RLS** (ex. `is_admin()`) doivent rester exécutables,
sinon la RLS casse.

---

## Stack

TanStack Start + React + Tailwind · Supabase · déploiement **Lovable + GitHub** (jamais Netlify).
Serveur : `createServerFn().middleware([requireSupabaseAuth]).handler(...)`, garde admin via
`assertAdmin(context.userId)` (table `user_roles`), service-role via `supabaseAdmin`
(`@/integrations/supabase/client.server`) qui contourne la RLS.

`src/routeTree.gen.ts` est **généré** : une erreur de typecheck sur une route neuve est normale en local,
elle disparaît au build Lovable. Ne pas l'éditer à la main.

## Vérifier ce que la production affiche réellement

Ne pas déduire du code — regarder. `curl` est bloqué par Cloudflare (erreur 1010) sans User-Agent de
navigateur ; les outils de navigation intégrés fonctionnent directement.

## Git

Le dépôt contient souvent du travail local en cours (ex. Délégation : `admin.delegation.tsx`,
`supabase/functions/`, `AdminNav.tsx`). **Committer chirurgicalement**, fichier par fichier — jamais
`git add -A`. Lovable pousse aussi de son côté (`routeTree.gen.ts`, `package.json`, `bun.lock`) :
en cas de rejet du push, `git stash` → `pull --rebase` → `push` → `stash pop`.
