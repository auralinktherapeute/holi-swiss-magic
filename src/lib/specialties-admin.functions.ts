import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(ctx: { userId: string; supabase: any }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

export const listAdminTaxonomy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: families }, { data: specs }, { data: pending }] = await Promise.all([
      supabaseAdmin
        .from("specialty_families")
        .select("id,slug,name_fr,name_de,name_it,name_en,description_fr,icon,sort_order,is_featured")
        .order("sort_order"),
      supabaseAdmin
        .from("specialties")
        .select("id,family_id,slug,name_fr,name_de,name_it,name_en,description_fr,aliases,is_active,is_featured,sort_order")
        .order("sort_order"),
      supabaseAdmin
        .from("specialty_import_pending")
        .select("id,raw_label,therapist_id,created_at")
        .order("created_at", { ascending: false }),
    ]);

    // Enrich pending with therapist name
    const therIds = Array.from(new Set(((pending ?? []) as any[]).map((p) => p.therapist_id)));
    let therMap: Record<string, string> = {};
    if (therIds.length > 0) {
      const { data: ths } = await supabaseAdmin
        .from("therapists")
        .select("id,first_name,last_name,slug")
        .in("id", therIds);
      for (const t of (ths ?? []) as any[]) therMap[t.id] = `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim();
    }
    const pendingEnriched = ((pending ?? []) as any[]).map((p) => ({
      ...p,
      therapist_name: therMap[p.therapist_id] ?? p.therapist_id,
    }));

    return { families: families ?? [], specialties: specs ?? [], pending: pendingEnriched };
  });

const familySchema = z.object({
  id: z.string().uuid().nullable(),
  slug: z.string().min(1).max(80),
  name_fr: z.string().min(1).max(120),
  name_de: z.string().max(120).nullable(),
  name_it: z.string().max(120).nullable(),
  name_en: z.string().max(120).nullable(),
  description_fr: z.string().max(2000).nullable(),
  icon: z.string().max(40).nullable(),
  sort_order: z.number().int(),
  is_featured: z.boolean(),
});

export const saveFamily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(familySchema)
  .handler(async ({ context, data }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = { ...data };
    const id = payload.id;
    delete (payload as any).id;
    if (id) {
      const { error } = await supabaseAdmin.from("specialty_families").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    } else {
      const { data: row, error } = await supabaseAdmin
        .from("specialty_families").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      return { id: (row as any).id };
    }
  });

const specialtySchema = z.object({
  id: z.string().uuid().nullable(),
  family_id: z.string().uuid(),
  slug: z.string().min(1).max(80),
  name_fr: z.string().min(1).max(120),
  name_de: z.string().max(120).nullable(),
  name_it: z.string().max(120).nullable(),
  name_en: z.string().max(120).nullable(),
  description_fr: z.string().max(2000).nullable(),
  aliases: z.array(z.string().max(120)).max(40),
  is_active: z.boolean(),
  is_featured: z.boolean(),
  sort_order: z.number().int(),
});

export const saveSpecialty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(specialtySchema)
  .handler(async ({ context, data }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = { ...data };
    const id = payload.id;
    delete (payload as any).id;
    if (id) {
      const { error } = await supabaseAdmin.from("specialties").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    } else {
      const { data: row, error } = await supabaseAdmin
        .from("specialties").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      return { id: (row as any).id };
    }
  });

export const deleteSpecialty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("specialties").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resolvePendingImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ pending_id: z.string().uuid(), specialty_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pending } = await supabaseAdmin
      .from("specialty_import_pending").select("therapist_id,raw_label").eq("id", data.pending_id).maybeSingle();
    if (!pending) throw new Error("Pending row not found");
    const p = pending as any;
    // Add pivot row
    await supabaseAdmin.from("therapist_specialties").upsert({
      therapist_id: p.therapist_id,
      specialty_id: data.specialty_id,
    }, { onConflict: "therapist_id,specialty_id" });
    // Optionally add the raw label as alias to the target specialty
    const { data: spec } = await supabaseAdmin.from("specialties").select("aliases").eq("id", data.specialty_id).maybeSingle();
    if (spec) {
      const norm = String(p.raw_label ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .trim();
      const aliases = Array.isArray((spec as any).aliases) ? (spec as any).aliases : [];
      if (norm && !aliases.map((a: string) => a.toLowerCase()).includes(norm)) {
        aliases.push(norm);
        await supabaseAdmin.from("specialties").update({ aliases }).eq("id", data.specialty_id);
      }
    }
    await supabaseAdmin.from("specialty_import_pending").delete().eq("id", data.pending_id);
    return { ok: true };
  });

export const dismissPendingImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ pending_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("specialty_import_pending").delete().eq("id", data.pending_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });