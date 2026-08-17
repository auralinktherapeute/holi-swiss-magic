// Logique serveur d'envoi de « La Lettre Holiswiss ».
// Réutilise exclusivement le transport Resend existant (holiswiss-email.server.ts).

import { renderNewsletterEmail } from "./newsletter-email.shared";
import { sendEmailBatch, sendRawEmail, FROM } from "./holiswiss-email.server";
import { isValidEmail, type NewsletterSegmentKey } from "./newsletter-send.shared";

export const SITE_URL = "https://holiswiss.ch";
const BATCH_SIZE = 100;

export type Recipient = { therapist_id: string; email: string; token: string };

export function unsubscribeUrl(token: string): string {
  return `${SITE_URL}/desinscription?token=${encodeURIComponent(token)}`;
}

export function resourceUrl(lang: string, slug: string | null): string | null {
  return slug ? `${SITE_URL}/${lang || "fr"}/lettre/${slug}` : null;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- tables newsletter absentes des types générés. */
type AnyClient = { from: (table: string) => any };

/**
 * Recalcule les destinataires côté serveur : consentement obligatoire,
 * désinscrits exclus, emails invalides exclus, doublons supprimés.
 */
export async function resolveRecipients(
  client: AnyClient,
  segment: NewsletterSegmentKey,
): Promise<Recipient[]> {
  let q = client
    .from("therapists")
    .select("id,email,newsletter_unsubscribe_token,created_at,onboarding_complete,subscription_plan")
    .eq("status", "active")
    .eq("newsletter_opt_in", true)
    .is("newsletter_unsubscribed_at", null)
    .not("email", "is", null)
    .limit(5000);

  if (segment === "nouveaux") {
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    q = q.gte("created_at", since);
  } else if (segment === "profils_incomplets") {
    q = q.eq("onboarding_complete", false);
  } else if (segment === "premium") {
    q = q.neq("subscription_plan", "free");
  }

  const { data, error } = await q;
  if (error) throw new Error("Impossible de calculer les destinataires.");

  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const row of (data ?? []) as {
    id: string;
    email: string | null;
    newsletter_unsubscribe_token: string | null;
  }[]) {
    const email = (row.email ?? "").trim().toLowerCase();
    if (!email || !isValidEmail(email) || seen.has(email)) continue;
    if (!row.newsletter_unsubscribe_token) continue;
    seen.add(email);
    out.push({ therapist_id: row.id, email, token: row.newsletter_unsubscribe_token });
  }
  return out;
}

export type IssueForSend = {
  id: string;
  lang: string;
  slug: string | null;
  published_at: string | null;
  email_subject: string | null;
  email_preheader: string | null;
  email_intro: string | null;
  email_body: string | null;
  email_button_label: string | null;
  email_button_url: string | null;
  email_footer: string | null;
  title: string;
};

export function buildEmailFor(issue: IssueForSend, token: string) {
  return renderNewsletterEmail({
    subject: issue.email_subject || issue.title,
    preheader: issue.email_preheader,
    intro: issue.email_intro,
    body: issue.email_body,
    buttonLabel: issue.email_button_label,
    buttonUrl: issue.email_button_url,
    footer: issue.email_footer,
    unsubscribeUrl: unsubscribeUrl(token),
  });
}

export type DeliveryResult = {
  email: string;
  therapist_id: string | null;
  ok: boolean;
  providerId: string | null;
  error: string | null;
};

/** Envoi réel par lots ; ne lève jamais, retourne le détail par destinataire. */
export async function deliverToRecipients(
  issue: IssueForSend,
  recipients: Recipient[],
): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    const emails = chunk.map((r) => {
      const { subject, html } = buildEmailFor(issue, r.token);
      return { to: r.email, subject, html };
    });
    const res = await sendEmailBatch(emails);
    chunk.forEach((r, idx) => {
      results.push({
        email: r.email,
        therapist_id: r.therapist_id,
        ok: res.ok,
        providerId: res.ok ? (res.ids[idx] ?? null) : null,
        error: res.ok ? null : (res.error ?? `HTTP ${res.status}`),
      });
    });
  }
  return results;
}

/** Email de test : même gabarit, même transport, aucun changement de statut. */
export async function deliverTest(issue: IssueForSend, to: string) {
  const { subject, html } = buildEmailFor(issue, "test-token");
  return sendRawEmail({ to, subject: `[TEST] ${subject}`, html });
}

export const SENDER_ADDRESS = FROM;