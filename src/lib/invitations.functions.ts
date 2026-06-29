import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

const SITE_URL = "https://holiswiss.ch";
const TOKEN_TTL_DAYS = 30;

function buildLink(token: string) {
  return `${SITE_URL}/creer-profil?token=${token}`;
}

/** Admin → send invitation to one waiting_list entry */
export const sendWaitlistInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("waiting_list")
      .select("id,email,first_name,specialty,invitation_status,invitation_token,token_expires_at")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr) throw new Error("Lecture impossible.");
    if (!row) throw new Error("Inscrit introuvable.");
    if (!row.email) throw new Error("Aucun email pour cet inscrit.");
    if ((row as any).invitation_status === "registered") {
      throw new Error("Ce thérapeute est déjà inscrit.");
    }

    const token = crypto.randomUUID();
    const now = new Date();
    const expires = new Date(now.getTime() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    const { error: upErr } = await supabaseAdmin
      .from("waiting_list")
      .update({
        invitation_token: token,
        invited_at: now.toISOString(),
        token_expires_at: expires.toISOString(),
        invitation_status: "invited",
      } as any)
      .eq("id", data.id);
    if (upErr) throw new Error("Impossible d'enregistrer l'invitation.");

    const { sendInvitationEmail } = await import("./invitation-email.server");
    const sent = await sendInvitationEmail({
      to: row.email,
      firstName: (row as any).first_name,
      specialty: (row as any).specialty,
      invitationLink: buildLink(token),
    });
    if (!sent.ok) {
      // do not surface token; revert status to allow retry
      await supabaseAdmin
        .from("waiting_list")
        .update({ invitation_status: "pending" } as any)
        .eq("id", data.id);
      throw new Error("L'email n'a pas pu être envoyé.");
    }
    return { ok: true, invited_at: now.toISOString() };
  });

/** Public → validate invitation token */
export const getInvitationByToken = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("waiting_list")
      .select("id,email,first_name,last_name,phone,specialty,canton,invitation_status,token_expires_at")
      .eq("invitation_token", data.token)
      .maybeSingle();
    if (error || !row) return { valid: false as const, reason: "invalid" as const };
    const r = row as any;
    if (r.invitation_status === "registered") {
      return { valid: false as const, reason: "already_registered" as const };
    }
    if (!r.token_expires_at || new Date(r.token_expires_at).getTime() < Date.now()) {
      return { valid: false as const, reason: "expired" as const };
    }
    return {
      valid: true as const,
      entry: {
        id: r.id,
        email: r.email as string,
        first_name: r.first_name as string | null,
        last_name: r.last_name as string | null,
        phone: r.phone as string | null,
        specialty: r.specialty as string | null,
        canton: r.canton as string | null,
      },
    };
  });

/** Public → complete registration from invitation */
export const completeInvitationSignup = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token: z.string().uuid(),
      password: z.string().min(8).max(72),
      first_name: z.string().trim().min(1).max(80),
      last_name: z.string().trim().min(1).max(80),
      phone: z.string().trim().max(40).optional(),
      specialty: z.string().trim().max(120).optional(),
      canton: z.string().trim().max(40).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("waiting_list")
      .select("id,email,invitation_status,token_expires_at")
      .eq("invitation_token", data.token)
      .maybeSingle();
    if (error || !row) throw new Error("Invitation invalide.");
    const r = row as any;
    if (r.invitation_status === "registered") throw new Error("Compte déjà créé.");
    if (!r.token_expires_at || new Date(r.token_expires_at).getTime() < Date.now()) {
      throw new Error("Invitation expirée.");
    }

    // Create auth user (email confirmed since invitation came from our email)
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: r.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { first_name: data.first_name, last_name: data.last_name },
    });
    if (cErr || !created.user) throw new Error(cErr?.message || "Création du compte impossible.");
    const userId = created.user.id;

    // Create therapist profile (pending review)
    const baseSlug = `${data.first_name}-${data.last_name}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const slug = `${baseSlug}-${userId.slice(0, 6)}`;

    await supabaseAdmin.from("therapists").insert({
      user_id: userId,
      slug,
      email: r.email,
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone || null,
      specialties: data.specialty ? [data.specialty] : [],
      city: data.canton || null,
      status: "pending",
    } as any);

    // Grant therapist role
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "therapist" }, { onConflict: "user_id,role" });

    // Mark waiting_list registered and invalidate token
    await supabaseAdmin
      .from("waiting_list")
      .update({
        invitation_status: "registered",
        invitation_token: null,
        token_expires_at: null,
        status: "converted",
      } as any)
      .eq("id", r.id);

    // Welcome email (best effort)
    try {
      const { sendWelcomeEmail } = await import("./invitation-email.server");
      await sendWelcomeEmail({ to: r.email, firstName: data.first_name });
    } catch (e) {
      console.error("[invitations] welcome email failed", e);
    }

    return { ok: true };
  });