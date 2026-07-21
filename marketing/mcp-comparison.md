# Étape 1 — Comparaison des serveurs MCP de publication (choix : Postiz)

> Objectif : publier sur Instagram / LinkedIn / TikTok avec un **flux d'approbation
> humaine obligatoire**, sans publication automatique, à coût maîtrisé.
> ⚠️ Rien n'est installé ni connecté sans l'accord explicite de Gérald (aucune clé API activée).

## Rappel important sur le « flux d'approbation »
Dans notre architecture, la barrière de validation n'est **pas** déléguée au MCP :
elle est **imposée par Holiswiss lui-même** — l'équipe d'agents produit une
proposition → statut `en_attente_validation` → Gérald valide dans `/admin/marketing`
→ seul `/marketing-publish` (sur une proposition `valide`) appelle le MCP.
Le MCP n'a donc besoin que de **créer un brouillon / programmer un post**. Cela nous
rend indépendants du fait que le MCP ait, ou non, sa propre file d'approbation.

## Les 3 options comparées

### 1. Postiz — ✅ RETENU
- **Nature** : outil open-source de programmation multi-réseaux (auto-hébergeable ou cloud).
- **Réseaux** : Instagram, LinkedIn, TikTok, X, Facebook, YouTube, Threads, Mastodon, Bluesky…
- **MCP** : serveur MCP officiel/communautaire disponible (création + programmation de posts).
- **Approbation** : notion de brouillon + calendrier ; rien ne part tant qu'un post n'est pas
  explicitement programmé/publié. Combiné à notre garde `valide`, double verrou.
- **Coût / contrôle** : open-source → pas de coût par post, données maîtrisées, auto-hébergeable.
- **Limites** : nécessite de connecter les comptes sociaux (tokens) et, pour IG/TikTok, de
  passer par leurs API officielles (comptes pro/business requis).

### 2. Metricool — serveur MCP officiel
- **Nature** : SaaS d'analytics + programmation multi-réseaux, MCP officiel.
- **Réseaux** : IG, LinkedIn, TikTok, etc. + très bons analytics.
- **Approbation** : planification via l'UI Metricool ; workflow d'approbation surtout sur les
  offres d'équipe (payantes).
- **Coût / contrôle** : SaaS payant, données chez Metricool.
- **Pourquoi non retenu (pour l'instant)** : payant, moins « souverain » que Postiz ; excellent
  si vous voulez des analytics poussés plus tard.

### 3. Buffer — MCP communautaire
- **Nature** : SaaS de programmation, réputé pour son **workflow brouillon → approbation** natif.
- **Réseaux** : IG, LinkedIn, TikTok, etc.
- **Approbation** : le plus abouti nativement (rôles, brouillons à approuver).
- **Coût / contrôle** : SaaS payant ; MCP non officiel (communautaire), donc dépendance.
- **Pourquoi non retenu (pour l'instant)** : payant + MCP tiers non officiel ; son atout
  (approbation native) est déjà couvert par notre propre garde `valide`.

## Justification du choix : Postiz
1. **Souveraineté & coût** : open-source, auto-hébergeable, pas de coût par publication.
2. **Couverture** : gère nativement les 3 réseaux cibles (IG / LinkedIn / TikTok).
3. **MCP disponible** : création/programmation de posts pilotables par l'agent.
4. **Sécurité** : la publication réelle reste doublement verrouillée (notre statut `valide`
   + action explicite de programmation dans Postiz).
5. **Évolutif** : si un jour vous voulez des analytics, on pourra ajouter Metricool en lecture.

## Ce qu'il reste à faire (avec votre accord explicite, pas avant)
1. Choisir : Postiz **cloud** (rapide) ou **auto-hébergé** (souverain).
2. Connecter les comptes IG (Business) / LinkedIn (Page) / TikTok à Postiz.
3. Récupérer la clé API Postiz → la placer dans les secrets (jamais dans le repo public).
4. Déclarer le MCP Postiz dans la config Claude Code.
→ Tant que ce n'est pas fait, `/marketing-publish` affiche « Postiz non configuré » et ne publie rien.
