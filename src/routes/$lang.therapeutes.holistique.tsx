import { createFileRoute, useParams } from "@tanstack/react-router";
import { getCategoryPage } from "@/lib/specialties.functions";
import { CategoryTherapistsPage, categoryCopy } from "@/components/holiswiss/CategoryTherapistsPage";
import { hreflangLinks, ogLocale } from "@/lib/seo";

export const Route = createFileRoute("/$lang/therapeutes/holistique")({
  component: Page,
  loader: async () => {
    try {
      return { page: await getCategoryPage({ data: { category: "holistique" } }) };
    } catch {
      return { page: null };
    }
  },
  head: ({ params }) => {
    const copy = categoryCopy("holistique", params.lang);
    const url = `https://holiswiss.ch/${params.lang}/therapeutes/holistique`;
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
      links: [{ rel: "canonical", href: url }, ...hreflangLinks("/therapeutes/holistique")],
    };
  },
});

function Page() {
  const { lang } = useParams({ from: "/$lang/therapeutes/holistique" });
  const loaderData = Route.useLoaderData();
  return (
    <CategoryTherapistsPage category="holistique" lang={lang} initialData={loaderData?.page ?? undefined} />
  );
}
