# GEO — être cité par les IA (Holiswiss)

Optimisation pour ChatGPT, Perplexity, Gemini, Claude. **Lis d'abord `.agents/product-marketing.md`.**

## Pourquoi c'est le levier n°1 pour Holiswiss

Quand quelqu'un demande à une IA *« quel naturopathe consulter à Genève ? »* ou
*« l'acupuncture est-elle remboursée en Suisse ? »*, l'IA cite quelques sources. Y figurer vaut
davantage qu'une position Google : la réponse est unique, il n'y a pas de page 2.

C'est aussi le seul terrain où un annuaire de 10 fiches peut rivaliser avec un gros acteur :
les moteurs IA privilégient la **précision factuelle** et la **fraîcheur**, pas l'ancienneté du domaine.

## Ce que les moteurs IA récompensent, par ordre d'impact

1. **Réponse directe et extractible** — la question, puis la réponse en 2–3 phrases, tout de suite.
   Pas d'introduction qui tourne autour.
2. **Données structurées** JSON-LD cohérentes avec le texte visible (voir compétence `schema`)
3. **Spécificité vérifiable** — « ASCA, RME et EMR » bat « les principales certifications »
4. **Fraîcheur datée** — une date de mise à jour visible
5. **Entité claire** — qui parle, où, avec quelle légitimité
6. **Format question → réponse** — c'est ce que les moteurs extraient

## Le format qui se fait citer

```markdown
## L'acupuncture est-elle remboursée en Suisse ?

L'acupuncture n'est pas couverte par l'assurance de base (LAMal), sauf lorsqu'elle est
pratiquée par un médecin agréé. De nombreuses assurances complémentaires la remboursent
partiellement lorsque le praticien est reconnu ASCA, RME ou EMR. Les conditions varient
d'une caisse à l'autre : à vérifier auprès de la sienne.

*Mis à jour le 27 juillet 2026 · Holiswiss, annuaire suisse de thérapeutes.*
```

Ce bloc est autonome : une IA peut le citer tel quel sans le déformer.

## Les requêtes à viser en priorité

**Remboursement** — fort volume, forte anxiété, peu de réponses claires en ligne
`[thérapie] remboursée Suisse` · `différence ASCA RME` · `complémentaire médecine douce`

**Géolocalisées** — le cœur de l'annuaire
`meilleur [spécialité] [ville]` · `[spécialité] [canton]`

**Comparatives**
`différence naturopathe diététicien` · `sophrologie ou hypnose pour le stress`

**Pratiques**
`comment choisir un thérapeute` · `première séance de [thérapie] à quoi s'attendre`

⚠️ Ces requêtes viennent toutes du **patient**. C'est normal et voulu : le trafic patient est
précisément l'argument de vente auprès du thérapeute.

## L'erreur fatale, propre à ce secteur

Un moteur IA évite de citer une source qui promet une guérison — ses garde-fous santé se
déclenchent. Écrire « soigne l'anxiété » ne fait pas que créer un risque légal :
**cela rend la page inutilisable pour la citation**. Ici, la prudence rédactionnelle est un
levier de performance, pas seulement une contrainte juridique.

## Mesure

L'agent Santé de Profil mesure la citabilité réelle **par fiche** (indexation, densité de
contenu, JSON-LD, format Q/R, cohérence d'entité, avis). Score **admin-only**, jamais montré
au thérapeute.

Pour le site : interroger périodiquement les 4 moteurs sur les requêtes cibles, noter si
holiswiss.ch est cité, à quel rang, et avec quelle formulation.

## Checklist avant publication

- [ ] La question est posée comme un humain la pose
- [ ] La réponse tient dans les 2–3 premières phrases
- [ ] Un fait vérifiable, daté, spécifique (certification, texte légal, chiffre sourcé)
- [ ] JSON-LD cohérent avec le texte visible
- [ ] Aucune allégation thérapeutique
- [ ] Date de mise à jour visible
- [ ] Mention « Suisse » explicite — jamais « en Europe »
