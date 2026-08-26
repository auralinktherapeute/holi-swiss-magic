// Server functions du CRM de cabinet. Fichier volontairement mince :
// toute la logique vit dans cabinet-core.server.ts.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildCabinetOverview,
  buildClientDetail,
  buildClientList,
  getTherapistId,
  logAccess,
  type CabinetOverview,
  type CabinetClientRow,
} from "@/lib/cabinet-core.server";

export type { CabinetOverview, CabinetClientRow };

export const getCabinetOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CabinetOverview> => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    return buildCabinetOverview(context.supabase, therapistId);
  });

export const listCabinetClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        search: z.string().max(120).optional(),
        status: z.string().max(30).optional(),
        unpaidOnly: z.boolean().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<CabinetClientRow[]> => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    return buildClientList(context.supabase, therapistId, data);
  });

export const getCabinetClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const detail = await buildClientDetail(context.supabase, therapistId, data.id);
    await logAccess(context.supabase, {
      therapistId,
      actorUserId: context.userId,
      entityType: "client",
      entityId: data.id,
      action: "read",
      context: "fiche client",
    });
    return detail;
  });

export const updateClientConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        consent_given: z.boolean(),
        consent_source: z.string().max(120).optional().nullable(),
        legal_basis: z.enum(["consent", "contract", "legal_obligation", "vital_interest"]).optional(),
        retention_until: z.string().max(10).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("crm_client_contacts")
      .update({
        consent_at: data.consent_given ? new Date().toISOString() : null,
        consent_source: data.consent_given ? data.consent_source ?? "saisie thérapeute" : null,
        legal_basis: data.legal_basis ?? "contract",
        retention_until: data.retention_until || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("therapist_id", therapistId);
    if (error) throw new Error(error.message);
    await logAccess(context.supabase, {
      therapistId,
      actorUserId: context.userId,
      entityType: "client",
      entityId: data.id,
      action: "update",
      context: "consentement RGPD",
    });
    return { ok: true };
  });

/** Rendez-vous terminés non facturés — base de la génération « Factures manquantes ». */
export const listUninvoicedAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("appointments")
      .select(
        "id,client_id,patient_name,patient_email,appointment_date,appointment_time,service_name,duration_minutes,status",
      )
      .eq("therapist_id", therapistId)
      .eq("status", "completed")
      .is("invoiced_at", null)
      .order("appointment_date", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

/** Journal d'accès du cabinet (lecture seule, append-only en base). */
export const listCabinetAccessLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("crm_access_log")
      .select("id,entity_type,entity_id,action,context,occurred_at")
      .eq("therapist_id", therapistId)
      .order("occurred_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });
