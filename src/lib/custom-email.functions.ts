import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "HoliSwiss <contact@holiswiss.ch>";
const SITE_URL = "https://holiswiss.ch";
const TOKEN_TTL_DAYS = 30;

const templateIdSchema = z.enum([
  "invitation",
  "welcome",
  "profile_live",
  "reminder_complete",
  "official_launch",
  "custom",
]);

const baseSchema = z.object({
  waitlist_id: z.string().uuid(),
  template_id: templateIdSchema,
  custom_subject: z.string().trim().max(160).optional(),
  custom_message: z.string().trim().max(8000).optional(),
});

async function loadEntry(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("waiting_list")
    .select("id,email,first_name,last_name,specialty,created_at,invitation_token,token_expires_at,invitation_status")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error("Inscrit introuvable.");
  if (!data.email) throw new Error("Aucun email pour cet inscrit.");
  return data as any;
}

async function findTherapistSlug(email: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("therapists")
    .select("slug")
    .eq("email", email)
    .maybeSingle();
  return (data as any)?.slug ?? null;
}

async function ensureInvitationToken(entry: any): Promise<string> {
  if (
    entry.invitation_token &&
    entry.token_expires_at &&
    new Date(entry.token_expires_at).getTime() > Date.now()
  ) {
    return entry.invitation_token as string;
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await supabaseAdmin
    .from("waiting_list")
    .update({
      invitation_token: token,
      invited_at: new Date().toISOString(),
      token_expires_at: expires.toISOString(),
      invitation_status: entry.invitation_status === "registered" ? entry.invitation_status : "invited",
    } as any)
    .eq("id", entry.id);
  return token;
}

/** Render HTML preview (admin only) */
export const previewCustomEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(baseSchema)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const entry = await loadEntry(data.waitlist_id);
    const { buildEmail } = await import("./custom-email-templates.server");
    const slug = await findTherapistSlug(entry.email);
    let invitationLink: string | undefined;
    if (data.template_id === "invitation") {
      const token = entry.invitation_token || "TOKEN_PREVIEW";
      invitationLink = `${SITE_URL}/creer-profil?token=${token}`;
    }
    const { subject, html } = buildEmail({
      templateId: data.template_id,
      vars: {
        first_name: entry.first_name,
        last_name: entry.last_name,
        specialty: entry.specialty,
        email: entry.email,
        created_at: entry.created_at,
      },
      customSubject: data.custom_subject,
      customMessage: data.custom_message,
      therapistSlug: slug,
      invitationLink,
    });
    return { subject, html, recipient: entry.email as string };
  });

/** Send the email (admin only) */
export const sendCustomEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(baseSchema)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const entry = await loadEntry(data.waitlist_id);
    const { buildEmail } = await import("./custom-email-templates.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let invitationLink: string | undefined;
    if (data.template_id === "invitation") {
      const token = await ensureInvitationToken(entry);
      invitationLink = `${SITE_URL}/creer-profil?token=${token}`;
    }
    const slug = await findTherapistSlug(entry.email);

    const { subject, html } = buildEmail({
      templateId: data.template_id,
      vars: {
        first_name: entry.first_name,
        last_name: entry.last_name,
        specialty: entry.specialty,
        email: entry.email,
        created_at: entry.created_at,
      },
      customSubject: data.custom_subject,
      customMessage: data.custom_message,
      therapistSlug: slug,
      invitationLink,
    });

    const lovableKey = process.env.LOVABLE_API_KEY;
    const resendKey = process.env.RESEND_API_KEY_1 ?? process.env.RESEND_API_KEY;
    if (!lovableKey || !resendKey) {
      await supabaseAdmin.from("email_logs").insert({
        waitlist_id: entry.id,
        recipient_email: entry.email,
        template_id: data.template_id,
        subject,
        status: "failed",
        error_message: "missing_credentials",
        sent_by: context.userId,
      } as any);
      throw new Error("Service email non configuré.");
    }

    let status = "sent";
    let errorMessage: string | null = null;
    try {
      const res = await fetch(`${GATEWAY_URL}/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": resendKey,
        },
        body: JSON.stringify({ from: FROM, to: entry.email, subject, html }),
      });
      if (!res.ok) {
        status = "failed";
        errorMessage = `resend_${res.status}`;
      }
    } catch (e) {
      status = "failed";
      errorMessage = e instanceof Error ? e.message.slice(0, 280) : "fetch_error";
    }

    await supabaseAdmin.from("email_logs").insert({
      waitlist_id: entry.id,
      recipient_email: entry.email,
      template_id: data.template_id,
      subject,
      status,
      error_message: errorMessage,
      sent_by: context.userId,
    } as any);

    if (status === "failed") throw new Error("L'email n'a pas pu être envoyé.");
    return { ok: true, sent_at: new Date().toISOString() };
  });

/** List recent email logs for a waitlist entry */
export const listEmailLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ waitlist_id: z.string().uuid(), limit: z.number().int().min(1).max(20).default(5) }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("email_logs")
      .select("id,template_id,subject,status,sent_at,error_message")
      .eq("waitlist_id", data.waitlist_id)
      .order("sent_at", { ascending: false })
      .limit(data.limit);
    if (error) return { rows: [] as any[] };
    return { rows: (rows ?? []) as any[] };
  });
