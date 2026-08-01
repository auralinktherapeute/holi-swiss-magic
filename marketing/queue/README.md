# File des sujets soumis

Un fichier = un sujet soumis à la main, produit **en supplément** de la publication programmée
du jour (et non à sa place).

Alimenté par `/marketing-sujet "<le sujet>"`, consommé par `/marketing-daily` à l'étape 0.

## Format

```markdown
---
soumis_le: 2026-08-01
pour_le: 2026-08-02
statut: en_attente        # en_attente | traite | abandonne
reseau: instagram         # facultatif
format: carrousel         # facultatif
---

Le sujet, tel que formulé, sans reformulation.
```

## Repli, pas source principale

Quand `marketing_topics` sera déployée en production (qqwud), c'est **elle** qui fera foi : elle
permet de soumettre depuis `/admin/marketing`, donc depuis un téléphone. Ce dossier reste le
chemin de repli quand la table n'est pas joignable — et le seul chemin disponible d'ici là.
