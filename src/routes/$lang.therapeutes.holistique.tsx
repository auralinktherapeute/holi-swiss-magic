import { createFileRoute, useParams } from "@tanstack/react-router";
import { getCategoryPage } from "@/lib/specialties.functions";
import { CategoryTherapistsPage, categoryCopy } from "@/components/holiswiss/CategoryTherapistsPage";
import { hreflangLinks, ogLocale } from "@/lib/seo";
import { loadEssential } from "@/lib/read-health";
import { ServiceUnavailableNotice } from "@/components/holiswiss/ServiceUnavailableNotice";

export const Route = createFileRoute("/$lang/therapeutes/holistique")({
  component: Page,
  loader: async () => {
    const res = await loadEssential(() => getCategoryPage({ data: { category: "holistique" } }));
    if (!res.ok) return { page: null, unavailable: true as const };
    return { page: res.data, unavailable: false as const };
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
  if (loaderData?.unavailable) return <ServiceUnavailableNotice lang={lang} />;
  return (
    <CategoryTherapistsPage category="holistique" lang={lang} initialData={loaderData?.page ?? undefined} />
  );
}
