import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { NEWSLETTER_CONSENT_VERSION } from "@/lib/newsletter-consent.shared";

const SOURCES = [
  "homepage_newsletter",
  "public_footer",
  "newsletter_resource_page",
] as const;

const schema = z.object({
  email: z.string().trim().email().max(255),
  consent: z.literal(true),
  source: z.enum(SOURCES).default("homepage_newsletter"),
  locale: z.enum(["fr", "de", "it", "en"]).default("fr"),
});

/**
 * Inscription publique à « La Lettre Holiswiss ».
 * - Aucun compte créé, aucun email de confirmation envoyé.
 * - Aucun doublon : un email déjà présent est simplement réactivé.
 * - Ne révèle jamais si l'adresse existe déjà.
 */
export const subscribePublicNewsletter = createServerFn({ method: "POST" })
  .inputValidator((data) => schema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const now = new Date().toISOString();

    // Un thérapeute existant : on met à jour son consentement sur sa fiche,
    // sans créer de doublon dans la table des abonnés publics.
    const { data: therapist } = await supabaseAdmin
      .from("therapists")
      .select("id,newsletter_opt_in" as never)
      .ilike("email", email)
      .maybeSingle();

    const therapistRow = therapist as { id: string; newsletter_opt_in: boolean | null } | null;

    if (therapistRow) {
      if (therapistRow.newsletter_opt_in !== true) {
        await supabaseAdmin
          .from("therapists")
          .update({
            newsletter_opt_in: true,
            newsletter_opt_in_at: now,
            newsletter_unsubscribed_at: null,
            newsletter_consent_source: data.source,
            newsletter_consent_version: NEWSLETTER_CONSENT_VERSION,
            newsletter_consent_email: email,
          } as never)
          .eq("id", therapistRow.id);
      }
      return { ok: true };
    }

    const { data: existing } = await supabaseAdmin
      .from("newsletter_subscribers" as never)
      .select("id,opt_in,source" as never)
      .ilike("email", email)
      .maybeSingle();

    const row = existing as { id: string; opt_in: boolean | null; source: string | null } | null;

    if (row) {
      if (row.opt_in !== true) {
        await supabaseAdmin
          .from("newsletter_subscribers" as never)
          .update({
            opt_in: true,
            opt_in_at: now,
            unsubscribed_at: null,
            locale: data.locale,
            consent_version: NEWSLETTER_CONSENT_VERSION,
          } as never)
          .eq("id", row.id);
      }
      return { ok: true };
    }

    const { error } = await supabaseAdmin.from("newsletter_subscribers" as never).insert({
      email,
      locale: data.locale,
      source: data.source,
      consent_version: NEWSLETTER_CONSENT_VERSION,
      opt_in: true,
      opt_in_at: now,
    } as never);

    if (error) throw new Error("subscribe_failed");
    return { ok: true };
  });
