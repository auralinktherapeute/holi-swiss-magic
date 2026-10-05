import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeSetupChecklist,
  ONBOARDING_EVENTS,
  TOUR_LENGTH,
  type SetupChecklist,
} from "@/lib/onboarding-checklist";

export type OnboardingProgress = {
  tour_started_at: string | null;
  tour_step: number;
  tour_paused_at: string | null;
  tour_completed_at: string | null;
  checklist_collapsed: boolean;
  checklist_reopened: boolean;
  events: Record<string, string>;
};

const EMPTY_CHECKLIST: SetupChecklist = {
  profile: false,
  services: false,
  currency: false,
  availability: false,
  publicPage: false,
  booking: false,
  billing: false,
};

export const getOnboardingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: t } = await supabaseAdmin
      .from("therapists")
      .select("id, first_name, slug, status, bio, short_bio, specialties, address, onboarding_complete")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!t) {
      return {
        onboarding_complete: false,
        first_name: null as string | null,
        slug: null as string | null,
        checklist: EMPTY_CHECKLIST,
        progress: null as OnboardingProgress | null,
      };
    }

    const [inv, avail, svc, pkg, consents, appts, prog] = await Promise.all([
      supabaseAdmin
        .from("therapist_invoice_settings")
        .select("iban_ou_qr_iban,adresse_rue,devise_defaut")
        .eq("therapist_id", t.id)
        .maybeSingle(),
      supabaseAdmin
        .from("availabilities")
        .select("id", { count: "exact", head: true })
        .eq("therapist_id", t.id)
        .eq("is_active", true),
      supabaseAdmin
        .from("billing_services")
        .select("id", { count: "exact", head: true })
        .eq("therapist_id", t.id)
        .eq("is_active", true)
        .gt("price", 0),
      supabaseAdmin
        .from("service_packages")
        .select("id", { count: "exact", head: true })
        .eq("therapist_id", t.id),
      supabaseAdmin
        .from("currency_change_consents")
        .select("id", { count: "exact", head: true })
        .eq("therapist_id", t.id)
        .is("client_id", null),
      supabaseAdmin
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("therapist_id", t.id),
      // Progression lue sous RLS, comme le thérapeute lui-même.
      context.supabase
        .from("therapist_onboarding_progress")
        .select("tour_started_at,tour_step,tour_paused_at,tour_completed_at,checklist_collapsed,checklist_reopened,events")
        .eq("therapist_id", t.id)
        .maybeSingle(),
    ]);

    const progress = (prog.data ?? null) as OnboardingProgress | null;

    const checklist = computeSetupChecklist(
      {
        bio: t.bio,
        shortBio: t.short_bio,
        specialties: t.specialties,
        address: t.address,
        activeServicesWithPrice: svc.count ?? 0,
        packages: pkg.count ?? 0,
        practiceCurrencyConsents: consents.count ?? 0,
        activeAvailabilities: avail.count ?? 0,
        iban: inv.data?.iban_ou_qr_iban,
        billingStreet: inv.data?.adresse_rue,
        practiceCurrency: inv.data?.devise_defaut ?? null,
        status: t.status,
        slug: t.slug,
        appointments: appts.count ?? 0,
      },
      progress?.events,
    );

    return {
      onboarding_complete: !!t.onboarding_complete,
      first_name: (t.first_name ?? null) as string | null,
      slug: (t.slug ?? null) as string | null,
      checklist,
      progress,
    };
  });

const progressInput = z.object({
  tourStep: z.number().int().min(0).max(TOUR_LENGTH - 1).optional(),
  tourStarted: z.boolean().optional(),
  tourPaused: z.boolean().optional(),
  tourCompleted: z.boolean().optional(),
  tourRestart: z.boolean().optional(),
  checklistCollapsed: z.boolean().optional(),
  checklistReopened: z.boolean().optional(),
  event: z.enum(ONBOARDING_EVENTS).optional(),
});

/** Enregistre la progression du thérapeute connecté (RLS : sa propre ligne uniquement). */
export const updateOnboardingProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => progressInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: t } = await context.supabase
      .from("therapists")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!t) throw new Error("Profil thérapeute introuvable.");

    const { data: cur } = await context.supabase
      .from("therapist_onboarding_progress")
      .select("tour_started_at,tour_completed_at,events")
      .eq("therapist_id", t.id)
      .maybeSingle();

    const now = new Date().toISOString();
    const row: Record<string, unknown> = { therapist_id: t.id, user_id: context.userId, updated_at: now };
    if (data.tourStep !== undefined) row.tour_step = data.tourStep;
    if (data.tourStarted && !cur?.tour_started_at) row.tour_started_at = now;
    if (data.tourPaused !== undefined) row.tour_paused_at = data.tourPaused ? now : null;
    if (data.tourCompleted) {
      row.tour_completed_at = now;
      row.tour_paused_at = null;
    }
    if (data.tourRestart) {
      row.tour_step = 0;
      row.tour_completed_at = null;
      row.tour_paused_at = null;
      if (!cur?.tour_started_at) row.tour_started_at = now;
    }
    if (data.checklistCollapsed !== undefined) row.checklist_collapsed = data.checklistCollapsed;
    if (data.checklistReopened !== undefined) row.checklist_reopened = data.checklistReopened;
    if (data.event) {
      const events = { ...((cur?.events as Record<string, string> | null) ?? {}) };
      if (!events[data.event]) events[data.event] = now;
      row.events = events;
    }

    const { error } = await context.supabase
      .from("therapist_onboarding_progress")
      .upsert(row as never, { onConflict: "therapist_id" });
    if (error) throw new Error("Impossible d'enregistrer la progression.");
    return { ok: true };
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
