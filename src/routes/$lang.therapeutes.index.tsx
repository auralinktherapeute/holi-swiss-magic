import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Languages, BadgeCheck, Star } from "lucide-react";

export const Route = createFileRoute("/$lang/therapeutes/")({
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/therapeutes/" });

  const { data, isLoading, error } = useQuery({
    queryKey: ["therapists", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapists")
        .select("id, slug, display_name, bio, photo_url, canton_id, specialty_ids, price_per_session, languages, is_verified, plan")
        .eq("status", "active")
        .order("is_verified", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t("directory.title")}
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{t("directory.subtitle")}</p>
      </header>

      {isLoading && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </p>
      )}

      {!isLoading && !error && data && data.length === 0 && (
        <p className="text-muted-foreground">Aucun thérapeute pour le moment.</p>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((th) => (
          <Link
            key={th.id}
            to="/$lang/therapeute/$slug"
            params={{ lang, slug: th.slug }}
            className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:border-primary/40 hover:shadow-lg"
          >
            <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
              {th.photo_url ? (
                <img
                  src={th.photo_url}
                  alt={th.display_name}
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-muted-foreground/40">
                  {th.display_name.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">{th.display_name}</h2>
                {th.is_verified && <BadgeCheck className="h-4 w-4 text-primary" aria-label="Vérifié" />}
              </div>
              {th.bio && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{th.bio}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {th.languages?.length ? (
                  <span className="inline-flex items-center gap-1">
                    <Languages className="h-3.5 w-3.5" />
                    {th.languages.join(", ")}
                  </span>
                ) : null}
                {th.canton_id && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {th.canton_id}
                  </span>
                )}
              </div>
              {th.price_per_session != null && (
                <p className="mt-4 text-sm font-medium text-foreground">
                  CHF {th.price_per_session} <span className="text-muted-foreground">/ séance</span>
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
