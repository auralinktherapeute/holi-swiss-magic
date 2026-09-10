import { createFileRoute, useParams } from "@tanstack/react-router";
import { getCategoryPage } from "@/lib/specialties.functions";
import { CategoryTherapistsPage, categoryCopy } from "@/components/holiswiss/CategoryTherapistsPage";
import { hreflangLinks, ogLocale } from "@/lib/seo";

export const Route = createFileRoute("/$lang/therapeutes/bien-etre")({
  component: Page,
  loader: async () => {
    try {
      return { page: await getCategoryPage({ data: { category: "bien-etre" } }) };
    } catch {
      return { page: null };
    }
  },
  head: ({ params }) => {
    const copy = categoryCopy("bien-etre", params.lang);
    const url = `https://holiswiss.ch/${params.lang}/therapeutes/bien-etre`;
    return {
      meta: [
        { title: copy.title },
        { name: "description", content: copy.description },
        { property: "og:title", content: copy.title },
        { property: "og:description", content: copy.description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { property: "og:locale", content: ogLocale(params.lang) },
      ],
      links: [{ rel: "canonical", href: url }, ...hreflangLinks("/therapeutes/bien-etre")],
    };
  },
});

function Page() {
  const { lang } = useParams({ from: "/$lang/therapeutes/bien-etre" });
  const loaderData = Route.useLoaderData();
  return (
    <CategoryTherapistsPage category="bien-etre" lang={lang} initialData={loaderData?.page ?? undefined} />
  );
}
