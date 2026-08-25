import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Alias historique `/therapeutes/specialite/{slug}` → page spécialité canonique.
 * Évite deux URL pour un même contenu.
 */
export const Route = createFileRoute("/$lang/therapeutes/specialite/$specialtySlug")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$lang/specialites/$specialtySlug",
      params: { lang: params.lang, specialtySlug: params.specialtySlug },
      replace: true,
    });
  },
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
});
