# Holiswiss — Équipe marketing autonome (réseaux sociaux)

> Équipe d'agents Claude Code qui **propose** chaque jour une publication réseaux
> sociaux pour recruter des thérapeutes suisses. **Rien n'est publié sans la
> validation explicite de Gérald.**

## 🎯 But
Recruter des **thérapeutes indépendants suisses** (B2B) sur Holiswiss via Instagram,
LinkedIn, TikTok. Ton chaleureux, éducatif, preuve sociale. Cible = les thérapeutes,
**jamais** les clients finaux.

## 👥 L'équipe (4 agents, rôles séparés)
| Agent | Fichier | Rôle |
|---|---|---|
| Stratège | `.claude/agents/marketing-stratege.md` | Angle + format du jour (calendrier éditorial) |
| Copywriter | `.claude/agents/marketing-copywriter.md` | Caption + hashtags FR/DE-CH |
| Designer | `.claude/agents/marketing-designer.md` | Brief visuel + prompt génératif (charte) |
| Contrôleur qualité | `.claude/agents/marketing-qa.md` | Relit tout avant soumission à Gérald |

Références partagées : `marketing/brand-kit.md` (marque, ton, charte, cible) et
`marketing/editorial-calendar.md` (rythme hebdo équilibré).

## 🔒 Flux de validation (non négociable)
```
/marketing-daily
   Stratège → Copywriter → Designer → Contrôleur QA
        │
        ▼  proposition (statut: en_attente_validation)
   → fichier marketing/proposals/AAAA-MM-JJ-<reseau>.md
   → (Couche 2) INSERT marketing_proposals + admin-notify (email + WhatsApp)
        │
        ▼  Gérald ouvre /admin/marketing
   Réponse : « OK » · « change… » · « refuse »
        │
        ▼  (statut: validé + trace horodatée)
   /marketing-publish  →  publie/programme via Postiz  (SEULEMENT si validé)
```
- **Sans réponse de Gérald → la proposition reste en attente indéfiniment. Jamais publiée.**
- Un **hook** (Couche 2) bloque tout outil de publication si le statut n'est pas `validé`.
- Aucune clé API de publication réelle n'est activée sans accord explicite de Gérald.

## 📣 Format de notification (proposition quotidienne)
```
🌿 PROPOSITION HOLISWISS — <Jour JJ mois AAAA>
─────────────────────────────────────────────
📱 Réseau : <Instagram / LinkedIn / TikTok> — <format>
🎯 Pilier : <preuve sociale / éducatif / démo d'outil / marque>
🧭 Angle : <idée du jour en 1 phrase>
⏰ Heure suggérée : <hh:mm>

📝 CAPTION
<texte complet>

#hashtags #pertinents …
(variante DE-CH si présente)

🎨 BRIEF VISUEL
<type + composition + palette + lotus + texte à l'écran + ratio>
Prompt génératif : « <prompt EN> »

✅ CONTRÔLE QUALITÉ
Cible thérapeute ✓ · Ton ✓ · Charte ✓ · Lignes rouges ✓ · CTA ✓
─────────────────────────────────────────────
Répondez : « OK » · « change … » · « refuse »
```

## ▶️ Relancer la production quotidienne
- **Manuel** : lancer la commande `/marketing-daily` dans Claude Code (dans ce repo).
- **Depuis l'admin (Couche 2)** : bouton « Générer la proposition du jour » dans `/admin/marketing`.
- **Planifié** : une tâche quotidienne (ex. 8h) peut déclencher `/marketing-daily` — à activer seulement quand la Couche 2 (validation admin) est en place.

## 🗺️ État de mise en place
- [x] **Couche 1** — équipe d'agents Claude Code + charte + calendrier + doc (ce dossier).
- [x] **Couche 2** — rubrique admin `/admin/marketing` : table `marketing_proposals`, route React, boutons Valider/Corriger/Refuser (admin only). ⚠️ Appliquer la migration `supabase/migrations/20260721120000_create_marketing_proposals.sql` sur la prod (qqwud) + Publish Lovable. Table déjà créée sur gpld (dev).
- [ ] **Notif** — brancher `admin-notify` (email + WhatsApp) à la création d'une proposition (endpoint `/api/public/admin-notify` déjà en place).
- [ ] **Publication** — MCP **Postiz** (auto-hébergé) branché **après** validation (`/marketing-publish`), + hook bloquant. ⚠️ **Aucune clé API activée sans accord explicite de Gérald.**

### Comment une proposition arrive dans l'admin
`/marketing-daily` (agents) → INSERT dans `marketing_proposals` (statut `en_attente_validation`)
via la **clé service Supabase** (REST), puis appel de `/api/public/admin-notify`.
Tu ouvres `/admin/marketing`, tu valides. La publication réelle reste un pas séparé
(`/marketing-publish`), déclenché seulement sur statut `valide`.

## ⚠️ Rappels
- 1 publication de qualité par jour maximum (qualité > volume).
- Toujours cibler la thérapeute, jamais le client final.
- Jamais de publication sans validation explicite enregistrée.
