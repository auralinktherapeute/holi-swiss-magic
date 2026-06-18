import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, MapPin, Video, Users } from "lucide-react";
import { listPublishedEvents } from "@/lib/public.functions";
import { hreflangLinks, ogLocale } from "@/lib/seo";

const SITE = "https://holiswiss.ch";

export const Route = createFileRoute("/$lang/evenements/")({
  component: Page,
  head: ({ params }) => {
    const url = `${SITE}/${params.lang}/evenements`;
    const title = "Événements bien-être en Suisse | HoliSwiss";
    const description =
      "Ateliers, retraites, cercles et méditations proposés par les thérapeutes holistiques de Suisse. Réservez votre place.";
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

const CATEGORY_LABEL: Record<string, string> = {
  atelier: "Atelier",
  conference: "Conférence",
  retraite: "Retraite",
  cercle: "Cercle",
  meditation: "Méditation",
  autre: "Événement",
};

const FORMAT_LABEL: Record<string, string> = {
  in_person: "Présentiel",
  online: "En ligne",
  hybrid: "Hybride",
};

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("fr-CH", {
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
  const { data, isLoading } = useQuery({
    queryKey: ["public-events"],
    queryFn: () => listPublishedEvents(),
  });

  const events = data?.events ?? [];

  return (
    <main className="container mx-auto px-4 py-10 sm:py-14 max-w-6xl">
      <header className="mb-8 sm:mb-12 text-center">
        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight">Événements bien-être</h1>
        <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
          Ateliers, retraites, cercles et méditations proposés par les thérapeutes de la communauté HoliSwiss.
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
          <p className="text-muted-foreground">Aucun événement publié pour le moment. Revenez bientôt.</p>
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
                    {CATEGORY_LABEL[e.category] ?? e.category}
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
                      {formatDate(e.event_date)}
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
                        {FORMAT_LABEL[e.format]}
                      </span>
                    )}
                    {e.seats && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {e.seats} places
                      </span>
                    )}
                  </div>
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-base font-semibold">
                      {e.is_paid ? (e.price ? `${e.price} CHF` : "Tarif à définir") : "Gratuit"}
                    </span>
                    {e.therapist_name && (
                      <span className="text-xs text-muted-foreground">avec {e.therapist_name}</span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}