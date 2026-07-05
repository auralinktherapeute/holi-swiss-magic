import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function notifyAdmin(kind: string, subject: string, summary: string, link = "/admin") {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("notify_admin_event" as any, {
      _kind: kind,
      _subject: subject,
      _summary: summary,
      _link: link,
    });
  } catch (e) {
    console.error("[account] notifyAdmin failed", e);
  }
}

export const pauseMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: th, error } = await supabaseAdmin
      .from("therapists")
      .update({ status: "paused" })
      .eq("user_id", context.userId)
      .select("id,first_name,last_name,email")
      .maybeSingle();
    if (error) throw new Error("Impossible de mettre le profil en pause.");
    if (th) {
      await notifyAdmin(
        "therapist_paused",
        "Thérapeute en pause",
        `${th.first_name ?? ""} ${th.last_name ?? ""} (${th.email ?? ""}) a mis son profil en pause.`,
        "/admin/therapeutes",
      );
    }
    return { ok: true };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ confirm: z.literal("SUPPRIMER") }))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: th } = await supabaseAdmin
      .from("therapists")
      .select("id,first_name,last_name,email")
      .eq("user_id", context.userId)
      .maybeSingle();

    const email = th?.email ?? null;
    const fullName = `${th?.first_name ?? ""} ${th?.last_name ?? ""}`.trim();

    // Cascades delete therapists, appointments, reviews, availabilities, favorites, etc.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error("Impossible de supprimer le compte.");

    await notifyAdmin(
      "therapist_deleted",
      "Compte thérapeute supprimé (RGPD)",
      `${fullName || "Thérapeute"} ${email ? `(${email})` : ""} a supprimé définitivement son compte.`,
      "/admin/therapeutes",
    );

    // Best-effort confirmation email to the user
    if (email) {
      try {
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        if (LOVABLE_API_KEY && RESEND_API_KEY) {
          await fetch("https://connector-gateway.lovable.dev/resend/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": RESEND_API_KEY,
            },
            body: JSON.stringify({
              from: "HoliSwiss <onboarding@resend.dev>",
              to: [email],
              subject: "Votre compte HoliSwiss a été supprimé",
              html: `<p>Bonjour,</p><p>Votre compte HoliSwiss a été supprimé définitivement, conformément à votre demande et au RGPD (droit à l'oubli).</p><p>Toutes vos données personnelles ont été effacées de nos serveurs.</p><p>Merci pour la confiance que vous nous avez accordée.</p><p>— L'équipe HoliSwiss</p>`,
            }),
          });
        }
      } catch (e) {
        console.error("[account] delete confirmation email failed", e);
      }
    }

    return { ok: true };
  });