/**
 * Détection + alerte des inscriptions thérapeutes qui « bloquent ».
 *
 * Un blocage = un compte qui devrait pouvoir entrer dans l'espace thérapeute
 * mais qui n'y arrive pas (rôle manquant, e-mail non confirmé, échec d'inscription).
 * Chaque cas déclenche une notification admin (cloche) + e-mail/WhatsApp.
 */
import { notifyAdmin } from "@/lib/admin-notify.server";

export type BlockStage =
  | "signup_error"
  | "role_missing"
  | "email_unconfirmed"
  | "dashboard_denied";

const STAGE_LABEL: Record<BlockStage, string> = {
  signup_error: "Échec de l'inscription",
  role_missing: "Rôle thérapeute manquant",
  email_unconfirmed: "E-mail non confirmé",
  dashboard_denied: "Accès au tableau de bord refusé",
};

const NOTIFICATION_KIND = "therapist_signup_blocked";
/** Anti-spam : une seule alerte par compte/étape sur cette fenêtre. */
const DEDUPE_WINDOW_MS = 6 * 60 * 60 * 1000;

export type BlockedSignup = {
  user_id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
  has_role: boolean;
  has_profile: boolean;
  stage: BlockStage;
  reason: string;
};

/** Enregistre + notifie un blocage, en évitant les doublons. */
export async function reportSignupBlock(input: {
  userId?: string | null;
  email?: string | null;
  stage: BlockStage;
  detail?: string | null;
}): Promise<{ notified: boolean; deduped?: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const key = input.userId ?? input.email ?? "inconnu";
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();

  try {
    const { data: existing } = await db
      .from("notifications")
      .select("id")
      .eq("kind", NOTIFICATION_KIND)
      .gte("created_at", since)
      .contains("data", { key, stage: input.stage })
      .limit(1);
    if (existing && existing.length > 0) return { notified: false, deduped: true };
  } catch {
    // La déduplication ne doit jamais empêcher l'alerte.
  }

  const subject = `Inscription thérapeute bloquée — ${STAGE_LABEL[input.stage]}`;
  const summary = `${input.email ?? "e-mail inconnu"} · ${STAGE_LABEL[input.stage]}${
    input.detail ? ` · ${input.detail}` : ""
  }`;

  try {
    await db.rpc("create_admin_notification", {
      _kind: NOTIFICATION_KIND,
      _subject: subject,
      _summary: summary,
      _link: "/admin",
      _entity_type: "auth_user",
      _entity_id: input.userId ?? null,
      _data: {
        key,
        stage: input.stage,
        email: input.email ?? null,
        detail: input.detail ?? null,
      },
    });
  } catch {
    // On tente quand même les canaux externes.
  }

  try {
    await notifyAdmin({ subject, summary, link: "/admin" });
  } catch {
    // Best effort.
  }

  return { notified: true };
}

/** Scanne les comptes récents et retourne ceux qui sont bloqués. */
export async function scanBlockedSignups(days = 30): Promise<BlockedSignup[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const users = (list?.users ?? []).filter((u) => new Date(u.created_at).getTime() >= cutoff);
  if (users.length === 0) return [];

  const ids = users.map((u) => u.id);
  const emails = users.map((u) => (u.email ?? "").toLowerCase()).filter(Boolean);

  const [{ data: roles }, { data: profiles }, { data: byEmail }] = await Promise.all([
    db.from("user_roles").select("user_id,role").in("user_id", ids),
    db.from("therapists").select("user_id").in("user_id", ids),
    emails.length
      ? db.from("therapists").select("email").in("email", emails)
      : Promise.resolve({ data: [] }),
  ]);

  const roleSet = new Set(
    (roles ?? [])
      .filter((r: any) => r.role === "therapist" || r.role === "admin")
      .map((r: any) => r.user_id),
  );
  const profileSet = new Set((profiles ?? []).map((p: any) => p.user_id));
  const importedEmails = new Set(
    (byEmail ?? []).map((r: any) => String(r.email ?? "").toLowerCase()),
  );

  const blocked: BlockedSignup[] = [];
  for (const u of users) {
    const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
    const email = u.email ?? null;
    const wantsTherapist =
      meta.signup_intent === "therapist" ||
      profileSet.has(u.id) ||
      (email ? importedEmails.has(email.toLowerCase()) : false);
    if (!wantsTherapist) continue;

    const emailConfirmed = Boolean((u as any).email_confirmed_at ?? u.confirmed_at);
    const hasRole = roleSet.has(u.id);
    if (hasRole && emailConfirmed) continue;

    const stage: BlockStage = !emailConfirmed ? "email_unconfirmed" : "role_missing";
    blocked.push({
      user_id: u.id,
      email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      email_confirmed: emailConfirmed,
      has_role: hasRole,
      has_profile: profileSet.has(u.id),
      stage,
      reason: STAGE_LABEL[stage],
    });
  }
  return blocked.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Répare un compte bloqué : attribue le rôle thérapeute. */
export async function repairSignup(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await (supabaseAdmin as any)
    .from("user_roles")
    .upsert({ user_id: userId, role: "therapist" }, { onConflict: "user_id,role" });
  if (error) throw new Error("Impossible d'attribuer le rôle thérapeute.");
  return { ok: true };
}
