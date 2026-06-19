import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PagePlaceholder } from "@/components/holiswiss/PagePlaceholder";
import { hreflangLinks } from "@/lib/seo";

export const Route = createFileRoute("/$lang/contact/")({
  component: Page,
  head: ({ params }) => {
    const lang = params.lang;
    const titles: Record<string, string> = {
      fr: "Contact — Holiswiss",
      de: "Kontakt — Holiswiss",
      it: "Contatto — Holiswiss",
      en: "Contact — Holiswiss",
    };
    const descs: Record<string, string> = {
      fr: "Une question, une suggestion ou un partenariat ? Contactez l'équipe Holiswiss à contact@holiswiss.ch. Nous répondons sous 48 heures.",
      de: "Eine Frage, ein Vorschlag oder eine Partnerschaft? Kontaktieren Sie das Holiswiss-Team unter contact@holiswiss.ch. Antwort innerhalb von 48 Stunden.",
      it: "Una domanda, un suggerimento o una partnership? Contatta il team Holiswiss su contact@holiswiss.ch. Rispondiamo entro 48 ore.",
      en: "A question, suggestion or partnership? Contact the Holiswiss team at contact@holiswiss.ch. We reply within 48 hours.",
    };
    const title = titles[lang] ?? titles.fr;
    const description = descs[lang] ?? descs.fr;
    const url = `https://holiswiss.ch/${lang}/contact`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: url }, ...hreflangLinks("/contact")],
    };
  },
});

function Page() {
  const { t } = useTranslation();
  return <PagePlaceholder title={t("nav.contact")} description={t("common.soon")} />;
}
