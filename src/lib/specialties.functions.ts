import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

function serverClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type FamilyRow = {
  id: string;
  slug: string;
  name_fr: string;
  description_fr: string | null;
  icon: string | null;
  sort_order: number;
};

export type SpecialtyRow = {
  id: string;
  slug: string;
  name_fr: string;
  description_fr: string | null;
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
        .select("id,slug,name_fr,description_fr,icon,sort_order")
        .order("sort_order", { ascending: true }),
      sb
        .from("specialties")
        .select("id,slug,name_fr,family_id,is_featured")
        .eq("is_active", true),
      sb.from("therapist_specialties").select("specialty_id"),
    ]);

    const countsBySpec = new Map<string, number>();
    for (const row of (pivot ?? []) as Array<{ specialty_id: string }>) {
      countsBySpec.set(row.specialty_id, (countsBySpec.get(row.specialty_id) ?? 0) + 1);
    }

    const specsByFamily = new Map<string, Array<{ id: string; slug: string; name_fr: string; count: number; is_featured: boolean }>>();
    for (const s of (specs ?? []) as Array<SpecialtyRow>) {
      const arr = specsByFamily.get(s.family_id) ?? [];
      arr.push({
        id: s.id,
        slug: s.slug,
        name_fr: s.name_fr,
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
  .inputValidator((data: { q: string }) => {
    const q = String(data?.q ?? "").trim();
    return { q: q.slice(0, 80) };
  })
  .handler(async ({ data }) => {
    if (data.q.length < 2) return [];
    const sb = serverClient();
    const { data: rows, error } = await sb.rpc("search_specialties", {
      _q: data.q,
      _limit: 10,
    });
    if (error) return [];
    return (rows ?? []) as Array<{
      id: string;
      slug: string;
      name_fr: string;
      family_slug: string;
      family_name_fr: string;
      rank: number;
    }>;
  });

export const getFamilyPage = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => ({ slug: String(data?.slug ?? "").slice(0, 80) }))
  .handler(async ({ data }) => {
    const sb = serverClient();
    const { data: family } = await sb
      .from("specialty_families")
      .select("id,slug,name_fr,description_fr,icon")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!family) return null;

    const { data: specs } = await sb
      .from("specialties")
      .select("id,slug,name_fr,description_fr,is_featured")
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
      .select("id,slug,name_fr,description_fr,family_id,aliases")
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (!specialty) return null;

    const s = specialty as { id: string; slug: string; name_fr: string; description_fr: string | null; family_id: string; aliases: string[] };

    const { data: family } = await sb
      .from("specialty_families")
      .select("id,slug,name_fr")
      .eq("id", s.family_id)
      .maybeSingle();

    const { data: siblings } = await sb
      .from("specialties")
      .select("id,slug,name_fr")
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
    sb.from("specialty_families").select("id,slug,name_fr,sort_order").order("sort_order"),
    sb.from("specialties").select("id,slug,name_fr,family_id,is_featured").eq("is_active", true),
  ]);
  return {
    families: (families ?? []) as Array<{ id: string; slug: string; name_fr: string; sort_order: number }>,
    specialties: (specs ?? []) as Array<{ id: string; slug: string; name_fr: string; family_id: string; is_featured: boolean }>,
  };
});