import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";
type SupabaseAnyClient = {
  from: (table: string) => any; // eslint-disable-line -eslint/no-explicit-any
};
import { NEWSLETTER_STATUSES, NEWSLETTER_LANGS } from "@/lib/newsletter.shared";

const COLUMNS =
  "id,title,problem,objective,audience,pillar,tone,feature_highlight,cta,lang,target_date,internal_notes,status,created_at,updated_at";

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const briefSchema = z.object({
  title: z.string().trim().min(3, "Donnez un titre ou une idée.").max(200),
  problem: nullableText(1000),
  objective: nullableText(1000),
  audience: nullableText(300),
  pillar: nullableText(200),
  tone: nullableText(200),
  feature_highlight: nullableText(300),
  cta: nullableText(300),
  lang: z.enum(NEWSLETTER_LANGS).default("fr"),
  target_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ.")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  internal_notes: nullableText(2000),
  status: z.enum(NEWSLETTER_STATUSES).default("brouillon"),
});

/** Liste des newsletters (admin uniquement). */
export const listNewsletterIssues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as SupabaseAnyClient)
      .from("newsletter_issues")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Impossible de charger les newsletters.");
    return { rows: data ?? [] };
  });

/** Crée une newsletter à partir du brief éditorial (admin uniquement). */
export const createNewsletterIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => briefSchema.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as SupabaseAnyClient)
      .from("newsletter_issues")
      .insert({ ...data, created_by: context.userId })
      .select("id")
      .single();
    if (error || !row) throw new Error("Impossible d'enregistrer la newsletter.");
    return { id: row.id as string };
  });

/** Met à jour le brief d'une newsletter existante (admin uniquement). */
export const updateNewsletterIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => briefSchema.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { id, ...patch } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as SupabaseAnyClient)
      .from("newsletter_issues")
      .update(patch)
      .eq("id", id);
    if (error) throw new Error("Impossible de mettre à jour la newsletter.");
    return { ok: true };
  });

/** Change uniquement le statut (validation humaine explicite). */
export const setNewsletterIssueStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), status: z.enum(NEWSLETTER_STATUSES) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as SupabaseAnyClient)
      .from("newsletter_issues")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error("Impossible de changer le statut.");
    return { ok: true };
  });
