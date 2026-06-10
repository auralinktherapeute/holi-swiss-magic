import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BadgeCheck, Languages, MapPin, Star } from "lucide-react";
import { BookingWidget } from "@/components/booking/BookingWidget";

const PUBLIC_THERAPIST_SELECT = [
  "id", "slug", "first_name", "last_name", "title", "bio", "photo_url", "specialties",
  "languages", "canton", "price_min", "currency", "verified", "accreditations",
].join(",");

export const Route = createFileRoute("/$lang/therapeute/$slug")({
  component: Page,
});

function Page() {
  const { slug, lang } = useParams({ from: "/$lang/therapeute/$slug" });
  const { t } = useTranslation();

  const { data: th, isLoading, error } = useQuery({
    queryKey: ["therapist", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapists")
        .select(PUBLIC_THERAPIST_SELECT)
        .eq("slug", slug)
        .maybeSingle() as any;
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!th) return;
    const fullName = `${th.first_name ?? ""} ${th.last_name ?? ""}`.trim();
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Person",
      name: fullName,
      jobTitle: Array.isArray((th as any).specialties) ? (th as any).specialties[0] : th.title ?? undefined,
      description: th.bio ?? undefined,
      address: {
        "@type": "PostalAddress",
        addressRegion: th.canton ?? undefined,
        addressCountry: "CH",
      },
      url: `https://holiswiss.ch/${lang}/therapeute/${slug}`,
      ...(th.price_min != null
        ? {
            offers: {
              "@type": "Offer",
              price: String(th.price_min),
              priceCurrency: th.currency ?? "CHF",
            },
          }
        : {}),
    };
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = "therapist-jsonld";
    el.textContent = JSON.stringify(jsonLd);
    document.querySelectorAll("#therapist-jsonld").forEach((n) => n.remove());
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, [th, lang, slug]);

  const { data: reviews } = useQuery({
    queryKey: ["reviews", th?.id],
    enabled: !!th?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at")
        .eq("therapist_id", th!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="h-72 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-destructive">{t("therapist_page.error_generic", "Impossible de charger ce profil pour le moment.")}</p>
      </div>
    );
  }

  if (!th) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">{t("therapist_page.not_found")}</h1>
        <Link to="/$lang/therapeutes" params={{ lang }} className="mt-4 inline-block text-primary underline">
          {t("therapist_page.back_to_directory")}
        </Link>
      </div>
    );
  }

  const fullName = `${th.first_name} ${th.last_name}`.trim();
  const avg =
    reviews && reviews.length
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-8 md:grid-cols-[280px,1fr]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="aspect-square w-full bg-muted">
            {th.photo_url ? (
              <img src={th.photo_url} alt={fullName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-6xl font-bold text-muted-foreground/40">
                {fullName.slice(0, 1)}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{fullName}</h1>
            {th.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                <BadgeCheck className="h-3.5 w-3.5" /> {t("directory.verified")}
              </span>
            )}
            {th.title && (
              <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                {th.title}
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
            {th.languages?.length ? (
              <span className="inline-flex items-center gap-1.5">
                <Languages className="h-4 w-4" />
                {th.languages.join(", ")}
              </span>
            ) : null}
            {th.canton && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {th.canton}
              </span>
            )}
            {avg && (
              <span className="inline-flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {avg} ({reviews?.length})
              </span>
            )}
          </div>

          {Array.isArray((th as any).accreditations) && (th as any).accreditations.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {((th as any).accreditations as { org: string; number?: string }[]).map((a) => (
                <span
                  key={a.org}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                  title={a.number ? `N° ${a.number}` : undefined}
                >
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {t("profile_edit.approved_by")} {a.org}
                </span>
              ))}
            </div>
          )}

          {th.bio && <p className="mt-6 whitespace-pre-line text-foreground/80">{th.bio}</p>}

          {th.price_min != null && (
            <p className="mt-6 text-lg font-semibold text-foreground">
              {th.currency ?? "CHF"} {th.price_min}
              <span className="ml-1 text-sm font-normal text-muted-foreground">{t("directory.per_session")}</span>
            </p>
          )}
        </div>
      </div>

      <section className="mt-10">
        <BookingWidget therapistId={th.id} />
      </section>

      {reviews && reviews.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-semibold text-foreground">{t("therapist_page.reviews")}</h2>
          <ul className="mt-6 space-y-4">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-1 text-amber-400">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                {r.comment && <p className="mt-2 text-sm text-foreground/80">{r.comment}</p>}
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
