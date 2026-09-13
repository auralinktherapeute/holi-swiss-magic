import { createFileRoute, notFound } from "@tanstack/react-router";
import { VisibilityPillar } from "@/components/holiswiss/VisibilityPillar";
import { pillarHead } from "@/lib/visibility-pillar-content";

/**
 * Page pilier — version française uniquement (`/fr/visibilite-therapeute-suisse`).
 *
 * Le slug est propre à la langue : sans le garde ci-dessous, `/de/visibilite-…`
 * et `/it/visibilite-…` répondraient 200 avec le même texte français — trois
 * URLs pour un seul contenu, exactement le doublon que les hreflang doivent
 * empêcher. `notFound()` est levé dans `beforeLoad`, donc avant l'émission de
 * la réponse : le statut HTTP est un vrai 404.
 */
export const Route = createFileRoute("/$lang/visibilite-therapeute-suisse/")({
  beforeLoad: ({ params }) => {
    if (params.lang !== "fr") throw notFound();
  },
  head: () => pillarHead("fr"),
  component: () => <VisibilityPillar lang="fr" />,
});
