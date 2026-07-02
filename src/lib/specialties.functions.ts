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
    const [{ data: families }, { data: specs }, { data: pivot }] = await Promise.all([
      sb
        .from("specialty_families")
        .select("id,slug,name_fr,name_de,name_it,name_en,description_fr,description_de,description_it,description_en,icon,sort_order")
        .order("sort_order", { ascending: true }),
      sb
        .from("specialties")
        .select("id,slug,name_fr,name_de,name_it,name_en,family_id,is_featured")
        .eq("is_active", true),
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

    const { data: specs } = await sb
      .from("specialties")
      .select("id,slug,name_fr,name_de,name_it,name_en,description_fr,description_de,description_it,description_en,is_featured")
      .eq("family_id", (family as { id: string }).id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

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
    const { data: specialty } = await sb
      .from("specialties")
      .select("id,slug,name_fr,name_de,name_it,name_en,description_fr,description_de,description_it,description_en,family_id,aliases")
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (!specialty) return null;

    const s = specialty as any;

    const { data: family } = await sb
      .from("specialty_families")
      .select("id,slug,name_fr,name_de,name_it,name_en")
      .eq("id", s.family_id)
      .maybeSingle();

    const { data: siblings } = await sb
      .from("specialties")
      .select("id,slug,name_fr,name_de,name_it,name_en")
      .eq("family_id", s.family_id)
      .eq("is_active", true)
      .neq("id", s.id)
      .order("sort_order", { ascending: true })
      .limit(8);

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
  const [{ data: families }, { data: specs }] = await Promise.all([
    sb.from("specialty_families").select("id,slug,name_fr,name_de,name_it,name_en,sort_order").order("sort_order"),
    sb.from("specialties").select("id,slug,name_fr,name_de,name_it,name_en,family_id,is_featured").eq("is_active", true),
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
    const { data: specialty } = await sb
      .from("specialties")
      .select("id,slug,name_fr,name_de,name_it,name_en,description_fr,description_de,description_it,description_en,family_id,aliases")
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (!specialty) return null;

    const { data: cityRow } = await sb.rpc("resolve_city", { _input: data.city });
    const city = Array.isArray(cityRow) ? cityRow[0] : cityRow;
    if (!city) return { specialty, family: null, city: null, therapists: [] };

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