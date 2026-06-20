
## Audit de l'existant (vérifié)

**Déjà en place et fonctionnel — ne rien refaire :**

| Élément | État |
|---|---|
| Tables `crm_leads`, `crm_client_contacts`, `crm_tasks`, `crm_activities`, `crm_tags`, `crm_contact_tags`, `crm_pipelines`, `crm_stages` | ✅ créées avec colonnes complètes (notes, tags, private_notes, relation_status, last/next_booking_at, etc.) |
| RLS isolation thérapeute ↔ thérapeute | ✅ policies scoppées via `therapists.user_id = auth.uid()` ; admin lecture seule sur leads, **pas** sur `private_notes` des contacts (à vérifier) |
| Trigger `therapist_to_crm_lead` (inscription → lead auto) | ✅ activé |
| Trigger `appointment_to_crm_contact` (RDV → contact CRM auto) | ✅ activé, Elite Pro only |
| Trigger `appointment_cancel_crm` (annulation → tag "a_relancer") | ✅ activé |
| Trigger `waitlist_to_crm_lead` | ✅ activé |
| Trigger `trg_crm_plan_change` (changement de plan logué) | ✅ existe |
| Routes `/admin/crm` (Pipeline/Liste/Tâches/Relances) | ✅ 579 lignes, UI conservée |
| Route `/dashboard/crm` (CRM thérapeute) | ✅ 607 lignes, style violet sombre |
| Fonction `crm_daily_maintenance` (auto inactif 60j) | ✅ existe |

## Vrais manques détectés

1. **Backfill manquant** : 5 thérapeutes existent en base, **0 lead** dans le CRM admin. Les triggers ont été créés après leur inscription → ils n'ont jamais été remontés. Aucun n'apparaît dans `/admin/crm`.
2. **Pipeline stages demandés** : `NOUVEAU → EN ATTENTE → CONTACTÉ → ACTIF → FIDÉLISÉ → INACTIF`. L'UI actuelle utilise `new/pending/contacted/...` mais il faut vérifier que `ACTIF` et `FIDÉLISÉ` existent (sinon ajouter `active` + `loyal` aux statuts acceptés).
3. **Sécurité notes privées** : la policy admin sur `crm_client_contacts` autorise actuellement la lecture de `private_notes` (RLS `OR has_role(admin)`). Le brief demande : *"Admin can read all therapist records but cannot access individual therapist-patient notes"* → restreindre via vue publique sans `private_notes` pour l'admin, ou retirer l'accès admin sur cette table.
4. **Plan d'abonnement dans la fiche lead admin** : affichage du `subscription_plan` du thérapeute lié (déjà présent en base, juste à afficher dans la carte du pipeline).

## Plan d'action (3 étapes minimales)

### Étape 1 — Migration SQL (un seul appel)
- Backfill : insérer dans `crm_leads` une ligne pour chaque thérapeute existant sans lead (`source='inscription'`, `status` dérivé de `therapists.status`).
- Ajouter `'active'` et `'loyal'` (FIDÉLISÉ) aux statuts autorisés côté UI (pas de contrainte SQL stricte, juste docs).
- Créer une vue `crm_client_contacts_admin` exposant tout **sauf** `private_notes`, et restreindre la policy admin SELECT sur la table de base pour interdire la lecture directe des notes privées.
- Trigger auto‑promotion : passer le lead à `active` quand `therapists.status='active'` et à `loyal` après N (>=10) RDV honorés.

### Étape 2 — UI Admin CRM (`admin.crm.tsx` + `AdminCrmViews.tsx`)
- Ajouter colonnes pipeline `ACTIF` et `FIDÉLISÉ` (les autres existent déjà).
- Afficher dans chaque carte lead : badge plan (Basic / Essentiel / Elite Pro), canton, dernière activité.
- Filtre additionnel "Plan" (déjà : canton, source, recherche).
- Aucun changement de layout.

### Étape 3 — Vérifications (sans nouveau code)
- Confirmer que `/dashboard/crm` (déjà mobile/desktop, déjà violet sombre) liste bien les contacts du thérapeute connecté uniquement → test rapide en base + Playwright si besoin.
- Confirmer que l'admin connecté à `/admin/crm` voit les 5 nouveaux leads après backfill.

## Hors scope (déjà fait — ne rien toucher)
- Création des tables, RLS isolation thérapeute, triggers RDV→contact, daily maintenance, UI dashboard thérapeute, design violet sombre.

## Risques / points d'attention
- La migration backfill est idempotente (`ON CONFLICT DO NOTHING` sur `converted_therapist_id`) → safe à rejouer.
- La vue admin nécessite que tout le code admin existant lise désormais `crm_client_contacts_admin` au lieu de la table directe pour les fiches contact (à grep avant migration).

---

**Confirme ce plan et je lance l'étape 1 (migration SQL).** Si tu veux que j'ignore la restriction sur les notes privées admin (point 3 — vue séparée), dis‑le, ça simplifie la migration.
