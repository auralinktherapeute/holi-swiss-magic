import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, MapPin, Video, Users, ArrowLeft } from "lucide-react";
import { getPublishedEvent } from "@/lib/public.functions";
import { EventFlyer } from "@/components/events/EventFlyer";
import { Button } from "@/components/ui/button";

const SITE = "https://holiswiss.ch";

export const Route = createFileRoute("/$lang/evenements/$id")({
  component: Page,
  loader: async ({ params }) => {
    try {
      const res = await getPublishedEvent({ data: { id: params.id } });
      if (!res.event) throw notFound();
      return res;
    } catch (e) {
      throw notFound();
    }
  },
  notFoundComponent: () => (
    <main className="container mx-auto px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">Événement introuvable</h1>
      <p className="text-muted-foreground mt-2">Il a peut-être été retiré ou n'est plus disponible.</p>
    </main>
  ),
  errorComponent: () => (
    <main className="container mx-auto px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">Erreur de chargement</h1>
    </main>
  ),
  head: ({ params, loaderData }) => {
    const e = (loaderData as any)?.event;
    const url = `${SITE}/${params.lang}/evenements/${params.id}`;
    if (!e) {
      return { meta: [{ title: "Événement — HoliSwiss" }], links: [{ rel: "canonical", href: url }] };
    }
    const title = `${e.title} | HoliSwiss`.slice(0, 60);
    const description = (e.short_description || e.long_description || `Événement bien-être en Suisse.`).slice(0, 160);
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ];
    if (e.image_signed_url) {
      meta.push({ property: "og:image", content: e.image_signed_url });
      meta.push({ name: "twitter:image", content: e.image_signed_url });
    }
    const startDate = e.start_time
      ? `${e.event_date}T${e.start_time}`
      : e.event_date;
    const eventLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Event",
      name: e.title,
      startDate,
      description: e.short_description || e.long_description || undefined,
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: e.is_online
        ? "https://schema.org/OnlineEventAttendanceMode"
        : "https://schema.org/OfflineEventAttendanceMode",
      location: e.is_online
        ? { "@type": "VirtualLocation", url }
        : { "@type": "Place", name: e.location || "Suisse", address: e.location || "Suisse" },
      image: e.image_signed_url ? [e.image_signed_url] : undefined,
      organizer: { "@type": "Organization", name: "HoliSwiss", url: SITE },
      url,
    };
    return {
      meta,
      links: [
        { rel: "canonical", href: url },
        ...hreflangLinks(`/evenements/${params.id}`),
      ],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(eventLd) },
      ],
    };
  },
});

const CATEGORY_LABEL: Record<string, string> = {
  atelier: "Atelier", conference: "Conférence", retraite: "Retraite",
  cercle: "Cercle", meditation: "Méditation", autre: "Événement",
};

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } catch { return d; }
}

function Page() {
  const { lang, id } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["public-event", id],
    queryFn: () => getPublishedEvent({ data: { id } }),
    initialData: Route.useLoaderData() as any,
  });

  const e = data?.event;
  const t = data?.therapist;
  if (!e) return null;

  const flyerUrl = typeof window !== "undefined"
    ? `${window.location.origin}/${lang}/evenements/${id}`
    : `${SITE}/${lang}/evenements/${id}`;

  const therapistName = t ? `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() : null;

  return (
    <main className="container mx-auto px-4 py-8 sm:py-12 max-w-5xl">
      <Link to="/$lang/evenements" params={{ lang }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Tous les événements
      </Link>

      <article className="grid lg:grid-cols-[1.4fr_1fr] gap-8">
        <div className="space-y-6 min-w-0">
          <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-gradient-to-br from-primary/10 to-muted">
            {e.image_signed_url && (
              <img src={e.image_signed_url} alt={e.title} className="absolute inset-0 h-full w-full object-cover" />
            )}
            <span className="absolute top-3 left-3 rounded-full bg-card/90 backdrop-blur px-2.5 py-1 text-xs font-medium">
              {CATEGORY_LABEL[e.category] ?? e.category}
            </span>
          </div>

          <header className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{e.title}</h1>
            {therapistName && t?.slug && (
              <p className="text-muted-foreground">
                avec{" "}
                <Link to="/$lang/therapeute/$slug" params={{ lang, slug: t.slug }} className="text-primary hover:underline font-medium">
                  {therapistName}
                </Link>
              </p>
            )}
            {e.short_description && <p className="text-lg text-muted-foreground">{e.short_description}</p>}
          </header>

          <ul className="grid sm:grid-cols-2 gap-3 text-sm">
            <li className="flex items-center gap-2 rounded-lg border border-border p-3">
              <Calendar className="h-4 w-4 text-primary" />
              <span>{formatDate(e.event_date)}</span>
            </li>
            {e.start_time && (
              <li className="flex items-center gap-2 rounded-lg border border-border p-3">
                <Clock className="h-4 w-4 text-primary" />
                <span>{e.start_time}{e.end_time ? `–${e.end_time}` : ""}</span>
              </li>
            )}
            {e.location && (
              <li className="flex items-center gap-2 rounded-lg border border-border p-3">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="truncate">{e.location}</span>
              </li>
            )}
            {(e.format === "online" || e.format === "hybrid") && (
              <li className="flex items-center gap-2 rounded-lg border border-border p-3">
                <Video className="h-4 w-4 text-primary" />
                <span>En ligne</span>
              </li>
            )}
            {e.seats && (
              <li className="flex items-center gap-2 rounded-lg border border-border p-3">
                <Users className="h-4 w-4 text-primary" />
                <span>{e.seats} places</span>
              </li>
            )}
            <li className="flex items-center gap-2 rounded-lg border border-border p-3">
              <span className="font-semibold">
                {e.is_paid ? `${e.price} CHF` : "Gratuit"}
              </span>
              {e.price_description && <span className="text-muted-foreground">· {e.price_description}</span>}
            </li>
          </ul>

          {e.long_description && (
            <section className="prose prose-neutral max-w-none">
              <h2 className="text-xl font-semibold mb-2">Programme</h2>
              <p className="whitespace-pre-wrap text-foreground/90">{e.long_description}</p>
            </section>
          )}

          {t?.slug && (
            <div className="pt-2">
              <Button asChild size="lg">
                <Link to="/$lang/therapeute/$slug" params={{ lang, slug: t.slug }}>
                  Réserver une place
                </Link>
              </Button>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-semibold mb-3">Flyer à partager</h2>
            <EventFlyer
              data={{
                title: e.title,
                category: CATEGORY_LABEL[e.category] ?? e.category,
                dateLabel: formatDate(e.event_date),
                timeLabel: e.start_time ? `${e.start_time}${e.end_time ? `–${e.end_time}` : ""}` : null,
                location: e.location ?? null,
                priceLabel: e.is_paid ? `${e.price} CHF` : "Gratuit",
                therapistName,
                coverUrl: e.image_signed_url ?? null,
                targetUrl: flyerUrl,
              }}
              filename={`holiswiss-${e.title.toLowerCase().replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}.png`}
            />
          </div>
        </aside>
      </article>
    </main>
  );
}