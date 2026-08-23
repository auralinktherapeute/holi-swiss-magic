# Holiswiss — Contexte produit & marketing

> **Fichier socle — source de vérité unique.** Toute compétence marketing lit ce document AVANT
> d'agir et n'invente jamais un fait qui n'y figure pas. Si une donnée manque, la demander —
> ne pas la supposer.
>
> Il est lu par **les deux agents** : le chat web de `/admin/marketing` (embarqué au build) et les
> agents Claude Code (`marketing-stratege`, `-copywriter`, `-designer`, `-qa`). C'était l'intention
> d'origine, elle n'était pas tenue jusqu'au 01/08/2026 : les agents Claude Code lisaient un second
> fichier, `marketing/brand-kit.md`, qui a divergé. Les deux socles sont désormais fusionnés ici.
> **Ne jamais recréer un socle parallèle.**
>
> Dernière vérification des chiffres : **27 juillet 2026** (base de production).
> Dernière refonte éditoriale : **1ᵉʳ août 2026**.
>
> ⚠️ Ce fichier est embarqué dans le bundle au build (`import.meta.glob` en `eager`). Le modifier
> en local ne change rien sur `/admin/marketing` tant que Lovable n'a pas reconstruit.

---

## 1. Ce qu'est Holiswiss

Annuaire suisse de **thérapeutes et praticiens en médecines douces / thérapies complémentaires**,
couvrant les 26 cantons, en 4 langues (FR · DE · IT · EN). Site : `holiswiss.ch`.

Modèle **à deux faces**, et c'est la clé de toute décision marketing :

| Face | Qui | Ce qu'on lui vend | Rôle économique |
|---|---|---|---|
| **Offre** | Le **thérapeute** indépendant suisse | Visibilité, agenda rempli, outils de gestion | **C'est lui qui paie** — abonnement |
| **Demande** | Le **patient** cherchant un praticien | Trouver un thérapeute vérifié près de chez lui | Gratuit — il alimente la valeur pour le thérapeute |

**Règle de base :** la communication *prospection* vise le **thérapeute**. Le contenu *SEO/blog*
vise le **patient** (c'est lui qui tape les requêtes), car le trafic patient est précisément
l'argument de vente auprès du thérapeute. Confondre les deux par négligence reste l'erreur la
plus fréquente — **toujours nommer la face visée**.

### L'exception encadrée : le dispositif « même scène, deux chaises » (validé le 01/08/2026)

Sur les **réseaux sociaux**, une publication peut viser les deux faces à la fois — mais à une
condition stricte, sinon elle retombe dans la bouillie que la règle ci-dessus interdit.

Le seul mécanisme qui convertit réellement deux audiences opposées, c'est de **rendre visible le
niveau d'exigence de la place de marché** :

| Ce que lit le patient | Ce que lit le thérapeute |
|---|---|
| « Ce que je trouve ici est filtré. Je peux y aller. » | « Être référencé ici veut dire quelque chose. Je veux en être. » |

Les deux veulent la même chose : **un filtre crédible**. Le produit n'est pas l'annuaire, c'est le
**standard**. Modèle : Michelin, Superhost, ordres professionnels.

**Exécution** — on écrit une scène précise que les deux personas reconnaissent depuis des positions
opposées du même moment. Exemple : le moment du choix. Le patient reconnaît la paralysie devant
40 profils identiques ; la thérapeute reconnaît le fait d'*être* l'un de ces 40 profils invisibles.
Même publication, deux lectures, aucune dilution — parce que **la tension entre les deux chaises
est le sujet**.

**Test des deux chaises (bloquant).** Tout brief doit nommer explicitement :
1. **Lecture patient** — ce qu'il se dit, en une phrase à la première personne.
2. **Lecture thérapeute** — ce qu'elle se dit, en une phrase à la première personne.

Si l'une des deux est absente, vague, ou revient à « c'est intéressant » → **la publication est
refusée**. Une publication mono-audience reste parfaitement légitime, mais elle doit alors
l'assumer et le déclarer.

> ⚠️ **Contrainte de sincérité imposée par l'état réel (section 2).** Avec 10 fiches sur 4 cantons,
> un appel à l'action patient ne doit **jamais** promettre une couverture géographique. On peut lui
> apprendre à choisir, lui expliquer le cadre, lui donner les bonnes questions — on ne peut pas lui
> promettre qu'il trouvera quelqu'un près de chez lui. La valeur patient de ces contenus est
> **éducative**, pas transactionnelle, tant que l'offre n'a pas grossi.

---

## 2. État réel au 27/07/2026 (chiffres de production, pas d'objectifs)

| Indicateur | Réalité | Lecture marketing |
|---|---|---|
| Thérapeutes inscrits | **10** | Amorçage. Volume = priorité n°1 |
| Abonnés payants | **0** (tous en `free`) | La monétisation n'a jamais été testée |
| Cantons couverts | **4 / 26** — BS, GE, NE, VD | Suisse alémanique et Tessin quasi vierges |
| Villes présentes | Basel, Genève, Lausanne, Payerne, Boudevilliers, Le Chenit | Romandie surreprésentée |
| Articles publiés | **38**, intégralement traduits en **FR et DE** (IT/EN : titres seuls) | Le contenu allemand existe déjà |
| **Indexation Google** | **0 page de blog indexée sur 152** — « URL unknown to Google » | **Le vrai verrou** |
| Trafic Google, 90 jours | **2 clics, 45 impressions** | Site quasi invisible, dans TOUTES les langues |
| Ancrage géographique des articles DE | **0 article ancré en Suisse alémanique** (7 purement romands, 31 mixtes) | Traduits, pas localisés |
| Praticiens en Suisse alémanique | **1** (Gerald Henry, Bâle) | Rien à indexer côté offre : c'est un enjeu de **recrutement** |
| URL localisées en allemand | 9/38 articles · **17/31 spécialités** (`slug_de`) | Fait le 27/07/2026 |
| Catégories d'articles | 26 (naturopathie, ostéopathie, sophrologie, acupuncture…) | Bonne base thématique |
| Score santé des fiches | 15 à 66 / 100, **aucune ≥ 75** | Fiches pauvres = faible conversion patient |

**Quatre vérités inconfortables à garder en tête :**
1. Un annuaire à 10 fiches ne peut pas promettre « trouvez votre thérapeute partout en Suisse ».
   Ne jamais laisser entendre une couverture qu'on n'a pas.
2. Personne ne paie encore. Toute réflexion prix/offre est une **hypothèse à tester**, pas un acquis.
3. **Le blog n'est pas indexé du tout.** Écrire davantage ne sert à rien tant que Google n'a pas
   découvert l'existant : le socle technique est sain, c'est l'autorité du domaine qui manque.
   Voir `marketing/plan-visibilite.md`.
4. Le contenu allemand est **traduit du français**, donc ancré en Romandie (« Suisse romande »,
   Genève, Lausanne). Un lecteur zurichois ne s'y reconnaît pas. Voir `marketing/sujets-alemanique.md`.

---

## 3. Persona principal — « Camille, thérapeute indépendante »

- Sophrologue, hypnothérapeute, naturopathe, magnétiseuse, réflexologue, praticienne Reiki…
- 30–55 ans, exerce **seule**, en cabinet et/ou à domicile.
- Excellente dans son métier, **mal à l'aise avec le marketing, l'administratif, le numérique**.
- **Peurs** : « se vendre », la paperasse, rester invisible face aux gros annuaires, être assimilée
  à du charlatanisme.
- **Envies** : remplir son agenda **sans démarcher**, être trouvée par les bons clients, être
  reconnue comme professionnelle sérieuse, rester concentrée sur son cœur de métier.
- **Langues** : français (Romandie), allemand (Suisse alémanique), italien (Tessin).

> **Test de validation** de tout contenu destiné à cette face : une thérapeute le lit-elle en se
> disant « ça me concerne » ? Si le texte parle des bienfaits d'une thérapie au grand public,
> il s'est trompé de cible — recommencer.

### Persona secondaire — « le patient »
Cherche un praticien près de chez lui, doute de la légitimité du secteur, se demande si
c'est remboursé. Requêtes typiques : *« naturopathe Genève »*, *« acupuncture remboursée LAMal »*,
*« ostéopathe Lausanne avis »*. **C'est lui la cible du blog et du SEO.**

---

## 4. Proposition de valeur (ce qu'on peut affirmer)

Promesse : **« Concentrez-vous sur vos soins, on s'occupe du reste. »**

Fonctionnalités réellement disponibles — ne rien promettre au-delà :
- Profil public vérifié, avec avis authentiques
- Réservation en ligne + agenda (`availabilities`, `appointments`)
- Forfaits (packs de séances)
- Questionnaire d'admission automatique
- Facturation et rappels
- Publication d'articles « Voix d'experts » signés du thérapeute
- Événements et ateliers
- Visibilité SEO **et citabilité par les IA** (ChatGPT, Perplexity, Gemini)

En préparation, à ne pas présenter comme disponible : réception téléphonique IA (cible sept. 2026).

---

## 5. Cadre légal et déontologique suisse — **lignes rouges absolues**

Le secteur est sensible et surveillé. Une formulation imprudente expose le thérapeute *et* la plateforme.

**Interdit, sans exception :**
- ❌ Toute allégation thérapeutique ou curative : « guérit », « soigne », « traite », « diagnostique »,
  « remède contre… ». Écrire **« accompagne »**, **« soutient »**, **« favorise le bien-être »**.
- ❌ Promettre un remboursement. Formuler : *« de nombreuses complémentaires remboursent
  tout ou partie des séances lorsque le praticien est certifié ASCA, RME ou EMR — à vérifier
  auprès de sa caisse »*.
- ❌ Revendiquer des gains chiffrés pour le thérapeute (« +40 % de clients ») sans donnée vérifiable.
  Nous n'en avons aucune.
- ❌ Dénigrer un concurrent nommément.
- ❌ Témoignage inventé, avis fabriqué, chiffre embelli. Le secteur vit de la confiance.
- ❌ Publier quoi que ce soit sans validation explicite de Gérald.

**Mentions utiles :** certifications **ASCA / RME / EMR** (elles rassurent et conditionnent le
remboursement). Rappel de non-substitution à un avis médical sur les contenus santé.

### Le remboursement — état vérifié le 01/08/2026 (source OFSP)

Ce point était **formulé de façon inexacte** dans ce fichier jusqu'au 01/08 (« les thérapies
complémentaires ne relèvent pas de la LAMal de base »). C'était prudent, mais faux.

**Ce qui est exact :**

- **Cinq domaines relèvent bien de l'assurance obligatoire des soins** : acupuncture, médecine
  anthroposophique, pharmacothérapie de la MTC, homéopathie classique, phytothérapie.
- **Mais à une condition cumulative stricte.** Libellé officiel : *« Seules les prestations fournies
  par les **médecins** ayant obtenu un **titre de spécialiste** et disposant d'une **formation
  postgrade** dans l'une de ces disciplines complémentaires peuvent être facturées. »*
- **Les prestations d'un thérapeute non-médecin ne relèvent donc PAS de l'AOS**, mais des
  assurances complémentaires — où tout dépend de l'assureur, de la police souscrite et du registre
  du praticien.
- Source : [OFSP — Médecines complémentaires pratiquées par des médecins](https://www.bag.admin.ch/fr/medecines-complementaires-pratiquees-par-des-medecins)

❌ **Ne jamais écrire « pratiqué par un professionnel »** à la place de « par un médecin ».
L'élargissement laisse croire au patient que ses séances chez une naturopathe sont couvertes par
l'assurance de base. Elles ne le sont pas. C'est l'erreur la plus coûteuse possible sur ce sujet.

---

## 5 bis. Discipline factuelle — règle née d'un incident réel (01/08/2026)

Deux articles du blog Holiswiss sur le remboursement se sont révélés **contradictoires entre eux et
factuellement faux** : « la LAMal rembourse exclusivement trois thérapies depuis 2022 », « taux de
80 % après franchise », « 60 % / 90 % / 95 % des assureurs remboursent ». Aucune source, chiffres
inventés par l'agent de génération d'articles.

**Conséquence : aucune source interne n'est présumée fiable.**

**Interdits absolus**
- ❌ Publier un **pourcentage, un tarif, un taux de remboursement ou une statistique** sans source
  externe vérifiable. Pas d'exception, même si un article du blog l'affirme.
- ❌ Reprendre un chiffre d'un contenu Holiswiss sans l'avoir revérifié à la source primaire
  (OFSP, assureur, ASCA, RME).
- ❌ Affirmer qu'une thérapie « est remboursée » sans préciser **par quel étage** (AOS /
  complémentaire) et **sous quelle condition**.

**Autorisé sans source** — les faits de structure stables : l'existence de deux étages d'assurance ;
la dépendance à l'assureur, à la police, à la discipline et au registre ; le rôle d'ASCA et RME/EMR
comme registres de référence ; le fait qu'**il n'existe pas de réponse universelle**.

**Réflexe de production** : tout livrable contenant une affirmation factuelle porte un bloc
**« À VÉRIFIER AVANT PUBLICATION »** listant chaque affirmation et sa source à confirmer.

> Principe directeur : sur un sujet santé/assurance, **l'honnêteté structurelle bat la fausse
> précision**. Les concurrents publient des chiffres inventés ; nous publions la structure réelle
> et les bonnes questions. C'est ça, le premium.

---

## 6. Les 4 langues — règle de fond

Chaque publication réseaux sociaux existe en **FR · DE(-CH) · IT · EN**.
Ce ne sont **pas des traductions littérales** : le message clé reste identique, le ton s'adapte.

| Langue | Marché | Registre |
|---|---|---|
| **FR** | Romandie (GE, VD, NE, FR, VS, JU) | Chaleureux, proche |
| **DE-CH** | Suisse alémanique — **le plus gros marché ; contenu traduit mais non localisé** | Sobre, factuel, crédible. Éviter l'emphase française |
| **IT** | Tessin | Chaleureux, plus expressif |
| **EN** | Expatriés (Zurich, Genève, Zoug, Bâle) | Direct, international |

Vocabulaire local : *Naturheilpraktiker*, *Komplementärmedizin* (DE) · *medicina complementare* (IT).
Ne jamais employer *Heilpraktiker* seul — c'est le terme allemand, pas suisse.

---

## 7. Identité visuelle (obligatoire sur tout visuel)

- Dégradé : violet profond `#1a0a2e` → mauve `#7c3aed` / `#a855f7` → turquoise `#22d3ee` / `#5cc8fa`
- Fond **sombre premium**, texte blanc, accents violet/cyan. **Jamais de fond blanc plat.**
- Typographie : titres sérif élégant (Playfair) + texte sans-serif (Inter)
- Ambiance : apaisante, professionnelle, « bien-être haut de gamme suisse »

### Système d'apposition du logo lotus (validé le 01/08/2026)

**Homogène ne veut pas dire identique.** Trois rôles selon la position de la slide — c'est ce qui
empêche le logo de concurrencer le message. Cotes pour un export **1080 × 1350**.

| Rôle | Où | Taille | Opacité | Position |
|---|---|---|---|---|
| **Marque de pied** | Toutes les slides | 70 px (6,5 % de la largeur) | 85 % | Bas gauche, aligné sur la numérotation |
| **Filigrane** | Slides de corps uniquement | 690 px (64 %) | **7 %** | Débordant du cadre, dans la zone vide |
| **Signature** | Dernière slide (CTA) | 215 px (20 %) | 100 % | Au-dessus du CTA, aligné à gauche |

- Le filigrane **alterne entre trois positions** (bas droite, bas gauche, haut droite) : sans cette
  alternance, le défilement produit un effet de gabarit répété.
- Il **déborde volontairement** du cadre : un lotus entier se lit comme un motif, un lotus coupé se
  lit comme une texture. On veut la texture.
- **7 % maximum.** À 10 % il commence à se lire et vole l'attention.

**Trois slides n'en portent pas — ne pas les « harmoniser »** : la slide 1 (rien ne dispute
l'attention au hook), la slide à sauvegarder (l'utilisateur la recadre), les slides de rupture
(leur force vient du vide).

❌ Jamais déformé, jamais recoloré, jamais sur fond clair.
Fichier de référence : `src/assets/lotus-transparent.png.asset.json` (pointeur Lovable, PNG 500×500
RGBA). Ne pas repartir d'une reconstitution.

### Spécifications carrousel (format prioritaire sur Instagram)

- **Ratio 4:5** (1080 × 1350). Jamais 1:1 pour un carrousel éducatif.
- **6 à 8 slides.** Slide 1 = hook seul, texte très gros. Dernière = CTA seul.
- **Un seul message par slide**, ~25 mots maximum. Deux idées = deux slides.
- Zone de sécurité : 120 px en bas (UI Instagram). Numérotation discrète (2/7…) : elle augmente
  le taux de complétion.
- Texte blanc sur fond sombre uniquement. Vérifier la lisibilité en vignette.

### Qualité d'exécution — niveau senior et distinction post/carrousel (bloquant)

Un **post** et un **carrousel** sont deux livrables éditoriaux distincts. Il est interdit de prendre
la caption du post, de la découper automatiquement en paragraphes et d'appeler le résultat un
carrousel. Il est également interdit d'utiliser la slide d'accroche comme post sans lui concevoir
une composition autonome.

- **Post** : une idée autosuffisante, un visuel unique composé pour être compris sans défilement,
  puis une caption qui approfondit sans répéter mot pour mot le visuel.
- **Carrousel** : 6 à 8 slides rédigées intentionnellement comme une progression : tension →
  contexte → développement → pivot → preuve ou outil utile → résolution → CTA. Chaque slide doit
  apporter une information nouvelle et donner une raison de faire défiler la suivante.
- La caption accompagne le carrousel : elle ne duplique ni l'ordre ni le texte des slides.
- Aucun carrousel à une seule slide. Aucune suite de slides issue d'un découpage mécanique de la
  caption. Si le sujet ne justifie pas 6 slides distinctes, choisir le format **post**, sans simuler
  un carrousel.

**Contrôle de composition obligatoire avant livraison** : vérifier chaque slide au format 4:5 et
en vignette. Le bloc principal doit être visuellement équilibré dans la zone sûre ; hook, rupture
et CTA sont centrés sur leur axe principal. Aucun texte ne doit être tassé en haut, coupé, déborder,
ou laisser un vide accidentel. Hiérarchie nette, marges régulières, longueurs maîtrisées. Une
maquette seulement « correcte » est refusée : le niveau attendu est celui d'un directeur artistique
senior, publiable sans retouche.

⚠️ Vigilance images : une illustration hors-sujet ruine la crédibilité. *(Un article publié
affichait une photo de compléments alimentaires pour chiens.)* Toujours vérifier la pertinence
réelle du visuel, jamais se fier au seul mot-clé de recherche.

---

## 8. Canaux et priorités

| Canal | Face visée | Priorité | État |
|---|---|---|---|
| **Indexation Google** | — | ⭐⭐⭐ | **Priorité absolue** : 0/152 page de blog indexée |
| **Liens entrants** | — | ⭐⭐⭐ | Le seul levier durable d'autorité (associations, annuaires suisses) |
| **SEO / blog** | Patient | ⭐⭐ | 38 articles FR+DE écrits ; **à faire découvrir, puis à localiser** |
| **GEO — citabilité IA** | Patient | ⭐⭐⭐ | Levier différenciant, agents en place |
| **Pages canton × spécialité** | Patient | ⭐⭐⭐ | Inexploité, potentiel le plus fort |
| **Instagram** | Thérapeute | ⭐⭐ | Carrousel éducatif, reel, preuve sociale |
| **LinkedIn** | Thérapeute | ⭐⭐ | Angle professionnalisation, bilingue FR/DE |
| **TikTok** | Thérapeute | ⭐ | Authentique, coulisses |
| **Prospection email** | Thérapeute | ⭐⭐⭐ | Le canal d'amorçage le plus direct |
| **Presse / RP** | Les deux | ⭐ | Crédibilité du secteur |

## 9. Piliers éditoriaux sociaux (révisés le 01/08/2026)

Les quatre piliers ci-dessous **remplacent** l'ancienne rotation (preuve sociale / éducatif /
démo d'outil / marque), trop générique pour produire autre chose que du contenu bien-être banal.

| # | Pilier | Promesse | Rôle business | Score |
|---|---|---|---|---|
| 1 | **LE STANDARD** | Ce qui distingue un accompagnement sérieux d'un autre, en Suisse | Rend le filtre visible → confiance patient + désir de badge thérapeute | 92 |
| 2 | **LA CHAISE D'EN FACE** | La même scène, vécue des deux côtés | Prouve qu'on comprend les deux parties — obligation d'une place de marché | 89 |
| 3 | **LE CONCRET SUISSE** | Ce que personne ne vous explique clairement sur les thérapies complémentaires en Suisse | Autorité dure, fort taux de sauvegarde, difficile à copier | 94 |
| 4 | **LA PREUVE** | Des parcours réels, pas des promesses | Pilier de conversion — à n'activer qu'une fois le standard posé | 85 |

Jamais deux fois le même pilier ni le même réseau d'affilée.

## 9 bis. Scoring obligatoire — seuil 80/100

Toute idée est notée **avant production** sur 8 critères (~12,5 pts chacun) : pertinence cible ·
arrêt du scroll · autorité perçue · clarté · différenciation · cohérence de marque · potentiel
Instagram · potentiel de conversion.

**Rien en dessous de 80 n'est écrit.** Le score et sa justification figurent au brief, et au moins
une idée écartée doit être documentée — c'est la preuve que le filtre a fonctionné.

### Mémoire anti-banalité — ne jamais re-proposer

| Idée | Score | Motif |
|---|---|---|
| « 5 signes que vous avez besoin d'un thérapeute » | 34 | Banal + dérive vers l'allégation médicale |
| « Les bienfaits du Reiki » | 41 | Générique, zéro différenciation, aucune conversion |
| « Rejoignez +100 thérapeutes ! » | 38 | Promo brute, détruit le positionnement premium (et faux : il y en a 10) |
| « Les 5 thérapies remboursées en Suisse » | 46 | Listicle, et inécrivable honnêtement sans chiffres invérifiables |
| « Combien coûte une séance en Suisse ? » | 44 | Exige des données tarifaires dont nous n'avons aucune source fiable |

### Sujet imposé qui n'atteint pas 80 → angle de repli, jamais un refus sec

Un sujet soumis à la main (voir section 12) se traite comme les autres. S'il plafonne, on ne refuse
pas : on nomme le critère faible, puis on **propose un angle de repli sur le même sujet** qui, lui,
atteint 80 — car c'est presque toujours l'angle qui pèche, pas le sujet. Gérald tranche la
substitution, pas l'agent.

> Exemple : « Les bienfaits du Reiki » plafonne à 41. Repli : « Ce qu'un praticien Reiki peut dire —
> et ce qu'il n'a pas le droit de promettre » → 86, parce qu'il enseigne le cadre au lieu de vanter
> la méthode.

## 9 ter. Conversion — par qualification, jamais par pression

Une marque premium convertit en **retirant** de la pression. Sur une catégorie de confiance liée à
la santé, le CTA doit permettre au lecteur de **s'auto-sélectionner** : « Si vous êtes dans ce cas
précis, voilà où regarder. »

- **Un seul CTA** par publication, en dernière slide.
- Jamais d'injonction, jamais d'urgence, jamais de compte à rebours.
- KPI réels : **sauvegardes, partages, clics profil** — pas les likes.
- Rappel : aucun CTA patient ne promet une couverture géographique (10 fiches, 4 cantons).

## 10. Ton

Chaleureux, humain, éducatif, utile même sans inscription. Suisse, local, digne de confiance.
**Jamais** : urgence artificielle, majuscules d'injonction, jargon corporate, anglicismes tech,
promesses irréalistes.

---

## 11. Repères techniques (pour les compétences SEO/contenu)

- Stack : TanStack Start + Supabase, déploiement Lovable. **Pas de Netlify.**
- Table `therapists` : `slug`, `specialties[]`, `canton`, `city`, `bio`, `verified`, `subscription_plan`
- Table `articles` : multilingue (`title_fr/de/it/en`, `body_*`), `slug`, `category`, `status`
- URLs : `/{lang}/therapeute/{slug}`, `/{lang}/blog`, `/{lang}/therapeutes`
- ⚠️ `specialties` est du **texte libre non normalisé** (`Naturopathe` vs `naturopathie`,
  `nutrithérapie` en minuscule…). Toute page générée par spécialité exige une **taxonomie
  de référence** au préalable — c'est un prérequis, pas un détail.

---

## 12. Sujets soumis à la main — production « en supplément »

Gérald peut soumettre un sujet pour le lendemain. Il est produit **en supplément** de la publication
programmée du jour, **jamais à sa place** : ce jour-là, le cycle produit deux propositions.

| Surface | Comment | Lu par le pipeline via |
|---|---|---|
| Claude Code | `/marketing-sujet "<le sujet>"` → fichier dans `marketing/queue/` | lecture directe des fichiers |
| `/admin/marketing`, onglet Sujets | Table `marketing_topics` | **RPC `get_pending_marketing_topics`** |

⚠️ **Une lecture REST directe de `marketing_topics` renvoie toujours `[]`** : sa RLS est réservée aux
admins, et le pipeline n'a que la clé anon. C'est le défaut constaté le 01/08 — l'onglet Sujets
écrivait dans une table que l'agent ne pouvait pas lire, deux files déconnectées.
Corrigé par deux RPC `SECURITY DEFINER` protégées par `marketing_agent_secret` (migration
`20260801230000`) : `get_pending_marketing_topics` pour lire, `close_marketing_topic` pour clôturer.
Le secret vit dans `app_settings` côté base et dans **`.env.local`** (`MARKETING_AGENT_SECRET`) côté agent.
⚠️ **Jamais dans `.env`** : ce fichier est suivi par git malgré sa présence dans `.gitignore` (il a été
indexé avant l'ajout de la règle) et se trouve sur `origin/main`.

Le pipeline traite **les deux sources** — un sujet peut venir de l'admin comme de la ligne de commande.
Un sujet soumis ne dispense d'**aucun** contrôle : même scoring, même seuil, même test des deux
chaises. Ne jamais reformuler le sujet d'entrée — sa formulation porte l'intention.

Traçabilité en base : `marketing_proposals.source` vaut `'programme'` ou `'soumis'`, et `topic_id`
relie la proposition au sujet d'origine.

---

## 13. Chaîne de production et rôles

| Étape | Agent Claude Code | Ce qu'il fait |
|---|---|---|
| 1 | `marketing-stratege` | QCM si le cadrage manque · scoring /100 · test des deux chaises · brief |
| 2 | `marketing-copywriter` | Texte final, carrousel slide par slide, 4 langues · bloc de vérification |
| 3 | `marketing-designer` | Brief visuel, système logo, prompt génératif, format d'export |
| 4 | `marketing-qa` | 4 critères bloquants puis checklist · verdict ✅/❌ |

Commandes : `/marketing-daily` (cycle du jour), `/marketing-serie` (série cadrée en 5 étapes
verrouillées), `/marketing-sujet` (mise en file), `/marketing-publish` (après validation seulement).

### Où atterrit un carrousel — deux écritures obligatoires

| Sortie | Fichier | Rôle |
|---|---|---|
| **Slides** | `src/data/marketing-carousels.ts` | Ce que l'onglet « Carrousels » de `/admin/marketing` **affiche**. Sans cette écriture, le travail est invisible pour Gérald. |
| **Dossier éditorial** | `marketing/proposals/*.md` | Captions, hashtags étendus, scoring détaillé, brief visuel, décisions d'adaptation, bloc de vérification. |

⚠️ **Leçon du 01/08/2026** : six carrousels ont été produits en Markdown seul et sont restés
invisibles dans l'admin toute une journée. Le contenu était juste, l'endroit ne l'était pas.
Un livrable qui n'apparaît pas à l'écran n'est pas livré.

Le `kind` de chaque slide (`hook` / `body` / `accent` / `save` / `rupture` / `cta`) pilote à la
fois le fond ET le traitement du logo — voir l'agent `marketing-copywriter` pour la table complète.

Le **chat web** de `/admin/marketing` mobilise les mêmes règles via ses 46 compétences, mais
n'exécute pas ce pipeline en quatre temps : il répond à la demande. Les deux surfaces partagent
ce socle — et lui seul.

**Règle absolue commune :** aucune publication réelle sans validation explicite de Gérald.
Un ✅ de QA signifie « prêt à être soumis », jamais « publiable ».
