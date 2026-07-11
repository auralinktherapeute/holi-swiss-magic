import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Map as MapIcon, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CANTONS } from "@/lib/constants";

/**
 * « Holiswiss dans toute la Suisse » — les 26 cantons en liens cliquables
 * vers l'annuaire filtré. Les liens sont rendus statiquement (crawlables
 * par Google et les IA) ; seuls les compteurs s'hydratent côté client.
 */
export function CantonDirectory() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/" });

  const { data: counts } = useQuery({
    queryKey: ["canton-counts"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapists")
        .select("canton")
        .eq("status", "active");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of (data ?? []) as { canton: string | null }[]) {
        const code = (row.canton ?? "").toUpperCase().trim();
        if (code) map[code] = (map[code] ?? 0) + 1;
      }
      return map;
    },
  });

  return (
    <section className="bg-[#241040]/60">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-white">
          <MapIcon className="h-5 w-5 text-[#b86ef9]" aria-hidden />
          <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            {t("home.cantons.title", "Holiswiss dans toute la Suisse")}
          </h2>
        </div>
        <p className="mt-1 text-sm text-white/65">
          {t("home.cantons.subtitle", "Choisissez votre canton pour trouver un thérapeute près de chez vous")}
        </p>

        <ul className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {CANTONS.map((canton) => {
            const count = counts?.[canton.code] ?? 0;
            return (
              <li key={canton.code}>
                <Link
                  to="/$lang/therapeutes"
                  params={{ lang }}
                  search={{ canton: canton.code } as any}
                  className="group flex items-center justify-between gap-2 rounded-xl border border-[rgba(184,110,249,0.2)] bg-[#2d1248]/60 px-3.5 py-2.5 text-sm text-white/85 transition hover:border-[#b86ef9]/70 hover:bg-[#3d1a5c]/70"
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[#b86ef9]/70 transition group-hover:text-[#b86ef9]" aria-hidden />
                    <span className="truncate">{canton.name}</span>
                  </span>
                  {count > 0 && (
                    <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] px-1.5 text-[11px] font-bold text-white">
                      {count}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
