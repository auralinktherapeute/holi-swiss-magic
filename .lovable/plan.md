# Étape 4 — Admin Panel complet

## Vue d'ensemble

Construction d'un back-office admin dark (#07040f) sécurisé par rôle, accessible aux seuls utilisateurs `role='admin'`. Les routes `/admin/*` existent déjà partiellement — on les complète, on harmonise le thème, on branche Supabase, et on ajoute la sécurité.

## 1. Sécurité & rôles (backend)

Migration Supabase :
- Enum `app_role` (`admin`, `moderator`, `therapist`, `user`)
- Table `user_roles` (user_id, role, unique) + GRANT + RLS
- Fonction `has_role(uuid, app_role)` SECURITY DEFINER
- RLS : un user lit ses propres rôles ; admin lit tout
- Seed : possibilité d'attribuer manuellement un rôle admin via SQL après coup

ServerFn `getMyRoles` (avec `requireSupabaseAuth`) → renvoie les rôles de l'utilisateur courant. Utilisé par le guard du layout admin.

## 2. Layout admin (route `/admin`)

`src/routes/admin.tsx` :
- Guard côté client : vérifie via `getMyRoles` que l'utilisateur a `admin`, sinon redirect `/fr/`
- Force le thème dark (classe `dark` + background #07040f)
- Sidebar fixe (déjà existante `AdminNav`) — à harmoniser :
  - Bg `#0f0a1e`, border-right `rgba(255,255,255,0.08)`
  - Logo lotus + "Holiswiss" violet `#b86ef9`
  - Nav items (déjà bons) + badge rouge dynamique sur Modération (compte items en attente)
  - Bottom : avatar admin (initiale email) + email + bouton déconnexion fonctionnel

## 3. Pages admin

### `/admin` — Vue d'ensemble
Remplace le placeholder. KPI cards (surface `#160d2b`, border violet 20%) :
- Total thérapeutes / Actifs / En attente
- Réservations ce mois (table `appointments`)
- Revenus abonnements (placeholder — pas de table subs)
- Nouveaux inscrits 7j

Sparklines Recharts par KPI + listes "5 dernières inscriptions" et "5 dernières réservations" lues depuis Supabase via serverFn.

### `/admin/therapeutes`
Refonte de la page existante pour lire la vraie table `therapists` :
- Colonnes : nom, email, canton, plan, statut, date inscription, actions
- Filtres : statut, plan, canton
- Actions avec modals AlertDialog : Valider / Rejeter (textarea raison) / Suspendre / Voir profil (`/fr/therapeute/:slug`)
- Pagination 20/page (offset/limit côté serverFn)
- Mutations via serverFn admin → met à jour `therapists.status`

### `/admin/moderation`
Tabs Avis / Articles / Signalements (mock — tables non existantes), avec badge count dans sidebar lu via channel realtime (placeholder pour l'instant, mock count). Garde la maquette actuelle mais branche pour realtime quand tables disponibles.

### `/admin/utilisateurs`
Remplace placeholder. ServerFn admin (`supabaseAdmin.auth.admin.listUsers()`) → table : email, rôle (depuis `user_roles`), créé le, dernière connexion, statut.
Actions : changer rôle (select), suspendre (`auth.admin.updateUserById ban_duration`), supprimer (`auth.admin.deleteUser`).

### `/admin/abonnements`
Garde la maquette mock actuelle (Stripe non connecté) + ajoute donut chart répartition par plan (Recharts).

### `/admin/parametres`
Remplace placeholder. Formulaire mock (pas de table settings) avec champs : nom site, email contact, URL prod, prix Free/Pro/Premium, toggle maintenance, durée rétention RGPD. Persistance dans `localStorage` pour la démo, banner "données locales".

## 4. Détails techniques

- ServerFn admin : utilise `supabaseAdmin` (import dynamique dans le handler) après avoir vérifié `requireSupabaseAuth` + `has_role(userId, 'admin')` côté DB
- Helpers : `src/lib/admin.functions.ts` regroupe `listTherapistsAdmin`, `updateTherapistStatus`, `listUsersAdmin`, `updateUserRole`, `getAdminStats`
- UI : composants existants shadcn (Table, AlertDialog, Badge, Tabs, Select, Card)
- Charts : `recharts` (déjà installé)
- Palette dark appliquée via le wrapper `<div className="dark">` du layout + classes Tailwind avec tokens existants (`bg-background`, `bg-card`) — pas de hex hardcodés dans les composants ; on ajoute les overrides via variables CSS si besoin sur le scope `.dark` du layout admin

## 5. Étapes d'exécution

1. Migration `user_roles` + `has_role` + RLS
2. Attendre approbation migration
3. `src/lib/admin.functions.ts` (serverFns)
4. `admin.tsx` (guard + layout harmonisé)
5. `admin.index.tsx` (vue d'ensemble)
6. `admin.therapeutes.tsx` (refonte Supabase)
7. `admin.utilisateurs.tsx`
8. `admin.abonnements.tsx` (ajout donut)
9. `admin.parametres.tsx`
10. Ajustements modération (badge count + tabs)

## Note importante

Pour tester le panel après déploiement, il faudra **attribuer manuellement le rôle admin** à votre compte via SQL :
```sql
INSERT INTO user_roles (user_id, role) VALUES ('<votre-user-id>', 'admin');
```
Je vous fournirai votre user_id après création du compte, ou on peut ajouter une UI dans `/admin/utilisateurs` pour qu'un premier admin (créé via SQL) puisse en promouvoir d'autres.
