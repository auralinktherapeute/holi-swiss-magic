import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTherapistId } from "@/lib/invoice-core.server";

export type BillingService = {
  id: string;
  therapist_id: string;
  name: string;
  description: string | null;
  category: string | null;
  duration_min: number;
  price: number;
  currency: string;
  vat_rate: number;
  internal_code: string | null;
  tariff_position_id: string | null;
  is_active: boolean;
  position: number;
};

export type TariffPosition = {
  id: string;
  catalog_id: string;
  code: string;
  designation: string;
  description: string | null;
  unit: string | null;
  is_active: boolean;
};

export type TariffCatalog = {
  id: string;
  name: string;
  version: string;
  source: string | null;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
};

// ── Prestations facturables du thérapeute ────────────────────────────

export const listMyBillingServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    // Les prestations proposées à la réservation alimentent automatiquement
    // le catalogue facturable (non destructif, idempotent).
    try {
      const { syncProfileServicesToBilling } = await import("@/lib/billing-sync.server");
      await syncProfileServicesToBilling(context.supabase, therapistId);
    } catch (e) {
      console.error("[listMyBillingServices] sync prestations profil échouée", e);
    }
    const { data, error } = await (context.supabase as any)
      .from("billing_services")
      .select("*")
      .eq("therapist_id", therapistId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as BillingService[];
  });


const ServiceSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1, "Nom de la prestation requis"),
  description: z.string().trim().optional().nullable(),
  category: z.string().trim().optional().nullable(),
  duration_min: z.number().int().min(0).max(1440).default(60),
  price: z.number().min(0).default(0),
  currency: z.string().default("CHF"),
  vat_rate: z.number().min(0).max(100).default(0),
  internal_code: z.string().trim().optional().nullable(),
  tariff_position_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().default(true),
  position: z.number().int().min(0).default(0),
});

export const upsertBillingService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ServiceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { id, ...rest } = data;
    const payload = {
      ...rest,
      description: rest.description || null,
      category: rest.category || null,
      internal_code: rest.internal_code || null,
      tariff_position_id: rest.tariff_position_id || null,
      therapist_id: therapistId,
    };
    if (id) {
      const { error } = await (context.supabase as any)
        .from("billing_services").update(payload)
        .eq("id", id).eq("therapist_id", therapistId);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await (context.supabase as any)
      .from("billing_services").insert(payload).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteBillingService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("billing_services").delete()
      .eq("id", data.id).eq("therapist_id", therapistId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Tarif 590 (lecture) ──────────────────────────────────────────────

export const listTariffCatalogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("tariff_catalogs").select("*")
      .order("is_active", { ascending: false })
      .order("version", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as TariffCatalog[];
  });

export const listTariffPositions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ catalog_id: z.string().uuid().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    let q = (context.supabase as any)
      .from("tariff_positions").select("*")
      .eq("is_active", true).order("code", { ascending: true });
    if (data.catalog_id) q = q.eq("catalog_id", data.catalog_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as TariffPosition[];
  });

// ── Import administrateur d'un catalogue validé ──────────────────────

const ImportSchema = z.object({
  name: z.string().trim().min(1),
  version: z.string().trim().min(1),
  source: z.string().trim().optional().nullable(),
  valid_from: z.string().optional().nullable(),
  valid_to: z.string().optional().nullable(),
  activate: z.boolean().default(false),
  positions: z.array(z.object({
    code: z.string().trim().min(1),
    designation: z.string().trim().min(1),
    description: z.string().trim().optional().nullable(),
    unit: z.string().trim().optional().nullable(),
  })).min(1, "Le fichier ne contient aucune position"),
});

export const importTariffCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ImportSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await (context.supabase as any)
      .rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Réservé aux administrateurs.");

    const { data: catalog, error } = await (context.supabase as any)
      .from("tariff_catalogs")
      .upsert({
        name: data.name, version: data.version,
        source: data.source || null,
        valid_from: data.valid_from || null,
        valid_to: data.valid_to || null,
        is_active: data.activate,
      }, { onConflict: "name,version" })
      .select("id").maybeSingle();
    if (error) throw new Error(error.message);

    const rows = data.positions.map((p) => ({
      catalog_id: catalog.id,
      code: p.code,
      designation: p.designation,
      description: p.description || null,
      unit: p.unit || null,
      is_active: true,
    }));
    const { error: e2 } = await (context.supabase as any)
      .from("tariff_positions").upsert(rows, { onConflict: "catalog_id,code" });
    if (e2) throw new Error(e2.message);

    return { catalog_id: catalog.id as string, imported: rows.length };
  });
