import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Lectures publiques (anonymes) pour les pages d'annuaire géographiques.
 * Client à clé publiable : la RLS s'applique comme pour un visiteur, et seules
 * les colonnes publiques sont projetées (jamais email ni téléphone).
 */
const PUBLIC_COLUMNS =
  "id,slug,first_name,last_name,title,short_bio,photo_url,city,canton,specialties,languages,price_min,price_max,currency,verified";

async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export type PublicTherapistCard = {
  id: string;
  slug: string | null;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  short_bio: string | null;
  photo_url: string | null;
  city: string | null;
  canton: string | null;
  specialties: string[] | null;
  languages: string[] | null;
  price_min: number | null;
  price_max: number | null;
  currency: string | null;
  verified: boolean | null;
};

export const listTherapistsByCanton = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ canton: z.string().min(2).max(2) }).parse(data))
  .handler(async ({ data }) => {
    const { timedRead } = await import("@/lib/read-metrics.server");
    return timedRead("directory_canton", async () => {
    const supabase = await publicClient();
    const { data: rows, error } = await supabase
      .from("therapists")
      .select(PUBLIC_COLUMNS)
      .eq("status", "active")
      .eq("canton", data.canton.toUpperCase())
      .not("slug", "is", null)
      .order("verified", { ascending: false })
      .limit(300);
    if (error) throw new Error("Impossible de charger les thérapeutes.");
    const { zurichDay } = await import("@/lib/directory-stats");
    return { therapists: (rows ?? []) as unknown as PublicTherapistCard[], asOf: zurichDay() };
    });
  });

/**
 * Tous les praticiens actifs, pour l'index rendu côté serveur de la page
 * d'annuaire.
 *
 * L'annuaire interroge `search_therapists` depuis le navigateur (recherche
 * temps réel, filtres, carte) : son HTML initial ne contenait donc AUCUN lien
 * vers une fiche — la page centrale de l'annuaire n'ouvrait aucun chemin de
 * crawl vers les profils (constat P0-2 de l'audit du 25/08/2026). Cette
 * lecture-ci alimente un index statique qui coexiste avec la recherche sans y
 * toucher.
 */
export const listAllPublicTherapists = createServerFn({ method: "GET" }).handler(async () => {
  const { timedRead } = await import("@/lib/read-metrics.server");
  return timedRead("directory_index", async () => {
  const supabase = await publicClient();
  const { data: rows, error } = await supabase
    .from("therapists")
    .select(PUBLIC_COLUMNS)
    .eq("status", "active")
    .not("slug", "is", null)
    .order("canton", { ascending: true })
    .order("last_name", { ascending: true })
    .limit(1000);
  if (error) throw new Error("Impossible de charger les thérapeutes.");
  return { therapists: (rows ?? []) as unknown as PublicTherapistCard[] };
  });
});

/**
 * Toutes les villes disposant d'au moins un thérapeute actif, avec leur canton
 * et leur nombre de fiches. Sert au listing par ville et au maillage interne.
 */
export const listPublicCities = createServerFn({ method: "GET" }).handler(async () => {
  const { timedRead } = await import("@/lib/read-metrics.server");
  return timedRead("directory_cities", async () => {
  const supabase = await publicClient();
  const { data: rows, error } = await supabase
    .from("therapists")
    .select("city,canton")
    .eq("status", "active")
    .not("city", "is", null)
    .limit(2000);
  if (error) throw new Error("Impossible de charger les villes.");

  const { citySlug } = await import("@/lib/geo-listings");
  const map = new Map<string, { slug: string; name: string; canton: string | null; count: number }>();
  for (const r of (rows ?? []) as Array<{ city: string | null; canton: string | null }>) {
    const name = (r.city ?? "").trim();
    if (!name) continue;
    const slug = citySlug(name);
    if (!slug) continue;
    const found = map.get(slug);
    if (found) found.count += 1;
    else map.set(slug, { slug, name, canton: r.canton, count: 1 });
  }
  return {
    cities: [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
  });
});

export const listTherapistsByCity = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ citySlug: z.string().min(1).max(120) }).parse(data))
  .handler(async ({ data }) => {
    const { timedRead } = await import("@/lib/read-metrics.server");
    return timedRead("directory_city", async () => {
    const supabase = await publicClient();
    const { data: rows, error } = await supabase
      .from("therapists")
      .select(PUBLIC_COLUMNS)
      .eq("status", "active")
      .not("city", "is", null)
      .not("slug", "is", null)
      .limit(2000);
    if (error) throw new Error("Impossible de charger les thérapeutes.");

    const { citySlug } = await import("@/lib/geo-listings");
    const wanted = data.citySlug.toLowerCase();
    const all = (rows ?? []) as unknown as PublicTherapistCard[];
    const therapists = all.filter((t) => citySlug(t.city ?? "") === wanted);
    const { zurichDay } = await import("@/lib/directory-stats");
    return {
      therapists,
      cityName: therapists[0]?.city ?? null,
      canton: therapists[0]?.canton ?? null,
      asOf: zurichDay(),
    };
    });
  });

/**
 * Chiffres globaux de l'annuaire pour l'accueil (Levier 1 du Baromètre GEO).
 *
 * Même filtre de publication que l'index de l'annuaire
 * (`listAllPublicTherapists`) : `status = 'active'` et `slug` non nul — le
 * total affiché est donc exactement le nombre de fiches qu'un visiteur trouve
 * listées. Deux lectures légères, en parallèle, colonnes explicites (anon n'a
 * pas `select=*` sur `therapists`) :
 *   1. les fiches publiées (colonnes nécessaires au calcul seulement) ;
 *   2. le pivot `therapist_specialties`, restreint aux spécialités actives du
 *      référentiel — le compte de spécialités ne lit JAMAIS le texte libre
 *      `therapists.specialties`, non normalisé.
 * Aucun cache : les chiffres sont ceux de la base au moment de la requête.
 */
export const getDirectoryStats = createServerFn({ method: "GET" }).handler(async () => {
  // Lecture SECONDAIRE : en cas d'échec, `null` (bloc masqué) et journal
  // `degraded=1`, jamais compté comme une panne de lecture essentielle.
  const { timedOptionalRead } = await import("@/lib/read-metrics.server");
  return timedOptionalRead("directory_stats", async () => {
    const supabase = await publicClient();
    const [therapistsRes, pivotRes] = await Promise.all([
      supabase
        .from("therapists")
        .select("id,verified,price_min,currency,canton,city,languages")
        .eq("status", "active")
        .not("slug", "is", null)
        .limit(5000),
      supabase
        .from("therapist_specialties")
        .select("therapist_id,specialty_id,specialties!inner(is_active)")
        .eq("specialties.is_active", true)
        .limit(20000),
    ]);
    if (therapistsRes.error) throw new Error("Impossible de calculer les chiffres de l'annuaire.");

    const { computeListingFacts, countProfileLanguages, zurichDay } =
      await import("@/lib/directory-stats");
    type Row = {
      id: string;
      verified: boolean | null;
      price_min: number | null;
      currency: string | null;
      canton: string | null;
      city: string | null;
      languages: string[] | null;
    };
    const rows = (therapistsRes.data ?? []) as unknown as Row[];
    const listed = new Set(rows.map((r) => r.id));

    // Pivot illisible : on n'affiche pas de compte de spécialités (null)
    // plutôt qu'un zéro faux ; le reste des chiffres reste valable.
    let specialtyCount: number | null = null;
    if (!pivotRes.error) {
      const ids = new Set<string>();
      for (const p of (pivotRes.data ?? []) as unknown as Array<{
        therapist_id: string;
        specialty_id: string;
      }>) {
        if (listed.has(p.therapist_id)) ids.add(p.specialty_id);
      }
      specialtyCount = ids.size;
    }

    return {
      ...computeListingFacts(rows),
      specialtyCount,
      languages: countProfileLanguages(rows),
      asOf: zurichDay(),
    };
  }, null);
});
