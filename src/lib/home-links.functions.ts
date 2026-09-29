import { createServerFn } from "@tanstack/react-start";
import type { CityRow } from "@/lib/city-slug";
import type { HomeCityLink, HomeTherapist, HomeTherapistRow } from "@/lib/home-links";

/**
 * Lectures de l'accueil pour le maillage interne rendu au SSR (voir
 * `home-links.ts`). Client à clé publiable : la RLS s'applique comme pour un
 * visiteur, colonnes publiques explicites uniquement.
 *
 * Remplace trois lectures qui partaient du NAVIGATEUR (Nouveaux thérapeutes,
 * Thérapeutes à proximité, compteurs de cantons) par deux lectures légères
 * côté serveur, en parallèle : les fiches actives (13 au 29/09/2026) et la
 * table `cities` (même résolveur que le sitemap et la page ville).
 *
 * Lecture SECONDAIRE : en cas d'échec, `null` — les blocs concernés se
 * masquent, l'accueil reste servie (jamais de 503 pour un bloc de liens).
 */
export type HomeDirectoryLinks = {
  /** « Nouveaux thérapeutes » : 4 fiches avec photo, les plus récentes. */
  newest: HomeTherapist[];
  /** « Thérapeutes à proximité » : 20 fiches (liste + carte), vérifiées d'abord. */
  nearby: HomeTherapist[];
  cities: HomeCityLink[];
  cantonCounts: Record<string, number>;
};

async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const getHomeDirectoryLinks = createServerFn({ method: "GET" }).handler(async () => {
  const { timedOptionalRead } = await import("@/lib/read-metrics.server");
  return timedOptionalRead<HomeDirectoryLinks | null>(
    "home_directory_links",
    async () => {
      const {
        HOME_THERAPIST_COLUMNS,
        toHomeTherapists,
        pickNewest,
        pickNearby,
        indexableCities,
        cantonCounts,
      } = await import("@/lib/home-links");
      const supabase = await publicClient();
      const [therapistsRes, citiesRes] = await Promise.all([
        supabase
          .from("therapists")
          .select(HOME_THERAPIST_COLUMNS)
          .eq("status", "active")
          .not("slug", "is", null)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("cities").select("slug,canonical_name,aliases").limit(5000),
      ]);
      if (therapistsRes.error) throw new Error("Impossible de charger les fiches de l'accueil.");
      const rows = (therapistsRes.data ?? []) as unknown as HomeTherapistRow[];
      // `cities` illisible : repli sur la slugification directe, comme la page
      // ville (`loadCityResolver`) — le compte reste celui de la page.
      const cityRows = citiesRes.error ? [] : ((citiesRes.data ?? []) as CityRow[]);
      const therapists = toHomeTherapists(rows);
      // Seules les fiches AFFICHÉES partent dans la réponse (pas les 500).
      return {
        newest: pickNewest(therapists, 4),
        nearby: pickNearby(therapists, 20),
        cities: indexableCities(rows, cityRows),
        cantonCounts: cantonCounts(rows),
      };
    },
    null,
  );
});
