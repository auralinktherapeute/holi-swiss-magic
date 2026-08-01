---
description: Produit les propositions de publication du jour pour Holiswiss — la publication programmée, PLUS toute proposition issue d'un sujet soumis à la main. Pipeline Stratège → Copywriter → Designer → QA, puis soumission à validation. Ne publie jamais rien.
---

# Production marketing du jour

Cible : les deux audiences de la place de marché (thérapeutes suisses + personnes cherchant un
accompagnement). **Aucune publication réelle n'est envoyée par cette commande.**

Lis **`.agents/product-marketing.md`** en entier avant de commencer.

---

## ÉTAPE 0 — Relever les sujets soumis (toujours en premier)

Un sujet soumis à la main est produit **en supplément** de la publication programmée, pas à sa place.
Le jour où un sujet est en file, le cycle produit donc **deux propositions**.

1. **Source prioritaire — Supabase.** Si la table `marketing_topics` existe en production :
   ```sql
   select * from marketing_topics
   where status = 'en_attente' and target_date <= current_date
   order by target_date, created_at;
   ```
2. **Source de repli — fichiers.** Si la table n'est pas disponible, lis `marketing/queue/` et retiens
   les fichiers dont le frontmatter porte `statut: en_attente` et `pour_le:` ≤ aujourd'hui.

> ⚠️ Rappel du CLAUDE.md : la production, c'est `qqwud`. Une lecture faite sur `gpld` ne reflète pas
> ce que voit l'admin. En cas de doute sur la disponibilité de la table, utilise le repli fichiers
> plutôt que d'interroger la mauvaise base.

S'il n'y a aucun sujet en file → tu ne produis que la publication programmée. C'est le cas normal.

---

## ÉTAPE 1 — La publication programmée

Déroule le pipeline complet, en passant le résultat de chaque agent au suivant :

1. **Stratège** (`marketing-stratege`) → brief du jour. Il lit `marketing/proposals/` pour éviter
   les répétitions, note l'idée sur 100 (seuil 80) et nomme les deux lectures.
2. **Copywriter** (`marketing-copywriter`) → texte final, carrousel slide par slide, 4 langues.
3. **Designer** (`marketing-designer`) → brief visuel + prompt génératif + ratio d'export.
4. **QA** (`marketing-qa`) → 4 critères bloquants puis checklist. Si ❌ → renvoi à l'agent concerné.

Cette proposition porte `source = 'programme'`.

---

## ÉTAPE 2 — Les sujets soumis (un cycle complet par sujet)

Pour **chaque** sujet relevé à l'étape 0, redéroule le même pipeline, avec deux règles propres :

### Le filtre qualité s'applique à l'identique
Un sujet imposé ne contourne **pas** le seuil de 80/100 ni le test des deux chaises. C'est la raison
d'être de tout le dispositif : un sujet qui passerait en force finirait par produire exactement le
post banal qu'on cherche à empêcher.

### Si le sujet n'atteint pas 80/100 — angle de repli obligatoire
Tu ne te contentes jamais de refuser. Le Stratège doit alors :
1. dire **pourquoi** le sujet tel que formulé n'atteint pas le seuil (score détaillé, critère faible) ;
2. proposer **un angle de repli sur le même sujet** qui, lui, atteint 80 — car c'est presque toujours
   l'angle qui pèche, pas le sujet ;
3. produire la proposition sur cet angle de repli, en indiquant clairement la substitution.

Le sujet reste alors `en_attente` avec `reject_reason` renseigné (l'angle de repli proposé) tant que
tu n'as pas validé la substitution. **Tu tranches, pas l'agent.**

Ces propositions portent `source = 'soumis'` et `topic_id` renseigné.

---

## Sortie

- Une proposition = un fichier `marketing/proposals/AAAA-MM-JJ-<reseau>[-soumis].md`,
  en-tête `statut: en_attente_validation`.
- Affiche **toutes** les propositions du jour dans la conversation, en indiquant clairement pour
  chacune si elle est **programmée** ou **issue d'un sujet soumis**.
- Marque les sujets traités : `status = 'traite'` + `processed_at` en base, ou `statut: traite`
  dans le frontmatter du fichier de file.
- Si `marketing_proposals` est disponible en production : insertion avec `source`, `topic_id`, `score`.
  Le trigger notifie automatiquement (email + WhatsApp). Validation ensuite dans `/admin/marketing`.

---

## Garde-fous (non négociables)

- ❌ Ne contacte AUCUN réseau social, n'appelle AUCUN outil de publication (Postiz…).
- ❌ Aucun chiffre, taux ou tarif sans source externe vérifiable — **les articles du blog Holiswiss
  ne sont pas une source fiable** (contradictoires et faux sur le remboursement, constat 01/08/2026).
- ❌ Aucune allégation thérapeutique (contrainte légale suisse en médecine complémentaire).
- ❌ Un sujet soumis ne dispense d'aucun contrôle qualité.
- ✅ Toute proposition reste `en_attente_validation` tant que Gérald n'a pas répondu. Sans réponse,
  elle n'est jamais publiée. La publication réelle passe par `/marketing-publish`, après validation.
- ✅ Qualité > volume. Deux propositions irréprochables valent mieux que quatre correctes.
