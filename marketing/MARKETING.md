# Holiswiss — Équipe marketing autonome (réseaux sociaux)

> Choix du MCP de publication : voir [mcp-comparison.md](./mcp-comparison.md) (Postiz retenu, rien installé sans accord).

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

📝 CAPTION (4 langues)
🇫🇷 FR : <texte complet FR>  #hashtags …
🇬🇧 EN : <texte complet EN>  #hashtags …
🇩🇪 DE : <texte complet DE>  #hashtags …
🇮🇹 IT : <texte complet IT>  #hashtags …

🎨 BRIEF VISUEL (charte Holiswiss : violet/mauve/turquoise/corail + lotus)
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
- [x] **Notif** — `admin-notify` (email + WhatsApp) branché via **trigger** `notify_marketing_proposal` sur INSERT (dans la migration ; appelle `notify_admin_event` → `/api/public/admin-notify`). Actif dès que la migration est appliquée en prod.
- [x] **Commande de publication** — `/marketing-publish` créée : refuse toute proposition non `valide` (garde-fou dur), publie via Postiz seulement après validation.
- [ ] **Postiz** — installer le MCP + connecter les comptes. ⚠️ **Aucune clé API activée sans accord explicite de Gérald.** Tant que Postiz n'est pas configuré, `/marketing-publish` s'arrête proprement (« Postiz non configuré »).

### Hook de sécurité (optionnel, à activer avec Postiz)
Ajouter dans `.claude/settings.json` un `PreToolUse` qui journalise/confirme tout appel
à un outil `mcp__postiz__*` de publication — filet supplémentaire pour qu'aucune
publication ne soit silencieuse. Le vrai garde-fou reste la validation admin +
le contrôle de statut `valide` dans `/marketing-publish`.

### Comment une proposition arrive dans l'admin
`/marketing-daily` (agents) → INSERT dans `marketing_proposals` (statut `en_attente_validation`)
via la **clé service Supabase** (REST), puis appel de `/api/public/admin-notify`.
Tu ouvres `/admin/marketing`, tu valides. La publication réelle reste un pas séparé
(`/marketing-publish`), déclenché seulement sur statut `valide`.

## ⚠️ Rappels
- 1 publication de qualité par jour maximum (qualité > volume).
- Toujours cibler la thérapeute, jamais le client final.
- Jamais de publication sans validation explicite enregistrée.
