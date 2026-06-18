## Objectif

Mettre en place un CRM premium dans Holiswiss avec deux périmètres :
1. **CRM Admin** (rubrique du dashboard `/admin/crm`)
2. **CRM Thérapeute** (rubrique du dashboard pro `/dashboard/crm`), accessible uniquement aux comptes `plan = elite_pro` (teaser verrouillé sinon).

Style : cohérent avec l'admin SEO/GEO existant (dark violet, glassmorphism subtil, framer-motion sobre, Lucide icons, design tokens sémantiques uniquement).

---

## Étape 1 — Fondations base de données + accès

### Tables (migration unique, RLS + GRANT)

- `crm_leads` — leads thérapeutes (avant inscription)
  - `first_name`, `last_name`, `email`, `phone`, `canton`, `specialty`, `source` (form/landing/import/manual), `status` (`new`/`pending`/`contacted`/`followup`/`converted`/`elite_pro`/`suspended`), `assigned_to` (uuid admin), `notes`, `priority` (`low`/`normal`/`high`), `last_contact_at`, `converted_therapist_id` (FK therapists nullable)
- `crm_activities` — timeline polymorphique
  - `entity_type` (`lead`/`therapist`/`client_contact`), `entity_id`, `owner_id` (uuid auteur), `type` (`email`/`call`/`note`/`status_change`/`task`/`booking`/`review`/`message`), `title`, `body`, `metadata jsonb`, `occurred_at`
- `crm_tasks` — rappels et tâches
  - `owner_id`, `entity_type`, `entity_id`, `title`, `description`, `due_at`, `done_at`, `priority`
- `crm_client_contacts` — carnet client du thérapeute Elite Pro
  - `therapist_id` (FK therapists, owner), `first_name`, `last_name`, `email`, `phone`, `session_type`, `relation_status` (`prospect`/`new`/`active`/`followup`/`inactive`), `tags text[]`, `last_booking_at`, `next_booking_at`, `private_notes`

### RLS

- **Admin tables** (`crm_leads`, `crm_activities` côté admin, `crm_tasks` côté admin) : accès via `has_role(auth.uid(),'admin')`.
- **`crm_client_contacts`** + activities/tasks scoped therapist : `therapist_id = (select id from therapists where user_id = auth.uid())`. Service role full pour seeding/admin.
- GRANT explicites `authenticated` + `service_role` sur chaque table (jamais `anon`).

### Accès Elite Pro

- Helper SQL `is_elite_pro(_user_id uuid) returns boolean` (security definer) : lit `therapists.subscription_plan = 'elite_pro'` (vérifier le nom exact de la colonne via `read_query` avant la migration).
- Server function `useElitePro` côté thérapeute pour gate UI.

---

## Étape 2 — CRM Admin (`/admin/crm`)

Route : `src/routes/admin.crm.tsx` + entrée dans `AdminNav`.

### Layout (3 zones, responsive)
```text
┌───────────────────────────────────────────────────────┐
│ Header : recherche globale + filtres avancés + KPIs   │
├──────────────┬────────────────────────┬───────────────┤
│ Pipeline     │ Liste / fiche détaillée│ Sidebar :     │
│ Kanban       │ (drawer ou colonne)    │ tâches,       │
│ (7 colonnes) │                        │ rappels,      │
│              │                        │ alertes       │
└──────────────┴────────────────────────┴───────────────┘
```

### Composants
- **KPIs en-tête** : leads ce mois, taux de conversion, Elite Pro actifs, relances en retard.
- **Recherche globale** debouncée (nom, email, canton, spécialité).
- **Filtres** : statut, plan d'abonnement, canton, spécialité, période d'inscription, source.
- **Kanban** drag-and-drop léger (framer-motion `Reorder` ou simple boutons "déplacer") avec colonnes : new / pending / contacted / followup / converted / elite_pro / suspended. Carte = nom + canton + badge priorité + date dernier contact.
- **Fiche détaillée** (drawer Sheet) :
  - infos profil + statut validation + plan actif
  - timeline `crm_activities` (filtrable par type)
  - notes internes (textarea avec save)
  - liens vers articles/événements/réservations/avis du thérapeute s'il est converti
  - actions : changer statut, assigner admin, ajouter note, créer tâche
- **Sidebar** : mes tâches du jour, rappels en retard (rouge pulse), alertes auto (ex: lead inactif >14j).

### Server functions (`src/lib/crm.functions.ts`)
- `listLeads({ search, filters, status })`
- `getLeadDetail(id)` → lead + activities + tasks + therapist lié
- `updateLeadStatus(id, status)` + log auto dans activities
- `addNote(entityType, entityId, body)`
- `createTask({...})` / `completeTask(id)`
- `assignLead(id, adminId)`

Toutes protégées par `requireSupabaseAuth` + check `has_role admin`.

---

## Étape 3 — CRM Thérapeute Elite Pro (`/dashboard/crm`)

Route : `src/routes/dashboard.crm.tsx` + entrée dans `TherapistNav`.

### Gate Elite Pro
```tsx
const { isElitePro } = useElitePro();
if (!isElitePro) return <ElitePropTeaser />;
```
Teaser : card glassmorphism, icône Crown, titre "CRM Elite Pro", texte court, CTA "Passer à Elite Pro" → `/dashboard/abonnement`. L'entrée du nav reste visible mais badge "Elite" doré.

### Fonctionnalités
- **Vue switcher** Tableau / Cartes (toggle, animation fade).
- **Recherche + filtres** : statut relation, tags, période dernière réservation.
- **Fiche contact** (drawer) :
  - identité, email, téléphone, type de séance
  - dernière + prochaine réservation (liées à `appointments` quand `email`/`phone` matche, sinon manuel)
  - statut relation (select : prospect/new/active/followup/inactive)
  - tags multi-select (chips colorés : stress, sommeil, énergétique, fidélisation, VIP, custom)
  - notes privées (markdown light)
  - timeline : réservations + annulations (depuis `appointments`), avis laissés (`reviews`), notes du thérapeute
  - rappels personnalisés (createTask scope therapist) — preset "Relancer dans 7j" / "Reprendre contact" / "Proposer nouvelle séance"
- **Vue tableau** : tri colonnes, badge statut coloré, dernière réservation, prochain rappel.
- **Vue cartes** : grille responsive, avatar initiales, statut + tags visibles.

### Server functions (`src/lib/crm-therapist.functions.ts`)
- `listMyContacts({ search, status, tags })`
- `getContactDetail(id)` → contact + activities + tasks + bookings/reviews liés (par email)
- `upsertContact(payload)` / `deleteContact(id)`
- `addContactNote(id, body)` / `setRelationStatus(id, status)` / `setTags(id, tags[])`
- `createReminder({ contactId, preset|dueAt, title })`

Toutes scopées `therapist_id = current`.

---

## Détails techniques transverses

- **Styles** : réutiliser tokens `src/styles.css` + `admin-design-system.css`. Aucune couleur en dur.
- **Animations** : framer-motion `AnimatePresence` + `motion.div` stagger 60ms ; `prefers-reduced-motion` respecté (déjà global).
- **Icônes** : Lucide (`Users`, `Inbox`, `Workflow`, `KanbanSquare`, `Bell`, `Crown`, `Tag`, `CalendarClock`).
- **Accessibilité** : `aria-label` sur boutons icône, focus rings visibles, drawer trap focus (shadcn Sheet), targets ≥44px.
- **Performance** : TanStack Query `ensureQueryData` dans loaders `_authenticated` ; pagination côté serveur pour leads/contacts (limit 50).
- **Aucune régression** sur SEO/GEO ou pages publiques — toutes les routes ajoutées sont sous `/admin/*` ou `/dashboard/*`.

---

## Livraison en 3 commits logiques

1. **Migration + server functions admin + types** (étape 1 + base étape 2).
2. **Route `/admin/crm` complète** (UI + Kanban + drawer + sidebar).
3. **Route `/dashboard/crm` + teaser Elite Pro + server functions therapist**.

Validation finale : build OK, `linter` Supabase clean, navigation visible dans les deux dashboards, gate Elite Pro testée avec un compte sans plan.
