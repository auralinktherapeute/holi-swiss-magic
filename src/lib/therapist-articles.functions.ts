import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";

function publicClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type TherapistArticle = {
  id: string;
  therapist_id: string;
  titre: string;
  slug: string;
  contenu: string;
  extrait: string | null;
  image_couverture: string | null;
  statut: "brouillon" | "en_attente_validation" | "publie" | "refuse";
  date_soumission: string | null;
  date_publication: string | null;
  motif_refus: string | null;
  created_at: string;
  updated_at: string;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "article";
}

async function getTherapistId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("therapists").select("id").eq("user_id", userId).maybeSingle();
  if (error || !data) throw new Error("Profil thérapeute introuvable.");
  return data.id as string;
}

// ── Public ──────────────────────────────────────────────────────────

export const listPublishedTherapistArticles = createServerFn({ method: "GET" })
  .handler(async () => {
    const sb = publicClient();
    const { data, error } = await sb
      .from("therapist_articles")
      .select("id,titre,slug,extrait,image_couverture,date_publication,therapist_id,therapists(id,slug,first_name,last_name,photo_url,city,title)")
      .eq("statut", "publie")
      .order("date_publication", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

export const getPublishedTherapistArticleBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: row, error } = await sb
      .from("therapist_articles")
      .select("*, therapists(id,slug,first_name,last_name,photo_url,city,title,short_bio)")
      .eq("slug", data.slug)
      .eq("statut", "publie")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row as any | null;
  });

// ── Therapist dashboard ─────────────────────────────────────────────

export const listMyTherapistArticles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { data, error } = await (context.supabase as any)
      .from("therapist_articles").select("*")
      .eq("therapist_id", therapistId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as TherapistArticle[];
  });

const ArticleInput = z.object({
  id: z.string().uuid().optional(),
  titre: z.string().trim().min(3, "Titre trop court").max(200),
  contenu: z.string().trim().min(20, "Contenu trop court"),
  extrait: z.string().trim().max(400).optional().nullable(),
  image_couverture: z.string().trim().url().optional().nullable().or(z.literal("").transform(() => null)),
  submit: z.boolean().default(false),
});

async function ensureUniqueSlug(sb: any, base: string, excludeId?: string): Promise<string> {
  let slug = base;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const q = sb.from("therapist_articles").select("id").eq("slug", slug).limit(1);
    const { data } = await q;
    const hit = (data ?? [])[0];
    if (!hit || hit.id === excludeId) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

export const upsertMyTherapistArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ArticleInput.parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const sb: any = context.supabase;
    const nextStatus = data.submit ? "en_attente_validation" : "brouillon";
    const payload: any = {
      titre: data.titre,
      contenu: data.contenu,
      extrait: data.extrait ?? null,
      image_couverture: data.image_couverture ?? null,
      statut: nextStatus,
      date_soumission: data.submit ? new Date().toISOString() : null,
      motif_refus: null,
    };
    if (data.id) {
      // Keep existing slug
      const { data: existing } = await sb.from("therapist_articles")
        .select("slug,statut").eq("id", data.id).eq("therapist_id", therapistId).maybeSingle();
      if (!existing) throw new Error("Article introuvable.");
      const { error } = await sb.from("therapist_articles")
        .update(payload).eq("id", data.id).eq("therapist_id", therapistId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const slug = await ensureUniqueSlug(sb, slugify(data.titre));
    const { data: row, error } = await sb.from("therapist_articles")
      .insert({ ...payload, therapist_id: therapistId, slug })
      .select("id").maybeSingle();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteMyTherapistArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("therapist_articles").delete()
      .eq("id", data.id).eq("therapist_id", therapistId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Admin ───────────────────────────────────────────────────────────

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Accès administrateur requis.");
}

export const adminListTherapistArticles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      statut: z.enum(["brouillon","en_attente_validation","publie","refuse"]).optional(),
    }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    let q = (context.supabase as any)
      .from("therapist_articles")
      .select("*, therapists(id,first_name,last_name,slug,photo_url,city)")
      .order("created_at", { ascending: false });
    if (data.statut) q = q.eq("statut", data.statut);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const adminModerateTherapistArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      action: z.enum(["publish","reject"]),
      motif_refus: z.string().trim().max(500).optional().nullable(),
    }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const payload: any = data.action === "publish"
      ? { statut: "publie", date_publication: new Date().toISOString(), motif_refus: null }
      : { statut: "refuse", motif_refus: data.motif_refus ?? "Non conforme à la charte éditoriale." };
    const { error } = await (context.supabase as any)
      .from("therapist_articles").update(payload).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });