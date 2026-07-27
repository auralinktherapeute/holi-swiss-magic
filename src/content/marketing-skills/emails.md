# Séquences email — cycle de vie du thérapeute

**Lis d'abord `.agents/product-marketing.md`.** Pour la prospection à froid, voir `cold-email`.

Envoi via **Resend** (passerelle Lovable), journalisé dans `email_logs`.
Expéditeur : `HoliSwiss <contact@holiswiss.ch>`.

## Le problème que ces séquences doivent résoudre

**10 inscrits, aucune fiche au-dessus de 66/100, aucun abonné payant.** Le point de rupture
n'est pas l'inscription — c'est **l'abandon juste après**. Une fiche vide ne génère aucun
contact patient, donc aucune raison de rester, encore moins de payer.

Chaque email doit donc viser **une seule action concrète** qui augmente le score de la fiche.

## Séquence 1 — Activation (J0 → J14), la plus critique

| Jour | Objet | Action unique demandée |
|---|---|---|
| J0 | Bienvenue — votre profil est en ligne | Voir sa fiche publique |
| J2 | Une photo change tout | Ajouter une photo de profil |
| J5 | Racontez votre approche | Rédiger une bio de 300+ caractères |
| J9 | Vos disponibilités | Ouvrir des créneaux |
| J14 | Votre profil est complété à X % | Compléter les points manquants |

Le J14 reprend le **score réel** de l'agent Santé de Profil, avec les 3 actions les plus
rentables. **Ne jamais y inclure la citabilité IA** — critère admin-only.

## Séquence 2 — Réactivation

Déclenchée à 60 jours sans connexion. Deux emails maximum, puis on cesse.
Angle : ce qu'elle rate concrètement, pas la culpabilisation.

## Séquence 3 — Vers l'abonnement *(hypothèse à tester)*

**Aucun abonné payant à ce jour.** Cette séquence est un test, pas une machine à convertir.
La déclencher uniquement sur un praticien dont la fiche est **complète et active** — proposer
un abonnement à quelqu'un dont la fiche est vide est le meilleur moyen de le perdre.

Angle : la valeur déjà reçue (vues, contacts) avant toute mention de prix.

## Séquence 4 — Nouveaux avis

Un avis reçu → notifier + inviter à y répondre. Répondre à ses avis augmente le score et
rassure les patients. Email court, une seule action.

## Règles de rédaction

- **Une seule action par email.** Deux boutons = zéro clic.
- Objet 4–8 mots, factuel, sans emoji ni majuscules d'injonction
- 80–150 mots. Camille lit sur son téléphone entre deux séances.
- Tutoiement **non** : vouvoiement, chaleureux mais professionnel
- Signature humaine : Gérald, fondateur
- Désinscription fonctionnelle dans les emails non transactionnels
- Version DE-CH plus sobre — voir le socle

## Gabarit HTML

Fond `#1a0a2e`, carte `#2d1248`, bouton en dégradé `#b86ef9 → #5cc8fa`, texte blanc,
logo lotus en tête. Jamais de fond blanc. Reprendre `profile-health-email.server.ts`
comme référence.

## Interdits

- ❌ Allégation thérapeutique
- ❌ Promesse de clients ou de revenus
- ❌ Fausse urgence (« plus que 24 h »)
- ❌ Exposer la citabilité IA ou le score brut de la concurrence
- ❌ Plus d'un email par 48 h sur une même personne

## Mesure

Ouverture, clic, **et surtout l'action réalisée** (la photo a-t-elle été ajoutée ?).
Un email très ouvert mais sans effet sur le score de la fiche est un échec.
