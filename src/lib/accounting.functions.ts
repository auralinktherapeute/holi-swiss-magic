// Server functions du module Comptabilité (vue d'ensemble, journaux, TVA,
// exports CSV, pack comptable et envoi à la fiduciaire via Resend).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTherapistId, loadSettings } from "@/lib/invoice-core.server";

const PeriodInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const getAccounting = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PeriodInput.parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { buildAccounting } = await import("@/lib/accounting.server");
    return buildAccounting(context.supabase, therapistId, data);
  });

const ExportKind = z.enum(["invoices", "lines", "payments", "vat", "summary"]);

export const getAccountingExport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PeriodInput.extend({ kind: ExportKind }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const settings = await loadSettings(context.supabase, therapistId);
    const mod = await import("@/lib/accounting.server");
    const acc = await mod.buildAccounting(context.supabase, therapistId, {
      from: data.from, to: data.to,
    });
    const cabinet = settings?.raison_sociale || settings?.titulaire_nom || "Cabinet";
    const suffix = `${data.from}_${data.to}`;
    switch (data.kind) {
      case "invoices":
        return { filename: `factures_${suffix}.csv`, mime: "text/csv", content: mod.invoicesCsv(acc) };
      case "lines":
        return { filename: `lignes_factures_${suffix}.csv`, mime: "text/csv", content: mod.linesCsv(acc) };
      case "payments":
        return { filename: `encaissements_${suffix}.csv`, mime: "text/csv", content: mod.paymentsCsv(acc) };
      case "vat":
        return { filename: `tva_${suffix}.csv`, mime: "text/csv", content: mod.vatCsv(acc) };
      default:
        return {
          filename: `resume_comptable_${suffix}.html`,
          mime: "text/html",
          content: mod.summaryHtml(acc, cabinet),
        };
    }
  });

/** Journalise un pack comptable généré par le thérapeute. */
export const logAccountingPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    PeriodInput.extend({
      export_type: z.string().max(40).default("pack"),
      file_names: z.array(z.string().max(200)).default([]),
      invoice_count: z.number().int().min(0).default(0),
      payment_count: z.number().int().min(0).default(0),
      total_size_bytes: z.number().int().min(0).optional(),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { data: row, error } = await (context.supabase as any)
      .from("accounting_exports").insert({
        therapist_id: therapistId,
        export_type: data.export_type,
        period_start: data.from,
        period_end: data.to,
        file_names: data.file_names,
        invoice_count: data.invoice_count,
        payment_count: data.payment_count,
        total_size_bytes: data.total_size_bytes ?? null,
        created_by: context.userId,
      }).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    return { id: row?.id as string };
  });

export const listAccountingExports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("accounting_exports")
      .select("*")
      .eq("therapist_id", therapistId)
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []) as any[];
  });

export const listEmailSendHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      invoice_id: z.string().uuid().optional(),
      email_type: z.string().max(40).optional(),
    }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    let q = context.supabase
      .from("email_send_history")
      .select("id,email_type,to_email,subject,language,status,error_message,resend_email_id," +
        "attachment_names,sent_at,delivered_at,bounced_at,created_at,invoice_id")
      .eq("therapist_id", therapistId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.invoice_id) q = q.eq("invoice_id", data.invoice_id);
    if (data.email_type) q = q.eq("email_type", data.email_type);
    const { data: rows } = await q;
    return (rows ?? []) as any[];
  });

/** Envoi du pack comptable à la fiduciaire. Aucun envoi sans confirmation explicite du thérapeute. */
export const sendAccountingPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    PeriodInput.extend({
      to_email: z.string().trim().email("Adresse e-mail invalide"),
      message: z.string().trim().max(2000).optional().nullable(),
      include: z.array(z.enum(["invoices", "lines", "payments", "vat", "summary"]))
        .min(1, "Sélectionnez au moins un document"),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const settings = await loadSettings(context.supabase, therapistId);
    const mod = await import("@/lib/accounting.server");
    const { sendRawEmail, emailSenderConfigured, FROM } =
      await import("@/lib/holiswiss-email.server");

    if (!emailSenderConfigured()) {
      throw new Error("L'envoi d'e-mails n'est pas configuré. Contactez le support HoliSwiss.");
    }

    const acc = await mod.buildAccounting(context.supabase, therapistId, {
      from: data.from, to: data.to,
    });
    const cabinet = settings?.raison_sociale || settings?.titulaire_nom || "Cabinet";
    const suffix = `${data.from}_${data.to}`;

    const files: { filename: string; content: string }[] = [];
    if (data.include.includes("invoices")) files.push({ filename: `factures_${suffix}.csv`, content: mod.invoicesCsv(acc) });
    if (data.include.includes("lines")) files.push({ filename: `lignes_factures_${suffix}.csv`, content: mod.linesCsv(acc) });
    if (data.include.includes("payments")) files.push({ filename: `encaissements_${suffix}.csv`, content: mod.paymentsCsv(acc) });
    if (data.include.includes("vat")) files.push({ filename: `tva_${suffix}.csv`, content: mod.vatCsv(acc) });
    if (data.include.includes("summary")) files.push({ filename: `resume_comptable_${suffix}.html`, content: mod.summaryHtml(acc, cabinet) });

    const attachments = files.map((f) => ({
      filename: f.filename,
      content: Buffer.from(f.content, "utf8").toString("base64"),
    }));
    const totalBytes = files.reduce((s, f) => s + Buffer.byteLength(f.content, "utf8"), 0);
    if (totalBytes > 15_000_000) {
      throw new Error("Le volume dépasse la limite d'envoi. Réduisez la période ou le nombre de documents.");
    }

    const subject = `Documents comptables ${data.from} → ${data.to} — ${cabinet}`;
    const html = `<p>Bonjour,</p>
<p>Veuillez trouver ci-joint les documents comptables du cabinet <strong>${cabinet}</strong> pour la période du ${data.from} au ${data.to}.</p>
${data.message ? `<p>${data.message.replace(/</g, "&lt;")}</p>` : ""}
<p>Factures : ${acc.invoices.length} — Encaissements : ${acc.payments.length}</p>
<p style="font-size:12px;color:#555">${mod.PACK_NOTICE}</p>`;

    const { id: exportId } = await (async () => {
      const { data: row } = await (context.supabase as any)
        .from("accounting_exports").insert({
          therapist_id: therapistId,
          export_type: "pack_email",
          period_start: data.from,
          period_end: data.to,
          file_names: files.map((f) => f.filename),
          invoice_count: acc.invoices.length,
          payment_count: acc.payments.length,
          total_size_bytes: totalBytes,
          created_by: context.userId,
        }).select("id").maybeSingle();
      return { id: (row?.id ?? null) as string | null };
    })();

    const res = await sendRawEmail({
      to: data.to_email,
      subject,
      html,
      replyTo: settings?.email_pro ?? null,
      attachments,
    });

    await (context.supabase as any).from("email_send_history").insert({
      therapist_id: therapistId,
      accounting_export_id: exportId,
      email_type: "accounting_pack",
      resend_email_id: res.id ?? null,
      from_email: FROM,
      from_name: `${cabinet} via HoliSwiss`,
      reply_to: settings?.email_pro ?? null,
      to_email: data.to_email,
      subject,
      attachment_names: files.map((f) => f.filename),
      status: res.ok ? "sent" : "failed",
      error_message: res.ok ? null : (res.error ?? "Envoi refusé par le fournisseur"),
      sent_at: res.ok ? new Date().toISOString() : null,
      created_by: context.userId,
    });

    if (!res.ok) {
      throw new Error("L'envoi a échoué. Vérifiez l'adresse du comptable puis réessayez.");
    }
    return { ok: true, files: files.map((f) => f.filename), size: totalBytes };
  });
