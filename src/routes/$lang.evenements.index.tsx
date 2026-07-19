import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, MapPin, Video, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { listPublishedEvents } from "@/lib/public.functions";
import { hreflangLinks, ogLocale } from "@/lib/seo";
import { FaqSection } from "@/components/holiswiss/FaqSection";
import { EVENTS_FAQ, FAQ_TITLES, asFaqLang } from "@/lib/faq-content";

const SITE = "https://holiswiss.ch";

export const Route = createFileRoute("/$lang/evenements/")({
  component: Page,
  head: ({ params }) => {
    const url = `${SITE}/${params.lang}/evenements`;
    const titles: Record<string, string> = {
      fr: "Événements bien-être en Suisse | HoliSwiss",
      de: "Wellness-Veranstaltungen in der Schweiz | HoliSwiss",
      it: "Eventi benessere in Svizzera | HoliSwiss",
      en: "Wellness events in Switzerland | HoliSwiss",
    };
    const descs: Record<string, string> = {
      fr: "Ateliers, retraites, cercles et méditations proposés par les thérapeutes holistiques de Suisse. Réservez votre place.",
      de: "Workshops, Retreats, Kreise und Meditationen von holistischen Therapeut:innen in der Schweiz. Reservieren Sie Ihren Platz.",
      it: "Laboratori, ritiri, cerchi e meditazioni dei terapisti olistici in Svizzera. Prenota il tuo posto.",
      en: "Workshops, retreats, circles and meditations from holistic therapists in Switzerland. Book your seat.",
    };
    const title = titles[params.lang] ?? titles.fr;
    const description = descs[params.lang] ?? descs.fr;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:locale", content: ogLocale(params.lang) },
      ],
      links: [{ rel: "canonical", href: url }, ...hreflangLinks("/evenements")],
    };
  },
});

const LOCALE_MAP: Record<string, string> = { fr: "fr-CH", de: "de-CH", it: "it-CH", en: "en-GB" };
function formatDate(d: string, lang: string) {
  try {
    return new Date(d).toLocaleDateString(LOCALE_MAP[lang] ?? "fr-CH", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function Page() {
  const { lang } = Route.useParams();
  const { t, i18n } = useTranslation();
  if (i18n.language !== lang) i18n.changeLanguage(lang);
  const { data, isLoading } = useQuery({
    queryKey: ["public-events"],
    queryFn: () => listPublishedEvents(),
  });

  const events = data?.events ?? [];

  return (
    <main className="container mx-auto px-4 py-10 sm:py-14 max-w-6xl">
      <header className="mb-8 sm:mb-12 text-center">
        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight">{t("events_page.title")}</h1>
        <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
          {t("events_page.subtitle")}
        </p>
      </header>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[16/12] rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-12 text-center">
          <p className="text-muted-foreground">{t("events_page.empty")}</p>
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map((e: any) => (
            <li key={e.id}>
              <Link
                to="/$lang/evenements/$id"
                params={{ lang, id: e.id }}
                className="group block rounded-2xl overflow-hidden border border-border bg-card hover:shadow-lg transition-shadow"
              >
                <div className="relative aspect-[16/10] bg-gradient-to-br from-primary/10 to-muted overflow-hidden">
                  {e.image_signed_url ? (
                    <img
                      src={e.image_signed_url}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : null}
                  <span className="absolute top-3 left-3 rounded-full bg-card/90 backdrop-blur px-2.5 py-1 text-xs font-medium">
                    {t(`events_page.categories.${e.category}`, { defaultValue: e.category })}
                  </span>
                </div>
                <div className="p-4 space-y-2">
                  <h2 className="font-semibold text-lg leading-tight line-clamp-2">{e.title}</h2>
                  {e.short_description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{e.short_description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-1">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(e.event_date, lang)}
                    </span>
                    {e.start_time && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {e.start_time}
                        {e.end_time ? `–${e.end_time}` : ""}
                      </span>
                    )}
                    {(e.format === "in_person" || e.format === "hybrid") && e.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {e.location}
                      </span>
                    )}
                    {(e.format === "online" || e.format === "hybrid") && (
                      <span className="inline-flex items-center gap-1">
                        <Video className="h-3.5 w-3.5" />
                        {t(`events_page.formats.${e.format}`, { defaultValue: e.format })}
                      </span>
                    )}
                    {e.seats && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {e.seats} {t("events_page.seats")}
                      </span>
                    )}
                  </div>
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-base font-semibold">
                      {e.is_paid ? (e.price ? `${e.price} CHF` : t("events_page.price_tbd")) : t("events_page.free")}
                    </span>
                    {e.therapist_name && (
                      <span className="text-xs text-muted-foreground">{t("events_page.with")} {e.therapist_name}</span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <FaqSection
        items={EVENTS_FAQ[asFaqLang(lang)]}
        title={FAQ_TITLES[asFaqLang(lang)].title}
        subtitle={FAQ_TITLES[asFaqLang(lang)].subtitle}
        className="mx-auto w-full max-w-3xl px-4 py-16"
      />
    </main>
  );
}