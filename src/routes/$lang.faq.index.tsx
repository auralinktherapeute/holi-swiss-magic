import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { FAQ_PAGE } from "@/lib/faq-page-content";
import { asFaqLang } from "@/lib/faq-content";
import { hreflangLinks, ogLocale } from "@/lib/seo";

const META: Record<string, { title: string; description: string }> = {
  fr: {
    title: "FAQ — Trouver un thérapeute holistique en Suisse | Holiswiss",
    description:
      "Questions fréquentes sur Holiswiss : trouver un thérapeute en Suisse, remboursement des médecines douces (LAMal, ASCA, RME), spécialités et réservation. 4 langues.",
  },
  de: {
    title: "FAQ — Ganzheitliche Therapeuten in der Schweiz finden | Holiswiss",
    description:
      "Häufige Fragen zu Holiswiss: Therapeuten in der Schweiz finden, Rückerstattung der Komplementärmedizin (KVG, ASCA, EMR), Fachgebiete und Buchung. 4 Sprachen.",
  },
  it: {
    title: "FAQ — Trovare un terapeuta olistico in Svizzera | Holiswiss",
    description:
      "Domande frequenti su Holiswiss: trovare un terapeuta in Svizzera, rimborso delle medicine dolci (LAMal, ASCA, RME), specialità e prenotazione. 4 lingue.",
  },
  en: {
    title: "FAQ — Find a holistic therapist in Switzerland | Holiswiss",
    description:
      "Frequently asked questions about Holiswiss: finding a therapist in Switzerland, reimbursement of complementary medicine (LAMal, ASCA, RME), specialties and booking. 4 languages.",
  },
};

const CRUMB_FAQ: Record<string, string> = { fr: "FAQ", de: "FAQ", it: "FAQ", en: "FAQ" };
const CRUMB_HOME: Record<string, string> = { fr: "Accueil", de: "Startseite", it: "Home", en: "Home" };

export const Route = createFileRoute("/$lang/faq/")({
  component: FaqPage,
  head: ({ params }) => {
    const lang = params.lang;
    const meta = META[lang] ?? META.fr;
    const url = `https://holiswiss.ch/${lang}/faq`;
    const l = asFaqLang(lang);
    const content = FAQ_PAGE[l];
    const allItems = content.categories.flatMap((c) => c.items);
    const faqLd = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      inLanguage: lang,
      isPartOf: { "@id": "https://holiswiss.ch/#website" },
      mainEntity: allItems.map((it) => ({
        "@type": "Question",
        name: it.q,
        acceptedAnswer: { "@type": "Answer", text: it.a },
      })),
    };
    const breadcrumbLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: CRUMB_HOME[lang] ?? "Accueil", item: `https://holiswiss.ch/${lang}` },
        { "@type": "ListItem", position: 2, name: CRUMB_FAQ[lang] ?? "FAQ", item: url },
      ],
    };
    return {
      meta: [
        { title: meta.title },
        { name: "description", content: meta.description },
        { property: "og:title", content: meta.title },
        { property: "og:description", content: meta.description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { property: "og:locale", content: ogLocale(lang) },
      ],
      links: [{ rel: "canonical", href: url }, ...hreflangLinks("/faq")],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(faqLd) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumbLd) },
      ],
    };
  },
});

function FaqPage() {
  const { lang } = useParams({ from: "/$lang/faq/" });
  const l = asFaqLang(lang);
  const content = FAQ_PAGE[l];

  return (
    <div className="min-h-screen bg-[#0f0a1e]">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <nav aria-label="breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-white/50">
          <Link to="/$lang" params={{ lang }} className="hover:text-white">
            {CRUMB_HOME[lang] ?? "Accueil"}
          </Link>
          <span>›</span>
          <span className="text-white">{CRUMB_FAQ[lang] ?? "FAQ"}</span>
        </nav>

        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{content.h1}</h1>
          <p className="mt-4 text-sm leading-relaxed text-[#d4c4e0] sm:text-base">{content.intro}</p>
        </header>

        {content.categories.map((cat) => (
          <section key={cat.id} className="mb-10">
            <h2 className="mb-4 text-xl font-semibold text-white sm:text-2xl">{cat.title}</h2>
            <div className="space-y-3">
              {cat.items.map((it, i) => (
                <details
                  key={i}
                  className="group rounded-2xl border border-[rgba(184,110,249,0.2)] bg-[#3d1a5c]/40 px-5 py-4 transition-colors open:border-[rgba(184,110,249,0.45)] open:bg-[#3d1a5c]/60"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-white outline-none [&::-webkit-details-marker]:hidden">
                    <span>{it.q}</span>
                    <span aria-hidden="true" className="shrink-0 text-[#b86ef9] transition-transform duration-300 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <div className="mt-3 text-sm leading-relaxed text-[#d4c4e0] sm:text-[15px]">{it.a}</div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
