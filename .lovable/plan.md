# Refonte page « Mon profil » thérapeute

## Objectif
Reproduire le design premium des captures (photo + recadrage, identité/adresse, spécialités recherchables avec ajout custom, services & durées multiples, fourchette de tarifs, SIRET, certificats/diplômes) et tout traduire dans la langue choisie. Étendre les spécialités à ~50 thérapies et lister les 26 cantons suisses.

## Sections de la page (ordre vertical)

1. **Identité & contact** : photo (upload + recadrage carré), prénom*, nom*, ville*, code postal, adresse, téléphone (avec note de confidentialité).
2. **Approches & langues** : canton (26), langues parlées (FR/DE/IT/EN), tarif/séance OU fourchette min/max + devise.
3. **Spécialités** : barre de recherche, chips des sélectionnées, grille de boutons (sélectionnés en violet/coché), input « Ajouter une spécialité personnalisée » + bouton Ajouter.
4. **Mes services & durées** : liste de services (nom, durée min, description), boutons ajouter/modifier/supprimer (dialog).
5. **Bio courte (150 car.)** + **Description complète** (textarea), **Lien Google avis**, **Lien site personnel**, **Années d'expérience**.
6. **N° SIRET** (optionnel, masqué) + bouton Vérifier (placeholder visuel pour l'instant).
7. **Mes certificats & diplômes** : upload PDF/JPG/PNG (5 Mo), liste avec nom modifiable, toggle visible aux visiteurs, supprimer.
8. Footer sticky : Annuler / Enregistrer.

## Données

Le schéma `therapists` couvre déjà : first_name, last_name, address, postal_code, city, canton, phone, email, website, specialties, languages, price_min, price_max, currency, bio, short_bio, photo_url.

Nouvelle migration nécessaire pour :
- `services jsonb` (liste `{name, duration_min, description, color}`)
- `years_experience int`
- `google_reviews_url text`
- `siret text` (chiffré côté app — stocké brut pour MVP, non exposé via la policy publique : on retirera siret de la projection publique)
- `siret_verified boolean default false`
- table `therapist_documents` (id, therapist_id, file_url, label, is_public, created_at) avec bucket Storage `therapist-documents`.

## i18n

Ajout d'un namespace `profile_edit` complet dans fr/de/en/it avec toutes les labels (titres sections, placeholders, boutons, helpers, toasts). Le menu sidebar reste branché sur `dashboard.*` (déjà traduit) ; le dashboard layout doit se trouver sous `/$lang/dashboard` pour propager la langue — actuellement il est sur `/dashboard` sans préfixe. **Décision** : on garde `/dashboard` mais on lit la langue depuis `i18n.language` (déjà setté par la route `$lang`) — la sidebar utilise donc déjà `t()`, donc OK. Si la langue n'est pas appliquée, c'est que l'utilisateur arrive directement sur `/dashboard` sans passer par `/$lang/...`. On ajoutera un effet dans `dashboard.tsx` qui lit `localStorage` ou le détecte via le referrer pour fixer la langue.

## Constantes

- `SWISS_CANTONS` : 26 cantons avec code + nom (AG, AI, AR, BE, BL, BS, FR, GE, GL, GR, JU, LU, NE, NW, OW, SG, SH, SO, SZ, TG, TI, UR, VD, VS, ZG, ZH).
- `THERAPY_SPECIALTIES` : ~50 thérapies holistiques (énergéticien, magnétiseur, sophrologue, hypnothérapeute, naturopathe, ostéopathe, réflexologue, kinésiologue, acupuncteur, shiatsu, reiki, lithothérapeute, radiesthésiste, médium, cartomancie, coach holistique, art-thérapeute, aromathérapeute, phytothérapeute, fleurs de Bach, méditation, yoga thérapeutique, ayurveda, massage californien/suédois/thaï/lomi-lomi, drainage lymphatique, réflexologie plantaire, fasciathérapie, biorésonance, EFT, EMDR, PNL, somatothérapie, gestalt, analyse transactionnelle, constellation familiale, hypnose ericksonienne, respiration holotropique, sound healing, chamanisme, soins esséniens, biomagnétisme…).

## Fichiers à créer/modifier

- `src/lib/constants.ts` : exporter `SWISS_CANTONS`, `THERAPY_SPECIALTIES`.
- `src/i18n/[lang].json` : ajouter namespace `profile_edit`.
- Migration SQL pour `services`, `years_experience`, `google_reviews_url`, `siret`, `siret_verified`, table `therapist_documents`, bucket `therapist-documents`.
- `src/routes/dashboard.profil.tsx` : refonte complète multi-sections.
- (optionnel) sous-composants dans `src/components/dashboard/profile/` pour photo, spécialités, services, documents.

## Sécurité

- RLS sur `therapist_documents` : owner full CRUD, public SELECT uniquement si `is_public = true`.
- Validation Zod côté client (lengths, regex, max files).
- Bucket Storage : règles owner only.

## Hors scope (pour ne pas exploser le delivery)

- Vraie vérification SIRET via API officielle → bouton présent mais stub (badge « Statut Pro actif » apparaît si siret rempli + 14 chiffres).
- Recadrage d'image avancé → on garde un upload simple avec preview + bouton remplacer (le recadrage interactif arrivera dans un 2ème temps).
- Lien Google reviews scraping → simple champ URL.

Confirme-moi si je peux partir comme ça, ou si je dois ajuster (par ex. retirer SIRET/certificats pour un premier jet plus rapide, ou inclure tout de suite le recadrage interactif).
