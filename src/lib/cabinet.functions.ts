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

import type { UninvoicedAppointment } from "@/lib/cabinet-billing.server";

export type { CabinetOverview, CabinetClientRow, UninvoicedAppointment };


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

/** Rendez-vous honorés non facturés, avec prix et TVA suggérés. */
export const listUninvoicedAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UninvoicedAppointment[]> => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { buildUninvoicedAppointments } = await import("@/lib/cabinet-billing.server");
    return buildUninvoicedAppointments(context.supabase, therapistId);
  });

/** Crée un brouillon de facture depuis un RDV honoré et marque le RDV facturé. */
export const invoiceAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        appointment_id: z.string().uuid(),
        prix_unitaire: z.number().min(0).max(100000),
        tva_taux: z.number().min(0).max(100).default(0),
        description: z.string().trim().max(500).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { createDraftFromAppointment } = await import("@/lib/cabinet-billing.server");
    return createDraftFromAppointment(context.supabase, therapistId, context.userId, data);
  });

/** Écarte un RDV de la facturation (gratuit, offert, déjà réglé hors app). */
export const dismissAppointmentInvoicing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ appointment_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { skipAppointmentInvoicing } = await import("@/lib/cabinet-billing.server");
    return skipAppointmentInvoicing(context.supabase, therapistId, data.appointment_id);
  });


/* ---------- L4 — Documents rattachés au client + modèles ---------- */

const DOC_TYPE = z.enum([
  "consentement",
  "attestation",
  "recu",
  "bilan",
  "correspondance",
  "autre",
]);

export const listClientDocs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ client_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { listClientDocuments } = await import("@/lib/cabinet-documents.server");
    return listClientDocuments(context.supabase, therapistId, data.client_id);
  });

/** Enregistre en base un fichier déjà téléversé dans le bucket privé. */
export const registerClientDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        client_id: z.string().uuid(),
        path: z.string().min(3).max(500),
        file_name: z.string().trim().min(1).max(255),
        label: z.string().trim().max(255).optional().nullable(),
        doc_type: DOC_TYPE.default("autre"),
        is_health_data: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { registerClientDocument } = await import("@/lib/cabinet-documents.server");
    return registerClientDocument(context.supabase, therapistId, context.userId, {
      client_id: data.client_id,
      path: data.path,
      file_name: data.file_name,
      label: data.label?.trim() || null,
      doc_type: data.doc_type,
      is_health_data: data.is_health_data,
    });
  });

/** Lien signé de 5 minutes pour consulter un document (accès journalisé). */
export const getClientDocUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { signClientDocument } = await import("@/lib/cabinet-documents.server");
    return signClientDocument(context.supabase, therapistId, context.userId, data.id);
  });

export const deleteClientDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { deleteClientDocument } = await import("@/lib/cabinet-documents.server");
    return deleteClientDocument(context.supabase, therapistId, context.userId, data.id);
  });

/** Contexte d'en-tête pour générer un modèle de document imprimable. */
export const getDocumentTemplateContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ client_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { buildTemplateContext } = await import("@/lib/cabinet-documents.server");
    return buildTemplateContext(context.supabase, therapistId, data.client_id);
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
