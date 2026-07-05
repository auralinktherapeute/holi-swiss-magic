import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

const OVERRIDES_KEY = "email_template_overrides";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "HoliSwiss <contact@holiswiss.ch>";

const templateIdSchema = z.enum([
  "invitation",
  "welcome",
  "profile_live",
  "reminder_complete",
  "official_launch",
  "custom",
]);

const contentSchema = z.object({
  subject: z.string().trim().min(1).max(160),
  body: z.string().max(12000),
  cta_label: z.string().trim().max(80),
});

const SAMPLE_VARS = {
  first_name: "Marie",
  last_name: "Dupont",
  specialty: "naturopathie",
  email: "marie.dupont@example.ch",
  created_at: new Date().toISOString(),
};

async function loadOverrides() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("app_settings")
    .select("value")
    .eq("key", OVERRIDES_KEY)
    .maybeSingle();
  return (data?.value ?? {}) as Record<string, { subject?: string; body?: string; cta_label?: string }>;
}

async function saveOverrides(overrides: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await (supabaseAdmin as any)
    .from("app_settings")
    .upsert({ key: OVERRIDES_KEY, value: overrides, updated_at: new Date().toISOString() });
  if (error) throw new Error("Impossible d'enregistrer le template.");
}

/** Liste les templates : contenu effectif (défaut ⊕ override) + indicateur de modification. */
export const getEmailTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { TEMPLATE_DEFAULTS, TEMPLATE_OPTIONS, resolveTemplateContent } = await import(
      "./custom-email-templates.server"
    );
    const overrides = await loadOverrides();
    return TEMPLATE_OPTIONS.map((opt) => ({
      id: opt.id,
      label: opt.label,
      content: resolveTemplateContent(opt.id, overrides as never),
      defaults: TEMPLATE_DEFAULTS[opt.id],
      modified: Boolean(overrides[opt.id]),
    }));
  });

/** Enregistre l'override d'un template (objet, corps markdown, libellé CTA). */
export const saveEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ template_id: templateIdSchema, content: contentSchema }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { TEMPLATE_DEFAULTS } = await import("./custom-email-templates.server");
    const base = TEMPLATE_DEFAULTS[data.template_id];
    const overrides = await loadOverrides();
    const isDefault =
      data.content.subject === base.subject &&
      data.content.body === base.body &&
      data.content.cta_label === base.cta_label;
    if (isDefault) {
      delete overrides[data.template_id];
    } else {
      overrides[data.template_id] = data.content;
    }
    await saveOverrides(overrides);
    return { ok: true, modified: !isDefault };
  });

/** Réinitialise un template à son défaut. */
export const resetEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ template_id: templateIdSchema }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { TEMPLATE_DEFAULTS } = await import("./custom-email-templates.server");
    const overrides = await loadOverrides();
    delete overrides[data.template_id];
    await saveOverrides(overrides);
    return { ok: true, defaults: TEMPLATE_DEFAULTS[data.template_id] };
  });

/** Preview HTML avec des variables d'exemple — accepte un brouillon non enregistré. */
export const previewEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ template_id: templateIdSchema, draft: contentSchema.partial().optional() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { buildEmail } = await import("./custom-email-templates.server");
    const overrides = await loadOverrides();
    if (data.draft) {
      overrides[data.template_id] = { ...overrides[data.template_id], ...data.draft };
    }
    const { subject, html } = buildEmail({
      templateId: data.template_id,
      vars: SAMPLE_VARS,
      invitationLink: "https://holiswiss.ch/creer-profil?token=APERCU",
      therapistSlug: null,
      overrides: overrides as never,
    });
    return { subject, html };
  });

/** Envoi de test vers une adresse donnée (admin uniquement, marqué [TEST]). */
export const sendEmailTemplateTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      template_id: templateIdSchema,
      to: z.string().trim().email(),
      draft: contentSchema.partial().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { buildEmail } = await import("./custom-email-templates.server");
    const overrides = await loadOverrides();
    if (data.draft) {
      overrides[data.template_id] = { ...overrides[data.template_id], ...data.draft };
    }
    const { subject, html } = buildEmail({
      templateId: data.template_id,
      vars: { ...SAMPLE_VARS, email: data.to },
      invitationLink: "https://holiswiss.ch/creer-profil?token=TEST",
      therapistSlug: null,
      overrides: overrides as never,
    });

    const lovableKey = process.env.LOVABLE_API_KEY;
    const resendKey = process.env.RESEND_API_KEY_1 ?? process.env.RESEND_API_KEY;
    if (!lovableKey || !resendKey) throw new Error("Service email non configuré.");

    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({ from: FROM, to: data.to, subject: `[TEST] ${subject}`, html }),
    });
    if (!res.ok) throw new Error(`L'envoi de test a échoué (resend_${res.status}).`);
    return { ok: true, to: data.to, subject };
  });

/** Journal global des derniers envois (tous inscrits confondus). */
export const listRecentEmailLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("email_logs")
      .select("id,recipient_email,template_id,subject,status,sent_at,error_message")
      .order("sent_at", { ascending: false })
      .limit(25);
    if (error) return { rows: [] as any[] };
    return { rows: (data ?? []) as any[] };
  });
