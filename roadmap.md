# Reconstruction rendez-vous

- [x] Auditer le schéma, les routes, les requêtes, les statuts et la RLS
- [x] Réparer la synchronisation rendez-vous → client et l'audit des statuts
- [x] Corriger les rendez-vous historiques mal rattachés ou non rattachés
- [x] Reconstruire le détail Agenda avec statuts, client et facturation
- [x] Compléter Réservations avec annulation motivée, absent et accès client
- [ ] Vérifier Agenda, Clients et facturation avec la session réelle
- [x] Contrôler build, sécurité et rapport final

# Lot SEO/GEO technique (autorisé le 16/09/2026, sans publication)

- [x] Sitemap : Fil Holiswiss, page sophrologie (lettres écartées : sans contenu SSR ni titre unique, donc non indexables)
- [x] Héritage Twitter/OG du layout racine + image de partage stable
- [x] Voix d'experts : Article complet + Breadcrumb + OG/Twitter
- [x] Fil Holiswiss : publisher, mainEntityOfPage, @id, Breadcrumb
- [x] Événements : Breadcrumb, inLanguage, organizer @id
- [x] Blog : titre sûr + graphie de marque dans les métadonnées
- [x] Spécialités et familles : CollectionPage + ItemList + Twitter/OG
- [x] Robots : groupes explicites uniquement si exclusions identiques
- [x] Tests, typecheck, build, seo:check, sitemap avant/après, SSR 4 langues
- [x] Carte : clé CARTO sur l'URL des tuiles (TherapistMapInner)
- [x] Agent Automation phases 0+1

# Étape 1/7 — corrections critiques (aperçu, 07/10/2026)

- [x] A1–A5 régressions surveillance (profil, indexation, guide, langue, logos)
- [x] B anciennes adresses → 301 + liens d'articles réécrits
- [x] C vraies 404 noindex,follow sans canonique ni données structurées
- [x] D pages d'accès noindex,follow + robots.txt
- [ ] Outil d'indexation : nouvelle version à déployer (attend l'accord de Gérald)

# Étape 2/7 — multilingue (aperçu, 07/10/2026)

- [x] Audit matrice, Fil localisé, balises de partage, Contact EN, tests
- [ ] Décision : profils / Voix d'experts / événements multilingues autonomes (attend Gérald)

# Étape 4B — identité institutionnelle (aperçu uniquement)

- [x] Créer À propos FR/DE/IT/EN et son référencement, liens et sitemap
- [x] Corriger identité légale, avertissements et Organization
- [x] Rectifier les affirmations institutionnelles sensibles et la graphie des pages publiques et modèles futurs, sans changer les données des praticiens
- [x] Tester les pages publiques et produire le rapport, sans publication ni écriture : 98 tests ciblés et 706 tests complets réussis ; 20 pages contrôlées ordinateur/mobile
- [ ] Harmonisation complémentaire éventuelle dans les zones protégées exclues et documents historiques : nécessite de concilier les contraintes de préservation

## Étape 5B (aperçu)
- [x] Lecture serveur du suivi d'indexation, métriques datées, vue « Ma page publique », score vitrine unique
- [ ] Contrôle visuel connecté admin/thérapeute — attend un compte de test admin et thérapeute
- [ ] Publication puis redéploiement de run-indexation — attend ton accord
- [ ] Fermeture lecture publique du projet dédié + RPC à PIN + écran Améliorations SEO encore lu depuis le navigateur — attend un accès en écriture séparé

# Étape 6B — performance et robots (aperçu)

- [ ] Vérifier le redimensionnement réel des images signées avec repli sûr
- [ ] Optimiser les images thérapeutes et événement sans remplacer les sources
- [ ] Ajouter le logo léger et le favicon
- [ ] Ajouter noindex,nofollow aux espaces privés et compléter robots.txt
- [ ] Stabiliser les deux zones visuelles mesurées
- [ ] Ajouter les tests ciblés, lancer tous les contrôles et le crawl des 358 URL
- [ ] Contrôler visuellement les sept familles ordinateur/mobile et mesurer les écarts
