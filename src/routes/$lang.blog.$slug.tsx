import { createFileRoute, useParams } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/holiswiss/PagePlaceholder";

export const Route = createFileRoute("/$lang/blog/$slug")({
  component: Page,
});

function Page() {
  const { slug } = useParams({ from: "/$lang/blog/$slug" });
  return <PagePlaceholder title="Article" description={`Slug : ${slug}`} />;
}
