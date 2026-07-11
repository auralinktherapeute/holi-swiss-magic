import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOnboardingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: t } = await supabaseAdmin
      .from("therapists")
      .select("id, bio, short_bio, specialties, address, onboarding_complete, onboarding_completed_at")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!t) {
      return {
        onboarding_complete: false,
        checklist: {
          profileComplete: false,
          availabilitySet: false,
          packageCreated: false,
          questionnaireCreated: false,
          firstReservation: false,
        },
      };
    }

    const [{ data: invoiceSettings }, { count: availCount }, { count: pkgCount }, { count: qCount }, { count: apptCount }] =
      await Promise.all([
        supabaseAdmin
          .from("therapist_invoice_settings")
          .select("iban_ou_qr_iban,adresse_rue")
          .eq("therapist_id", t.id)
          .maybeSingle(),
        supabaseAdmin
          .from("availabilities")
          .select("id", { count: "exact", head: true })
          .eq("therapist_id", t.id)
          .eq("is_active", true),
        supabaseAdmin
          .from("service_packages")
          .select("id", { count: "exact", head: true })
          .eq("therapist_id", t.id),
        supabaseAdmin
          .from("questionnaires")
          .select("id", { count: "exact", head: true })
          .eq("therapist_id", t.id),
        supabaseAdmin
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("therapist_id", t.id),
      ]);

    const hasBio = !!(t.bio && t.bio.trim().length > 20) || !!(t.short_bio && t.short_bio.trim().length > 20);
    const hasSpec = Array.isArray(t.specialties) && t.specialties.length > 0;
    const hasAddress = !!(t.address && t.address.trim().length > 3);
    const hasBilling = !!(invoiceSettings?.iban_ou_qr_iban && invoiceSettings.iban_ou_qr_iban.trim().length > 5);
    const profileComplete = hasBio && hasSpec && hasAddress && hasBilling;

    return {
      onboarding_complete: !!t.onboarding_complete,
      checklist: {
        profileComplete,
        availabilitySet: (availCount ?? 0) > 0,
        packageCreated: (pkgCount ?? 0) > 0,
        questionnaireCreated: (qCount ?? 0) > 0,
        firstReservation: (apptCount ?? 0) > 0,
      },
    };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("therapists")
      .update({ onboarding_complete: true, onboarding_completed_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    if (error) throw new Error("Impossible d'enregistrer l'onboarding.");
    return { ok: true };
  });

export const resetOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("therapists")
      .update({ onboarding_complete: false })
      .eq("user_id", context.userId);
    if (error) throw new Error("Impossible de relancer l'onboarding.");
    return { ok: true };
  });