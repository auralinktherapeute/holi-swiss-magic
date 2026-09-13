import { createFileRoute, notFound } from "@tanstack/react-router";
import { VisibilityPillar } from "@/components/holiswiss/VisibilityPillar";
import { pillarHead } from "@/lib/visibility-pillar-content";

/** Page pilier — version italienne uniquement (`/it/visibilita-terapeuti-svizzera`). */
export const Route = createFileRoute("/$lang/visibilita-terapeuti-svizzera/")({
  beforeLoad: ({ params }) => {
    if (params.lang !== "it") throw notFound();
  },
  head: () => pillarHead("it"),
  component: () => <VisibilityPillar lang="it" />,
});
