# Migration i18n complète — Plan d'exécution

## État actuel

- **Infra OK** : `i18next` + `react-i18next` déjà configurés (`src/lib/i18n.ts`), 4 fichiers de langue présents (`fr/de/en/it.json`), `useTranslation()` déjà utilisé dans ~30 fichiers.
- **Problème réel** : textes en dur dans une partie des composants (ex. `WaitlistBanner`, `WaitlistReassuranceBlock` 100% français), pas de détection des clés manquantes, pas d'audit systématique.

Vu l'ampleur (60+ fichiers à auditer), je propose une exécution en **4 lots livrables séparément** plutôt qu'un méga-changement risqué.

---

## Lot 1 — Quick wins visibles + outillage (immédiat, ce tour)

1. **Traduire les blocs liste d'attente** (cités explicitement) :
   - `WaitlistBanner.tsx` → clés `waitlist.banner.*`
   - `WaitlistReassuranceBlock.tsx` → clés `waitlist.reassurance.*`
   - Ajouter les 4 langues dans `fr/de/en/it.json`.

2. **Détection des clés manquantes** dans `src/lib/i18n.ts` :
   - Activer `saveMissing: true` + `missingKeyHandler` qui `console.warn` en dev.
   - Conserver le fallback `fr` existant.

3. **Helper de scan** : script `scripts/i18n-audit.ts` (Node) qui parcourt `src/**/*.tsx`, détecte les chaînes JSX/attributs visibles non interpolées et liste les fichiers à migrer (sortie triée par nombre d'occurrences).

## Lot 2 — Composants partagés (priorité haute)

Ordre :
- `components/layout/` : `Footer`, `PublicNav`, `TherapistNav`, `AdminNav` (sous-menus, items conditionnels)
- `components/holiswiss/` : `TherapistCard`, `PagePlaceholder`, `NearbyTherapistsSwiss`, `WaitingListPopup`
- `components/booking/BookingWidget`
- `components/dashboard/` : `AccountManageDialog`, `WeeklyScheduleEditor`, `UnavailabilityManager`

Pour chaque fichier : repérer toutes les chaînes affichées (texte, `aria-label`, `placeholder`, `title`, messages d'erreur, toasts), créer des clés sous le namespace du composant, remplacer par `t('...')`, ajouter les 4 traductions.

## Lot 3 — Routes publiques

`$lang.index`, `$lang.therapeutes.index`, `$lang.therapeute.$slug`, `$lang.tarifs.index`, `$lang.contact.index`, `$lang.inscription.index`, `$lang.connexion.index`, `$lang.blog.*`, `$lang.tsx` (banner inclus).

Vérification systématique : titres SEO (`head()`), badges, CTA, états vides/erreur, modals déclenchés depuis ces pages.

## Lot 4 — Dashboard thérapeute

`dashboard.*` : index, profil, agenda, avis, abonnement, parrainage, dashboard.tsx (layout). Inclut les bouts du bloc d'onboarding récent, toasts, validation de formulaires, modals (suppression/pause de compte).

---

## Convention de clés (appliquée dès le lot 1)

```text
{scope}.{component}.{element}
ex : waitlist.banner.message
     waitlist.reassurance.title
     dashboard.account.delete.confirm
     therapist.booking.chooseService
```

- Un namespace par grande zone (`nav`, `home`, `therapist`, `dashboard`, `waitlist`, `auth`, `common`).
- `common.*` réservé aux libellés vraiment partagés (Annuler, Enregistrer, Erreur, etc.).
- Pas d'imbrication >4 niveaux.

## Détails techniques

- **Pas de modif** de `src/integrations/supabase/*` ni `routeTree.gen.ts` (auto-généré).
- Traductions DE/EN/IT : générées par moi avec relecture courte, gardées sobres et professionnelles. Si une formulation vous semble inadaptée, vous me dites et je corrige par lot.
- Le `missingKeyHandler` est désactivé en production (`import.meta.env.DEV`) pour ne pas polluer le console réel.
- Les `aria-label` et messages `toast` sont inclus dans le scope i18n.

## Livraison

Je commence par le **Lot 1** maintenant si vous validez. Les lots 2/3/4 viennent après votre go (ils ouvrent chacun ~15-25 fichiers et méritent un commit séparé pour pouvoir relire les traductions).
