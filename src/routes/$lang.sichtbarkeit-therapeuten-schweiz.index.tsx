import { withSocialHead } from "@/lib/social-meta";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { VisibilityPillar } from "@/components/holiswiss/VisibilityPillar";
import { pillarHead } from "@/lib/visibility-pillar-content";

/** Page pilier — version allemande uniquement (`/de/sichtbarkeit-therapeuten-schweiz`). */
export const Route = createFileRoute("/$lang/sichtbarkeit-therapeuten-schweiz/")({
  beforeLoad: ({ params }) => {
    if (params.lang !== "de") throw notFound();
  },
  head: withSocialHead(() => pillarHead("de")),
  component: () => <VisibilityPillar lang="de" />,
});
