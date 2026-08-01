---
description: Soumet un sujet marketing pour le lendemain, en supplément de la publication programmée. Met le sujet en file d'attente — ne produit aucun contenu et ne publie rien.
argument-hint: "<le sujet>" [--reseau instagram|linkedin|tiktok] [--format carrousel|reel|post] [--date AAAA-MM-JJ]
---

# Soumettre un sujet marketing

Sujet soumis : **$ARGUMENTS**

Ta mission ici est **uniquement de mettre ce sujet en file d'attente**. Tu ne rédiges rien,
tu ne notes rien, tu ne proposes aucun angle. La production aura lieu au prochain cycle
`/marketing-daily`, qui traitera ce sujet **en supplément** de la publication programmée du jour.

## Marche à suivre

1. **Si aucun sujet n'est fourni** dans les arguments, demande-le et arrête-toi là.

2. **Détermine la date cible** : par défaut **demain**. Si `--date` est passé, utilise cette date.

3. **Vérifie les doublons** : lis `marketing/queue/` et `marketing/proposals/`. Si un sujet très
   proche est déjà en file ou déjà produit, signale-le et demande confirmation avant d'ajouter.

4. **Écris le fichier** `marketing/queue/AAAA-MM-JJ-<slug>.md` (date cible + slug court du sujet) :

```markdown
---
soumis_le: <date du jour>
pour_le: <date cible>
statut: en_attente
reseau: <si précisé, sinon vide>
format: <si précisé, sinon vide>
---

<le sujet, tel que formulé, sans reformulation ni enjolivement>
```

5. **Confirme** en une ligne : le sujet, la date cible, et le rappel que la production
   se fera au prochain cycle quotidien. N'en dis pas plus.

## Règles

- ❌ Ne produis **aucun** contenu, hook, angle ou caption à cette étape. C'est une mise en file, rien d'autre.
- ❌ Ne reformule pas le sujet : le Stratège a besoin de la formulation d'origine, elle porte l'intention.
- ❌ Ne juge pas le sujet ici. Le filtre qualité (score ≥ 80, test des deux chaises) s'applique
  au moment de la production, pas au moment de la soumission.
- ✅ Un sujet en file reste `en_attente` jusqu'à ce qu'un cycle le traite. Rien ne se perd.
- ℹ️ Quand la table Supabase `marketing_topics` sera déployée en production, ce même sujet pourra
  aussi être soumis depuis `/admin/marketing` (donc depuis un téléphone). Le pipeline lira alors
  la table en priorité, et retombera sur `marketing/queue/` si elle est indisponible.
