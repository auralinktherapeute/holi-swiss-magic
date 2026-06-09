import { createFileRoute, useParams } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/holiswiss/PagePlaceholder";

export const Route = createFileRoute("/$lang/therapeute/$slug")({
  component: Page,
});

function Page() {
  const { slug } = useParams({ from: "/$lang/therapeute/$slug" });
  return <PagePlaceholder title="Profil thérapeute" description={`Slug : ${slug}`} />;
}
