import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

function serverClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Lang = "fr" | "de" | "it" | "en";
function pickLang(lang: string): Lang {
  return (["fr", "de", "it", "en"].includes(lang) ? lang : "fr") as Lang;
}
export function pickI18n<T extends Record<string, any>>(row: T, lang: string, field: "name" | "description" = "name"): string {
  const l = pickLang(lang);
  return (row[`${field}_${l}`] as string) || (row[`${field}_fr`] as string) || "";
}

/**
 * Slug localisé d'une spécialité, avec repli sur `slug`.
 *
 * `slug_fr` n'existe pas et n'existera pas : le slug de base EST le slug
 * français (vérifié sur les 31 lignes, zéro différence). Une seconde colonne
 * serait une source de vérité concurrente.
 *
 * Beaucoup de spécialités portent le même mot dans plusieurs langues — Yoga,
 * Reiki, Shiatsu, Ayurveda, EMDR sont identiques dans les quatre. Le slug
 * localisé y vaut alors le slug de base, et c'est normal.
 */
export function specialtySlugForLang(row: Record<string, any>, lang: string): string {
  const l = pickLang(lang);
  return (row[`slug_${l}`] as string) || (row["slug"] as string) || "";
}

/** Les colonnes de slug localisé peuvent manquer si la migration n'est pas appliquée. */
function isMissingColumn(error: any): boolean {
  const code = error?.code ?? "";
  const msg = String(error?.message ?? "");
  return code === "42703" || code === "PGRST204" || code === "PGRST205" || /does not exist|could not find the column/i.test(msg);
}

const SPECIALTY_COLUMNS_BASE =
  "id,slug,name_fr,name_de,name_it,name_en,description_fr,description_de,description_it,description_en,family_id,aliases";
const SPECIALTY_COLUMNS_FULL =
  "id,slug,slug_de,slug_it,slug_en,name_fr,name_de,name_it,name_en,description_fr,description_de,description_it,description_en,family_id,aliases";

/**
 * Retrouve une spécialité active par son slug de base OU l'un de ses slugs
 * localisés, pour ne jamais 404 une URL déjà publiée — y compris les anciennes
 * URL françaises servies en /en/ et /it/ avant les slugs localisés.
 *
 * `maybeSingle()` suppose qu'un slug ne désigne qu'une spécialité : la
 * migration `20260827090000` échoue si une ambiguïté existe.
 */
/**
 * Exécute une requête de liste en tentant d'abord d'inclure les slugs
 * localisés, puis en repliant sur les colonnes de base si elles n'existent
 * pas encore. `build` doit accepter la liste de colonnes et rendre la requête.
 */
async function selectSpecialties(
  build: (columns: string) => any,
  columnsBase: string,
  columnsFull: string,
): Promise<any[]> {
  const enriched = await build(columnsFull);
  if (!enriched.error) return enriched.data ?? [];
  if (!isMissingColumn(enriched.error)) return [];
  const base = await build(columnsBase);
  return base.data ?? [];
}

const LIST_COLUMNS_BASE = "id,slug,name_fr,name_de,name_it,name_en,family_id,is_featured,categories";
const LIST_COLUMNS_FULL = "id,slug,slug_de,slug_it,slug_en,name_fr,name_de,name_it,name_en,family_id,is_featured,categories";
const SIBLING_COLUMNS_BASE = "id,slug,name_fr,name_de,name_it,name_en";
const SIBLING_COLUMNS_FULL = "id,slug,slug_de,slug_it,slug_en,name_fr,name_de,name_it,name_en";
const FAMILY_SPEC_COLUMNS_BASE =
  "id,slug,name_fr,name_de,name_it,name_en,description_fr,description_de,description_it,description_en,is_featured";
const FAMILY_SPEC_COLUMNS_FULL =
  "id,slug,slug_de,slug_it,slug_en,name_fr,name_de,name_it,name_en,description_fr,description_de,description_it,description_en,is_featured";

async function findActiveSpecialty(sb: ReturnType<typeof serverClient>, slug: string) {
  const enriched = await sb
    .from("specialties")
    .select(SPECIALTY_COLUMNS_FULL)
    .or(`slug.eq.${slug},slug_de.eq.${slug},slug_it.eq.${slug},slug_en.eq.${slug}`)
    .eq("is_active", true)
    .maybeSingle();
  if (!enriched.error) return enriched.data;
  if (!isMissingColumn(enriched.error)) return null;

  const base = await sb
    .from("specialties")
    .select(SPECIALTY_COLUMNS_BASE)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return base.data;
}

export type FamilyRow = {
  id: string;
  slug: string;
  name_fr: string;
  name_de: string | null;
  name_it: string | null;
  name_en: string | null;
  description_fr: string | null;
  description_de: string | null;
  description_it: string | null;
  description_en: string | null;
  icon: string | null;
  sort_order: number;
};

export type SpecialtyRow = {
  id: string;
  slug: string;
  name_fr: string;
  name_de: string | null;
  name_it: string | null;
  name_en: string | null;
  description_fr: string | null;
  description_de: string | null;
  description_it: string | null;
  description_en: string | null;
  family_id: string;
  aliases: string[];
  is_featured: boolean;
};

export const listFamiliesWithCounts = createServerFn({ method: "GET" }).handler(
  async () => {
    const sb = serverClient();
    const [{ data: families }, specs, { data: pivot }] = await Promise.all([
      sb
        .from("specialty_families")
        .select("id,slug,name_fr,name_de,name_it,name_en,description_fr,description_de,description_it,description_en,icon,sort_order")
        .order("sort_order", { ascending: true }),
      selectSpecialties(
        (cols) => sb.from("specialties").select(cols).eq("is_active", true),
        LIST_COLUMNS_BASE,
        LIST_COLUMNS_FULL,
      ),
      sb.from("therapist_specialties").select("specialty_id"),
    ]);

    const countsBySpec = new Map<string, number>();
    for (const row of (pivot ?? []) as Array<{ specialty_id: string }>) {
      countsBySpec.set(row.specialty_id, (countsBySpec.get(row.specialty_id) ?? 0) + 1);
    }

    const specsByFamily = new Map<string, Array<any>>();
    for (const s of (specs ?? []) as Array<any>) {
      const arr = specsByFamily.get(s.family_id) ?? [];
      arr.push({
        id: s.id,
        slug: s.slug,
        slug_de: s.slug_de ?? null,
        slug_it: s.slug_it ?? null,
        slug_en: s.slug_en ?? null,
        name_fr: s.name_fr,
        name_de: s.name_de,
        name_it: s.name_it,
        name_en: s.name_en,
        count: countsBySpec.get(s.id) ?? 0,
        is_featured: s.is_featured,
      });
      specsByFamily.set(s.family_id, arr);
    }

    return ((families ?? []) as FamilyRow[]).map((f) => {
      const items = specsByFamily.get(f.id) ?? [];
      const totalTherapists = items.reduce((n, s) => n + s.count, 0);
      return {
        ...f,
        specialties: items.sort((a, b) => a.name_fr.localeCompare(b.name_fr)),
        therapist_count: totalTherapists,
      };
    });
  },
);

export const searchSpecialties = createServerFn({ method: "POST" })
  .inputValidator((data: { q: string; lang?: string }) => {
    const q = String(data?.q ?? "").trim();
    return { q: q.slice(0, 80), lang: String(data?.lang ?? "fr").slice(0, 5) };
  })
  .handler(async ({ data }) => {
    if (data.q.length < 2) return [];
    const sb = serverClient();
    const { data: rows, error } = await sb.rpc("search_specialties", {
      _q: data.q,
      _limit: 10,
      _lang: data.lang,
    });
    if (error) return [];
    return (rows ?? []) as Array<any>;
  });

export const getFamilyPage = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => ({ slug: String(data?.slug ?? "").slice(0, 80) }))
  .handler(async ({ data }) => {
    const sb = serverClient();
    const { data: family } = await sb
      .from("specialty_families")
      .select("id,slug,name_fr,name_de,name_it,name_en,description_fr,description_de,description_it,description_en,icon")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!family) return null;

    const specs = await selectSpecialties(
      (cols) =>
        sb
          .from("specialties")
          .select(cols)
          .eq("family_id", (family as { id: string }).id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      FAMILY_SPEC_COLUMNS_BASE,
      FAMILY_SPEC_COLUMNS_FULL,
    );

    const specIds = (specs ?? []).map((s: { id: string }) => s.id);
    let therapistIds: string[] = [];
    if (specIds.length > 0) {
      const { data: pivot } = await sb
        .from("therapist_specialties")
        .select("therapist_id")
        .in("specialty_id", specIds);
      therapistIds = Array.from(new Set(((pivot ?? []) as Array<{ therapist_id: string }>).map((p) => p.therapist_id)));
    }

    let therapists: any[] = [];
    if (therapistIds.length > 0) {
      const { data: ts } = await sb
        .from("therapists")
        .select("id,slug,first_name,last_name,title,short_bio,photo_url,city,canton,price_min,price_max,currency,verified,specialties")
        .in("id", therapistIds)
        .eq("status", "active")
        .order("verified", { ascending: false })
        .limit(60);
      therapists = ts ?? [];
    }

    return { family, specialties: specs ?? [], therapists };
  });

export const getSpecialtyPage = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => ({ slug: String(data?.slug ?? "").slice(0, 80) }))
  .handler(async ({ data }) => {
    const sb = serverClient();
    const specialty = await findActiveSpecialty(sb, data.slug);
    if (!specialty) return null;

    const s = specialty as any;

    const { data: family } = await sb
      .from("specialty_families")
      .select("id,slug,name_fr,name_de,name_it,name_en")
      .eq("id", s.family_id)
      .maybeSingle();

    const siblings = await selectSpecialties(
      (cols) =>
        sb
          .from("specialties")
          .select(cols)
          .eq("family_id", s.family_id)
          .eq("is_active", true)
          .neq("id", s.id)
          .order("sort_order", { ascending: true })
          .limit(8),
      SIBLING_COLUMNS_BASE,
      SIBLING_COLUMNS_FULL,
    );

    const { data: pivot } = await sb
      .from("therapist_specialties")
      .select("therapist_id")
      .eq("specialty_id", s.id);
    const ids = ((pivot ?? []) as Array<{ therapist_id: string }>).map((p) => p.therapist_id);

    let therapists: any[] = [];
    if (ids.length > 0) {
      const { data: ts } = await sb
        .from("therapists")
        .select("id,slug,first_name,last_name,title,short_bio,photo_url,city,canton,price_min,price_max,currency,verified,specialties")
        .in("id", ids)
        .eq("status", "active")
        .order("verified", { ascending: false })
        .limit(60);
      therapists = ts ?? [];
    }

    return { specialty: s, family, siblings: siblings ?? [], therapists };
  });

export const listAllSpecialties = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverClient();
  const [{ data: families }, specs] = await Promise.all([
    sb.from("specialty_families").select("id,slug,name_fr,name_de,name_it,name_en,sort_order").order("sort_order"),
    selectSpecialties(
      (cols) => sb.from("specialties").select(cols).eq("is_active", true),
      LIST_COLUMNS_BASE,
      LIST_COLUMNS_FULL,
    ),
  ]);
  return {
    families: (families ?? []) as Array<any>,
    specialties: (specs ?? []) as Array<any>,
  };
});

// ─── GEO page: therapists in a given city for a given specialty ───
export const getSpecialtyCityPage = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string; city: string }) => ({
    slug: String(data?.slug ?? "").slice(0, 80),
    city: String(data?.city ?? "").slice(0, 80),
  }))
  .handler(async ({ data }) => {
    const sb = serverClient();
    const specialty = await findActiveSpecialty(sb, data.slug);
    if (!specialty) return null;

    const { data: cityRow } = await sb.rpc("resolve_city", { _input: data.city });
    const cityBase = Array.isArray(cityRow) ? cityRow[0] : cityRow;
    if (!cityBase) return { specialty, family: null, city: null, therapists: [] };

    // Slug canonique de la ville — SOURCE UNIQUE (cities.slug, migration
    // 20260825140000). Ni `canonical_name` (« Geneva », en anglais) ni
    // `display_name` (« Genève, Suisse ») ne décrivent l'URL publiée : les
    // slugifier avait fait rediriger /geneve, pourtant au sitemap, vers
    // /geneva. La colonne peut être absente si la migration n'est pas encore
    // appliquée — on retombe alors silencieusement sur `slug: null`, qui
    // désactive simplement la canonicalisation d'alias.
    let citySlug: string | null = null;
    try {
      const { data: slugRow } = await sb
        .from("cities")
        .select("slug")
        .eq("canonical_name", (cityBase as any).canonical_name)
        .maybeSingle();
      citySlug = ((slugRow as any)?.slug as string | undefined) ?? null;
    } catch {
      citySlug = null;
    }
    const city = { ...(cityBase as any), slug: citySlug };

    const { data: family } = await sb
      .from("specialty_families")
      .select("id,slug,name_fr,name_de,name_it,name_en")
      .eq("id", (specialty as any).family_id)
      .maybeSingle();

    // Therapists with this specialty in a 30km radius around resolved city
    const { data: pivot } = await sb
      .from("therapist_specialties")
      .select("therapist_id")
      .eq("specialty_id", (specialty as any).id);
    const specIds = ((pivot ?? []) as any[]).map((p) => p.therapist_id);
    if (specIds.length === 0) {
      return { specialty, family, city, therapists: [] };
    }

    const { data: near } = await sb.rpc("therapists_within_radius", {
      _lat: (city as any).lat,
      _lng: (city as any).lng,
      _radius_m: 30000,
    });
    const set = new Set(specIds);
    const therapists = ((near ?? []) as any[]).filter((t) => set.has(t.id));
    return { specialty, family, city, therapists };
  });
// ─── Univers de recherche : bien-être / holistique ────────────────────────────
//
// La catégorie est portée par CHAQUE spécialité (`specialties.categories`), pas
// par le thérapeute : un praticien qui pratique le massage bien-être ET le
// magnétisme apparaît légitimement dans les deux univers, sans duplication de
// fiche puisque la liste est dédupliquée par identifiant de thérapeute.
export type FinderCategory = "bien-etre" | "holistique";

export function asFinderCategory(value: string): FinderCategory {
  return value === "holistique" ? "holistique" : "bien-etre";
}

export const getCategoryPage = createServerFn({ method: "GET" })
  .inputValidator((data: { category: string }) => ({
    category: asFinderCategory(String(data?.category ?? "")),
  }))
  .handler(async ({ data }) => {
    const sb = serverClient();

    const specs = await selectSpecialties(
      (cols) =>
        sb
          .from("specialties")
          .select(cols)
          .eq("is_active", true)
          .contains("categories", [data.category]),
      LIST_COLUMNS_BASE,
      LIST_COLUMNS_FULL,
    );

    const specIds = (specs ?? []).map((s: { id: string }) => s.id);
    let therapists: any[] = [];
    if (specIds.length > 0) {
      const { data: pivot } = await sb
        .from("therapist_specialties")
        .select("therapist_id")
        .in("specialty_id", specIds);
      const ids = Array.from(
        new Set(((pivot ?? []) as Array<{ therapist_id: string }>).map((p) => p.therapist_id)),
      );
      if (ids.length > 0) {
        const { data: ts } = await sb
          .from("therapists")
          .select(
            "id,slug,first_name,last_name,title,short_bio,photo_url,city,canton,price_min,price_max,currency,verified,specialties,languages",
          )
          .in("id", ids)
          .eq("status", "active")
          .order("verified", { ascending: false })
          .limit(60);
        therapists = ts ?? [];
      }
    }

    return { category: data.category, specialties: specs ?? [], therapists };
  });

// ─── Pastilles du jour (page d'accueil) ───
// Rotation déterministe, stable 24 h, calculée côté serveur pour que le HTML
// servi aux crawlers contienne déjà la sélection du jour (pas de random client).

/** Nombre fixe de pastilles par bloc — la hauteur des blocs ne bouge jamais. */
export const DAILY_CHIP_COUNT = 10;

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** PRNG déterministe (mulberry32) : même seed ⇒ même tirage. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type DailyChips = {
  day: string;
  blocks: Record<string, { chips: any[]; total: number }>;
};

let dailyCache: DailyChips | null = null;

export const getDailySpecialtyChips = createServerFn({ method: "GET" }).handler(async () => {
  const day = new Date().toISOString().slice(0, 10);
  if (dailyCache && dailyCache.day === day) return dailyCache;

  const sb = serverClient();
  const specs = await selectSpecialties(
    (cols) => sb.from("specialties").select(cols).eq("is_active", true),
    LIST_COLUMNS_BASE,
    LIST_COLUMNS_FULL,
  );
  const { data: pivot } = await sb.from("therapist_specialties").select("specialty_id");
  const withTherapists = new Set(
    ((pivot ?? []) as Array<{ specialty_id: string }>).map((p) => p.specialty_id),
  );

  const blocks: DailyChips["blocks"] = {};
  for (const category of ["bien-etre", "holistique"] as const) {
    const pool = (specs as any[]).filter(
      (s) => Array.isArray(s.categories) && s.categories.includes(category),
    );
    const random = rng(hashSeed(`${day}:${category}`));
    // Poids : les spécialités ayant au moins un thérapeute actif passent devant,
    // sans figer l'ordre — le tirage varie d'un jour à l'autre.
    const scored = pool
      .map((s) => ({ s, k: random() + (withTherapists.has(s.id) ? 1 : 0) }))
      .sort((a, b) => b.k - a.k)
      .map((x) => x.s);
    blocks[category] = { chips: scored.slice(0, DAILY_CHIP_COUNT), total: pool.length };
  }

  dailyCache = { day, blocks };
  return dailyCache;
});
