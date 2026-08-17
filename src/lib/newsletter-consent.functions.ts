import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  NEWSLETTER_CONSENT_SOURCE_THERAPIST_PROFILE,
  NEWSLETTER_CONSENT_VERSION,
} from "@/lib/newsletter-consent.shared";

type ConsentRow = {
  id: string;
  email: string | null;
  newsletter_opt_in: boolean | null;
  newsletter_opt_in_at: string | null;
  newsletter_consent_source: string | null;
  newsletter_consent_version: string | null;
};

/** Lit l'état d'abonnement courant du thérapeute connecté. */
export const getMyNewsletterConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("therapists")
      .select(
        "id,email,newsletter_opt_in,newsletter_opt_in_at,newsletter_consent_source,newsletter_consent_version" as never
      )
      .eq("user_id", context.userId)
      .maybeSingle();
    const row = data as ConsentRow | null;
    return {
      optIn: row?.newsletter_opt_in ?? false,
      optInAt: row?.newsletter_opt_in_at ?? null,
      email: row?.email ?? null,
      source: row?.newsletter_consent_source ?? null,
      version: row?.newsletter_consent_version ?? null,
    };
  });

/**
 * Enregistre le consentement newsletter du thérapeute connecté.
 * - Pas d'email de confirmation, pas de double opt-in.
 * - Aucun doublon : l'abonnement existant est conservé tel quel (date initiale préservée).
 * - Désinscription uniquement sur action explicite (optIn = false).
 */
export const updateMyNewsletterConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ optIn: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: therapistRow } = await supabaseAdmin
      .from("therapists")
      .select(
        "id,email,newsletter_opt_in,newsletter_opt_in_at,newsletter_consent_source,newsletter_consent_version" as never
      )
      .eq("user_id", context.userId)
      .maybeSingle();

    const therapist = therapistRow as ConsentRow | null;
    if (!therapist) throw new Error("Profil thérapeute introuvable.");

    const alreadySubscribed = therapist.newsletter_opt_in === true;

    // Déjà inscrit et toujours inscrit : aucun doublon, aucune écriture.
    if (data.optIn && alreadySubscribed) {
      return {
        ok: true,
        optIn: true,
        alreadySubscribed: true,
        optInAt: therapist.newsletter_opt_in_at,
        email: therapist.email,
      };
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { newsletter_opt_in: data.optIn };

    if (data.optIn) {
      patch['newsletter_opt_in_at'] = now;
      patch['newsletter_unsubscribed_at'] = null;
      patch['newsletter_consent_source'] = NEWSLETTER_CONSENT_SOURCE_THERAPIST_PROFILE;
      patch['newsletter_consent_version'] = NEWSLETTER_CONSENT_VERSION;
      patch['newsletter_consent_email'] = therapist.email;
    } else {
      patch['newsletter_unsubscribed_at'] = now;
    }

    const { error } = await supabaseAdmin
      .from("therapists")
      .update(patch as never)
      .eq("id", therapist.id)
      .eq("user_id", context.userId);

    if (error) throw new Error("Impossible de mettre à jour le consentement newsletter.");

    return {
      ok: true,
      optIn: data.optIn,
      alreadySubscribed: false,
      optInAt: data.optIn ? now : null,
      email: therapist.email,
    };
  });
