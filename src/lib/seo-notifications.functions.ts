import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

// ── Réglage du numéro WhatsApp admin (stocké côté serveur, jamais dans le repo) ──

const WHATSAPP_KEY = "admin_whatsapp_to";

function normalizeWhatsappNumber(raw: string): string {
  const cleaned = raw.replace(/^whatsapp:/, "").replace(/[\s.-]/g, "");
  return `whatsapp:${cleaned}`;
}

function maskNumber(value: string): string {
  const digits = value.replace(/^whatsapp:/, "");
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 4)}•••${digits.slice(-3)}`;
}

export const getWhatsappTarget = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("app_settings")
      .select("value")
      .eq("key", WHATSAPP_KEY)
      .maybeSingle();
    const envValue = process.env.ADMIN_WHATSAPP_TO;
    const stored = typeof data?.value === "string" && data.value ? data.value : null;
    const effective = stored ?? envValue ?? null;
    return {
      configured: Boolean(effective),
      source: stored ? "app_settings" : envValue ? "env" : null,
      masked: effective ? maskNumber(effective) : null,
    };
  });

export const setWhatsappTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ number: z.string().regex(/^(whatsapp:)?\+?[0-9\s.-]{8,20}$/, "Numéro invalide") }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const value = normalizeWhatsappNumber(data.number.startsWith("+") || data.number.startsWith("whatsapp:") ? data.number : `+${data.number}`);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("app_settings")
      .upsert({ key: WHATSAPP_KEY, value, updated_at: new Date().toISOString() });
    if (error) throw new Error("Impossible d'enregistrer le numéro.");
    return { ok: true, masked: maskNumber(value) };
  });

// ── Test de notification (email + WhatsApp) avec résultat détaillé ──

export const sendTestNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { notifyAdmin } = await import("@/lib/admin-notify.server");
    return notifyAdmin({
      subject: "Test notifications Holiswiss",
      summary: "Test manuel depuis la rubrique « Amélioration SEO/GEO via Claude ». Si tu reçois ce message, le canal fonctionne.",
      link: "/admin/ameliorations-seo",
    });
  });
