import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTherapistId, logInvoiceAudit } from "@/lib/invoice-core.server";

export type InvoiceAccessLink = {
  id: string;
  invoice_id: string;
  expires_at: string;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
};

function portalOrigin(): string {
  try {
    const req = getRequest();
    if (req?.url) return new URL(req.url).origin;
  } catch {
    /* pas de requête disponible */
  }
  return "https://holiswiss.ch";
}

export const listInvoiceLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ invoice_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { data: rows, error } = await (context.supabase as any)
      .from("invoice_access_tokens")
      .select("id, invoice_id, expires_at, revoked_at, view_count, last_viewed_at, created_at")
      .eq("invoice_id", data.invoice_id)
      .eq("therapist_id", therapistId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as InvoiceAccessLink[];
  });

/** Crée un lien sécurisé. Le jeton en clair n'est renvoyé qu'une seule fois. */
export const createInvoiceLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      invoice_id: z.string().uuid(),
      days: z.number().int().min(1).max(365).default(30),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { data: inv } = await (context.supabase as any)
      .from("therapist_invoices").select("id, locked_at")
      .eq("id", data.invoice_id).eq("therapist_id", therapistId).maybeSingle();
    if (!inv) throw new Error("Facture introuvable.");
    if (!inv.locked_at) throw new Error("Validez la facture avant de créer un lien patient.");

    const { generateToken, hashToken } = await import("@/lib/invoice-portal.server");
    const token = generateToken();
    const token_hash = await hashToken(token);
    const expires_at = new Date(Date.now() + data.days * 86400000).toISOString();

    const { error } = await (context.supabase as any)
      .from("invoice_access_tokens")
      .insert({
        invoice_id: data.invoice_id,
        therapist_id: therapistId,
        token_hash,
        expires_at,
        created_by: context.userId,
      });
    if (error) throw new Error(error.message);

    await logInvoiceAudit(context.supabase, {
      therapistId, invoiceId: data.invoice_id, action: "portal_link_created",
      actorUserId: context.userId, note: `expire le ${expires_at.slice(0, 10)}`,
    });

    return { url: `${portalOrigin()}/facture/${token}`, expires_at };
  });

export const revokeInvoiceLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { data: row, error } = await (context.supabase as any)
      .from("invoice_access_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id).eq("therapist_id", therapistId)
      .select("invoice_id").maybeSingle();
    if (error) throw new Error(error.message);
    if (row?.invoice_id) {
      await logInvoiceAudit(context.supabase, {
        therapistId, invoiceId: row.invoice_id, action: "portal_link_revoked",
        actorUserId: context.userId, note: null,
      });
    }
    return { ok: true };
  });

/** Envoie au patient un email contenant uniquement le lien sécurisé (aucune pièce jointe). */
export const emailInvoiceLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      invoice_id: z.string().uuid(),
      to: z.string().email().optional().nullable(),
      days: z.number().int().min(1).max(365).default(30),
      message: z.string().trim().max(2000).optional().nullable(),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { data: inv } = await (context.supabase as any)
      .from("therapist_invoices")
      .select("id, numero_facture, montant_total, currency, date_echeance, client_email, client_nom, locked_at, statut")
      .eq("id", data.invoice_id).eq("therapist_id", therapistId).maybeSingle();
    if (!inv) throw new Error("Facture introuvable.");
    if (!inv.locked_at) throw new Error("Validez la facture avant de l'envoyer.");
    const to = (data.to ?? inv.client_email ?? "").trim();
    if (!to) throw new Error("Adresse email du patient requise.");

    const { generateToken, hashToken } = await import("@/lib/invoice-portal.server");
    const token = generateToken();
    const token_hash = await hashToken(token);
    const expires_at = new Date(Date.now() + data.days * 86400000).toISOString();
    const { error } = await (context.supabase as any)
      .from("invoice_access_tokens")
      .insert({
        invoice_id: inv.id, therapist_id: therapistId, token_hash,
        expires_at, created_by: context.userId,
      });
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: therapist } = await supabaseAdmin
      .from("therapists").select("first_name, last_name").eq("id", therapistId).maybeSingle();

    const { sendInvoicePortalEmail } = await import("@/lib/holiswiss-email.server");
    const res = await sendInvoicePortalEmail({
      to,
      patientName: inv.client_nom ?? null,
      therapistName:
        `${therapist?.first_name ?? ""} ${therapist?.last_name ?? ""}`.trim() || "HoliSwiss",
      invoiceNumber: inv.numero_facture,
      amount: Number(inv.montant_total ?? 0),
      currency: inv.currency ?? "CHF",
      dueDate: inv.date_echeance ?? null,
      secureLink: `${portalOrigin()}/facture/${token}`,
      message: data.message ?? null,
    });
    if (!res.ok) {
      await logInvoiceAudit(context.supabase, {
        therapistId, invoiceId: inv.id, action: "portal_email_failed",
        actorUserId: context.userId, note: `${res.status} ${res.error ?? ""}`,
      });
      throw new Error(`Envoi impossible (${res.status}) ${res.error ?? ""}`);
    }

    if (inv.statut !== "payee" && inv.statut !== "annulee") {
      await (context.supabase as any).from("therapist_invoices")
        .update({ statut: "envoyee", sent_at: new Date().toISOString() })
        .eq("id", inv.id).eq("therapist_id", therapistId);
    }
    await logInvoiceAudit(context.supabase, {
      therapistId, invoiceId: inv.id, action: "portal_email_sent",
      actorUserId: context.userId, note: to,
    });
    return { ok: true, sentTo: to, expires_at };
  });

/** Consultation publique par jeton (aucune authentification, aucun identifiant en clair). */
export const getInvoiceByToken = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().min(20).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { resolvePortalInvoice } = await import("@/lib/invoice-portal.server");
    const invoice = await resolvePortalInvoice(data.token);
    if (!invoice) return { ok: false as const };
    return { ok: true as const, invoice };
  });
