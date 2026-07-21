---
description: Publie/programme une proposition marketing DÉJÀ VALIDÉE par Gérald via le MCP de publication (Postiz). Refuse toute proposition non validée. Ne s'exécute jamais automatiquement.
---

# Publication d'une proposition marketing validée

> ⚠️ Cette commande est le **seul** point qui envoie du contenu vers un réseau
> social réel. Elle ne s'exécute que sur demande explicite et que sur une
> proposition dont le statut est `valide`.

## Pré-conditions (bloquantes)
1. Le MCP de publication **Postiz** doit être configuré et connecté. **Aucune clé
   API n'est activée sans l'accord explicite de Gérald** → si Postiz n'est pas
   configuré, STOP : afficher « Publication indisponible : Postiz non configuré ».
2. La proposition ciblée doit avoir le statut **`valide`** dans `marketing_proposals`
   (validation enregistrée par Gérald dans `/admin/marketing`).
   - Vérifier via la base : `select status from marketing_proposals where id = <id>`.
   - Si le statut n'est pas `valide` → **REFUSER** et ne rien publier.

## Déroulé
1. Récupérer la proposition validée (id fourni, ou la plus récente en statut `valide`).
2. Confirmer le statut `valide`. Sinon → arrêter.
3. Appeler le MCP Postiz pour **programmer** le post sur le réseau ciblé à
   l'heure suggérée (ou la date/heure convenue avec Gérald), avec la caption,
   les hashtags et le visuel/brief.
4. En cas de succès : mettre à jour la proposition → `status = 'publie'`,
   `published_at = now()`, `external_ref = <id du post Postiz>`.
5. Confirmer à Gérald : réseau, heure programmée, lien Postiz.

## Garde-fous (non négociables)
- Jamais de publication sur une proposition non `valide`.
- Jamais d'activation de clé API sans accord explicite préalable de Gérald.
- 1 publication correspond à 1 proposition validée. Pas de lot automatique.
- En cas de doute sur le statut ou la connexion Postiz → ne rien publier, demander.
