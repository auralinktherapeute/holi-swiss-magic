import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ServicePackage = {
  id: string;
  therapist_id: string;
  nom: string;
  description: string | null;
  prix_total: number;
  nombre_seances_incluses: number;
  validite_jours: number | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
};

export type ClientPackage = {
  id: string;
  therapist_id: string;
  client_id: string;
  package_id: string;
  nombre_seances_utilisees: number;
  date_achat: string;
  date_expiration: string | null;
  statut_paiement: "paye" | "acompte" | "a_regler";
  statut: "actif" | "expire" | "epuise";
  notes: string | null;
  created_at: string;
  updated_at: string;
  service_packages?: ServicePackage;
  crm_client_contacts?: { id: string; first_name: string; last_name: string; email: string | null };
};

async function getTherapistId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("therapists").select("id").eq("user_id", userId).maybeSingle();
  if (error || !data) throw new Error("Profil thérapeute introuvable.");
  return data.id as string;
}

// ────────────────────────────────────────────────────────────────
// Catalogue de forfaits
// ────────────────────────────────────────────────────────────────

export const listMyServicePackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { data, error } = await (context.supabase as any)
      .from("service_packages")
      .select("*")
      .eq("therapist_id", therapistId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ServicePackage[];
  });

const PackageInput = z.object({
  id: z.string().uuid().optional(),
  nom: z.string().trim().min(1, "Nom requis"),
  description: z.string().trim().optional().nullable(),
  prix_total: z.number().min(0),
  nombre_seances_incluses: z.number().int().min(1),
  validite_jours: z.number().int().min(1).optional().nullable(),
  actif: z.boolean().default(true),
});

export const upsertServicePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PackageInput.parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { id, ...rest } = data;
    if (id) {
      const { error } = await (context.supabase as any)
        .from("service_packages").update(rest).eq("id", id).eq("therapist_id", therapistId);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await (context.supabase as any)
      .from("service_packages").insert({ ...rest, therapist_id: therapistId })
      .select("id").maybeSingle();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteServicePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("service_packages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ────────────────────────────────────────────────────────────────
// Forfaits achetés par les clients
// ────────────────────────────────────────────────────────────────

export const listMyClientPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ client_id: z.string().uuid().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    let q = (context.supabase as any)
      .from("client_packages")
      .select("*, service_packages(*), crm_client_contacts(id,first_name,last_name,email)")
      .eq("therapist_id", therapistId)
      .order("created_at", { ascending: false });
    if (data.client_id) q = q.eq("client_id", data.client_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as ClientPackage[];
  });

const ClientPackageInput = z.object({
  id: z.string().uuid().optional(),
  client_id: z.string().uuid(),
  package_id: z.string().uuid(),
  date_achat: z.string().optional(),
  date_expiration: z.string().optional().nullable(),
  statut_paiement: z.enum(["paye", "acompte", "a_regler"]).default("a_regler"),
  notes: z.string().optional().nullable(),
});

export const upsertClientPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ClientPackageInput.parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { id, ...rest } = data;
    const payload: any = { ...rest, therapist_id: therapistId };
    if (!payload.date_achat) delete payload.date_achat;
    if (id) {
      const { error } = await (context.supabase as any)
        .from("client_packages").update(payload).eq("id", id).eq("therapist_id", therapistId);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await (context.supabase as any)
      .from("client_packages").insert(payload).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteClientPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("client_packages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ────────────────────────────────────────────────────────────────
// Décompte d'une séance (bouton "Décompter une séance")
// ────────────────────────────────────────────────────────────────

export const consumeClientPackageSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      client_package_id: z.string().uuid(),
      appointment_id: z.string().uuid().optional().nullable(),
      type_seance_reelle: z.string().trim().optional().nullable(),
      commentaire: z.string().trim().optional().nullable(),
      date_decompte: z.string().optional(),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);

    // Vérifie que le forfait client appartient bien au thérapeute et qu'il reste des séances
    const { data: cp, error: e1 } = await (context.supabase as any)
      .from("client_packages")
      .select("id, therapist_id, nombre_seances_utilisees, statut, package_id, service_packages(nombre_seances_incluses)")
      .eq("id", data.client_package_id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!cp) throw new Error("Forfait client introuvable.");
    if (cp.therapist_id !== therapistId) throw new Error("Accès refusé.");
    if (cp.statut === "epuise") throw new Error("Ce forfait est déjà épuisé.");
    if (cp.statut === "expire") throw new Error("Ce forfait est expiré.");

    const { error } = await (context.supabase as any)
      .from("client_package_sessions").insert({
        client_package_id: data.client_package_id,
        therapist_id: therapistId,
        appointment_id: data.appointment_id ?? null,
        type_seance_reelle: data.type_seance_reelle ?? null,
        commentaire: data.commentaire ?? null,
        date_decompte: data.date_decompte ?? new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPackageSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ client_package_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { data: rows, error } = await (context.supabase as any)
      .from("client_package_sessions")
      .select("*")
      .eq("client_package_id", data.client_package_id)
      .eq("therapist_id", therapistId)
      .order("date_decompte", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ────────────────────────────────────────────────────────────────
// Liste rapide des contacts CRM (pour le select dans le formulaire)
// ────────────────────────────────────────────────────────────────

export const listMyCrmContactsMinimal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { data, error } = await (context.supabase as any)
      .from("crm_client_contacts")
      .select("id, first_name, last_name, email")
      .eq("therapist_id", therapistId)
      .order("first_name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ id: string; first_name: string; last_name: string; email: string | null }>;
  });