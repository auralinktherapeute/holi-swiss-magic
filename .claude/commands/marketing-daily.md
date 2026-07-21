---
description: Produit LA proposition de publication réseaux sociaux du jour pour Holiswiss (pipeline Stratège → Copywriter → Designer → QA), puis la soumet à validation. Ne publie jamais rien.
---

# Production de la proposition marketing du jour

Objectif : produire **une seule** proposition de publication de qualité, prête à être **validée par Gérald**. Cible = thérapeutes suisses à recruter (B2B). **Aucune publication réelle n'est envoyée par cette commande.**

Déroule le pipeline dans cet ordre, en passant le résultat de chaque agent au suivant :

1. **Stratège** (`marketing-stratege`) → brief du jour (réseau, pilier, angle, format, objectif, message clé, heure suggérée). Il lit `marketing/proposals/` pour éviter les répétitions.
2. **Copywriter** (`marketing-copywriter`) → caption finale + hashtags (FR / DE-CH), texte par slide/script si besoin.
3. **Designer** (`marketing-designer`) → brief visuel détaillé + prompt génératif + ratio d'export.
4. **Contrôleur qualité** (`marketing-qa`) → checklist complète. Si ❌ → renvoie à l'agent concerné et recommence ce maillon. Si ✅ → assemble la proposition finale au **format de notification** (voir `marketing/MARKETING.md`).

## Sortie

- Écris la proposition validée par le QA dans `marketing/proposals/AAAA-MM-JJ-<reseau>.md` avec l'en-tête `statut: en_attente_validation`.
- Affiche la proposition dans la conversation au format de notification lisible.
- **Intégration admin (Couche 2, quand disponible)** : insère la proposition dans la table Supabase `marketing_proposals` (statut `en_attente_validation`) et déclenche `admin-notify` (email + WhatsApp). La validation se fait ensuite dans `/admin/marketing`.

## Garde-fous (non négociables)

- Ne contacte AUCUN réseau social, n'appelle AUCUN outil de publication (Postiz…).
- La proposition reste `en_attente_validation` tant que Gérald n'a pas répondu. Sans réponse → jamais publiée.
- La publication réelle est déclenchée séparément (`/marketing-publish`) **uniquement** après validation enregistrée de Gérald.
- 1 proposition/jour maximum. Qualité > volume.
