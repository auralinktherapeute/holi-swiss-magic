import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";
import {
  NEWSLETTER_SEGMENT_KEYS,
  isValidEmail,
  type NewsletterSegmentKey,
} from "@/lib/newsletter-send.shared";

/* eslint-disable @typescript-eslint/no-explicit-any -- tables newsletter absentes des types générés. */
type AnyClient = { from: (table: string) => any };

const ISSUE_COLUMNS =
  "id,title,status,lang,slug,published_at,qc_checklist,email_subject,email_preheader,email_intro,email_body,email_button_label,email_button_url,email_footer,updated_at";

function actorEmail(context: { claims?: unknown }): string | null {
  return (context.claims as { email?: string } | undefined)?.email ?? null;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyClient;
}

async function loadIssue(db: AnyClient, id: string) {
  const { data, error } = await db
    .from("newsletter_issues")
    .select(ISSUE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error("Newsletter introuvable.");
  return data as any;
}

/** Contrôles d'envoi partagés (les mêmes côté aperçu et côté envoi réel). */
function checkSendable(issue: any, recipientCount: number, senderOk: boolean): string[] {
  const blockers: string[] = [];
  if (issue.status !== "approuvee") blockers.push("La newsletter n'est pas approuvée.");
  const qc = (issue.qc_checklist ?? {}) as Record<string, boolean>;
  const qcCount = Object.values(qc).filter(Boolean).length;
  if (qcCount < 12) blockers.push("La checklist qualité n'est pas entièrement validée.");
  if (!issue.email_subject) blockers.push("L'objet de l'email est manquant.");
  if (!issue.email_body && !issue.email_intro) blockers.push("Le contenu de l'email est vide.");
  if (recipientCount <= 0) blockers.push("Le segment ne contient aucun destinataire.");
  if (!senderOk) blockers.push("L'expéditeur n'est pas configuré.");
  const usesResource =
    Boolean(issue.slug) &&
    (issue.email_button_url ?? "").includes(`/lettre/${issue.slug}`);
  if (usesResource && !issue.published_at) {
    blockers.push("La page ressource utilisée n'est pas publiée.");
  }
  return blockers;
}

/** Aperçu de l'audience + blocages, pour la fenêtre de confirmation. */
export const getNewsletterSendPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ id: z.string().uuid(), segment: z.enum(NEWSLETTER_SEGMENT_KEYS) })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const db = await admin();
    const { resolveRecipients, resourceUrl, SENDER_ADDRESS } = await import(
      "@/lib/newsletter-send.server"
    );
    const { emailSenderConfigured } = await import("@/lib/holiswiss-email.server");

    const issue = await loadIssue(db, data.id);
    const recipients = await resolveRecipients(db, data.segment as NewsletterSegmentKey);

    const { data: inProgress } = await db
      .from("newsletter_sends")
      .select("id,status")
      .eq("issue_id", data.id)
      .eq("is_test", false)
      .in("status", ["sending", "sent", "partially_failed"])
      .maybeSingle();

    const senderOk = emailSenderConfigured();
    const blockers = checkSendable(issue, recipients.length, senderOk);
    if (inProgress?.status === "sending") blockers.push("Un envoi est déjà en cours.");
    if (inProgress?.status === "sent" || inProgress?.status === "partially_failed") {
      blockers.push("Cette newsletter a déjà été envoyée.");
    }

    return {
      title: issue.title as string,
      subject: (issue.email_subject as string | null) ?? null,
      sender: SENDER_ADDRESS,
      recipientCount: recipients.length,
      resourceUrl: resourceUrl(issue.lang as string, issue.slug as string | null),
      resourcePublished: Boolean(issue.published_at),
      versionLabel: `Version du ${new Date(issue.updated_at as string).toLocaleString("fr-CH")}`,
      blockers,
      alreadySent: inProgress?.status === "sent" || inProgress?.status === "partially_failed",
    };
  });

/** Email de test — ne change jamais le statut de la newsletter. */
export const sendNewsletterTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        to: z.string().trim().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const fallback = actorEmail(context);
    const to = (data.to && data.to.trim().length > 0 ? data.to.trim() : fallback) ?? "";
    if (!isValidEmail(to)) throw new Error("Adresse email de test invalide.");

    const db = await admin();
    const issue = await loadIssue(db, data.id);
    if (!issue.email_subject && !issue.title) throw new Error("Objet de l'email manquant.");

    const { deliverTest, SENDER_ADDRESS } = await import("@/lib/newsletter-send.server");
    const res = await deliverTest(issue, to);

    const { data: send } = await db
      .from("newsletter_sends")
      .insert({
        issue_id: data.id,
        is_test: true,
        segment: "test",
        subject: issue.email_subject ?? issue.title,
        from_address: SENDER_ADDRESS,
        version_label: `Version du ${new Date(issue.updated_at).toLocaleString("fr-CH")}`,
        recipient_count: 1,
        sent_count: res.ok ? 1 : 0,
        failed_count: res.ok ? 0 : 1,
        status: res.ok ? "sent" : "failed",
        error_message: res.ok ? null : (res.error ?? `HTTP ${res.status}`),
        actor_id: context.userId,
        actor_email: fallback,
        finished_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (send?.id) {
      await db.from("newsletter_send_recipients").insert({
        send_id: send.id,
        email: to,
        status: res.ok ? "sent" : "failed",
        error_message: res.ok ? null : (res.error ?? null),
      });
    }

    if (!res.ok) throw new Error(`Envoi de test impossible (${res.error ?? res.status}).`);
    return { ok: true, to };
  });

/** Envoi réel, irréversible. Confirmation explicite requise. */
export const sendNewsletterIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        segment: z.enum(NEWSLETTER_SEGMENT_KEYS),
        confirm: z.literal(true),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const db = await admin();
    const { resolveRecipients, deliverToRecipients, resourceUrl, SENDER_ADDRESS } = await import(
      "@/lib/newsletter-send.server"
    );
    const { emailSenderConfigured } = await import("@/lib/holiswiss-email.server");

    const issue = await loadIssue(db, data.id);
    const recipients = await resolveRecipients(db, data.segment as NewsletterSegmentKey);
    const blockers = checkSendable(issue, recipients.length, emailSenderConfigured());
    if (blockers.length > 0) throw new Error(blockers.join(" "));

    const email = actorEmail(context);
    const versionLabel = `Version du ${new Date(issue.updated_at).toLocaleString("fr-CH")}`;

    // Verrou anti double-clic : index unique partiel sur (issue_id) en statut « sending ».
    const { data: send, error: lockError } = await db
      .from("newsletter_sends")
      .insert({
        issue_id: data.id,
        is_test: false,
        segment: data.segment,
        subject: issue.email_subject,
        from_address: SENDER_ADDRESS,
        version_label: versionLabel,
        resource_url: resourceUrl(issue.lang, issue.slug),
        recipient_count: recipients.length,
        status: "sending",
        actor_id: context.userId,
        actor_email: email,
      })
      .select("id")
      .single();

    if (lockError || !send) {
      if ((lockError as { code?: string } | null)?.code === "23505") {
        throw new Error("Un envoi est déjà en cours ou déjà réalisé pour cette newsletter.");
      }
      throw new Error("Impossible de démarrer l'envoi.");
    }

    const results = await deliverToRecipients(issue, recipients);
    const sentCount = results.filter((r) => r.ok).length;
    const failedCount = results.length - sentCount;
    const status =
      sentCount === 0 ? "failed" : failedCount === 0 ? "sent" : "partially_failed";
    const firstError = results.find((r) => !r.ok)?.error ?? null;

    if (results.length > 0) {
      await db.from("newsletter_send_recipients").insert(
        results.map((r) => ({
          send_id: send.id,
          therapist_id: r.therapist_id,
          email: r.email,
          status: r.ok ? "sent" : "failed",
          provider_message_id: r.providerId,
          error_message: r.error,
        })),
      );
    }

    await db
      .from("newsletter_sends")
      .update({
        status,
        sent_count: sentCount,
        failed_count: failedCount,
        error_message: firstError,
        finished_at: new Date().toISOString(),
      })
      .eq("id", send.id);

    // Le statut « envoyée » n'est posé que si l'envoi a réussi intégralement.
    const issueStatus = status === "sent" ? "envoyee" : status === "failed" ? "echec" : null;
    if (issueStatus) {
      await db
        .from("newsletter_issues")
        .update({ status: issueStatus, updated_at: new Date().toISOString() })
        .eq("id", data.id);
    }

    await db.from("newsletter_revisions").insert({
      issue_id: data.id,
      action: `Envoi ${status} — ${sentCount}/${results.length} destinataires (segment ${data.segment})`,
      status: issueStatus ?? issue.status,
      comment: firstError,
      actor_id: context.userId,
      actor_email: email,
    });

    return { status, sentCount, failedCount, total: results.length, error: firstError };
  });

/** Journal des envois d'une newsletter. */
export const listNewsletterSends = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const db = await admin();
    const { data: rows } = await db
      .from("newsletter_sends")
      .select(
        "id,issue_id,is_test,segment,version_label,subject,from_address,resource_url,recipient_count,sent_count,failed_count,status,error_message,actor_email,started_at,finished_at",
      )
      .eq("issue_id", data.id)
      .order("started_at", { ascending: false })
      .limit(50);
    return { rows: rows ?? [] };
  });

/** Désinscription publique par jeton (aucune authentification requise). */
export const unsubscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ token: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row } = await db
      .from("therapists")
      .select("id")
      .eq("newsletter_unsubscribe_token", data.token)
      .maybeSingle();
    if (!row) return { ok: false as const };
    await db
      .from("therapists")
      .update({ newsletter_unsubscribed_at: new Date().toISOString(), newsletter_opt_in: false })
      .eq("id", row.id);
    return { ok: true as const };
  });