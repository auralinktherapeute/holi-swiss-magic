import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

const USER_TYPES = ["admin", "moderator", "therapist", "user"] as const;
const DEVICE_TYPES = ["mobile", "tablet", "desktop", "other"] as const;
type UserType = (typeof USER_TYPES)[number];

// ---------------------------------------------------------------------
// Identification optionnelle du visiteur — pour les événements publics
// (page_views, vues de profil, clics de réservation) qui doivent aussi
// fonctionner pour les visiteurs non connectés. Contrairement à
// requireSupabaseAuth, ceci ne lève jamais : un jeton absent ou invalide
// retombe simplement sur "visiteur anonyme" plutôt que de bloquer l'appel.
// L'identité vient uniquement d'un JWT Supabase valide, jamais d'une
// valeur fournie par le client — impossible à usurper.
// ---------------------------------------------------------------------
async function getOptionalUserId(): Promise<string | null> {
  try {
    const request = getRequest();
    const authHeader = request?.headers?.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice("Bearer ".length);
    if (!token) return null;

    const { createClient } = await import("@supabase/supabase-js");
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;

    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;
    return data.claims.sub as string;
  } catch {
    return null;
  }
}

async function resolveUserType(userId: string): Promise<UserType> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  const role = (data as any)?.role as string | undefined;
  return (USER_TYPES as readonly string[]).includes(role ?? "") ? (role as UserType) : "user";
}

// =======================================================================
// Écriture — tracking (appelé depuis les hooks React)
// =======================================================================

/** Démarre une session pour un utilisateur CONNECTÉ. Auth requise. */
export const startSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      deviceType: z.enum(DEVICE_TYPES),
      userAgent: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userType = await resolveUserType(context.userId);
    const { data: row, error } = await (supabaseAdmin as any)
      .from("user_sessions")
      .insert({
        user_id: context.userId,
        user_type: userType,
        device_type: data.deviceType,
        user_agent: data.userAgent ?? null,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[analytics] startSession failed:", error);
      throw new Error("Impossible de démarrer le suivi de session.");
    }
    return { sessionId: row.id as string };
  });

/** Clôt explicitement une session (déconnexion, ou beacon de fermeture d'onglet). */
export const endSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ sessionId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eq("user_id", ...) : un utilisateur ne peut clore que SA PROPRE session.
    await (supabaseAdmin as any)
      .from("user_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .is("ended_at", null);
    return { ok: true };
  });

/**
 * Enregistre une page vue. Fonctionne pour les visiteurs connectés ET
 * anonymes (user_id reste null dans ce dernier cas). Piggyback : si un
 * session_id est fourni, rafraîchit aussi last_seen_at de la session pour
 * que les rapports "session active" restent justes sans appel réseau
 * supplémentaire.
 */
export const logPageView = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      path: z.string().min(1).max(500),
      referrer: z.string().max(500).optional(),
      sessionId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await getOptionalUserId();
    const userType = userId ? await resolveUserType(userId) : null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await (supabaseAdmin as any).from("page_views").insert({
      user_id: userId,
      user_type: userType,
      session_id: data.sessionId ?? null,
      path: data.path,
      referrer: data.referrer ?? null,
    });
    // Ne jamais lever : une panne de tracking ne doit jamais casser la
    // navigation d'un visiteur. On journalise côté serveur pour rester
    // observable (sinon un vrai bug — table manquante, colonne renommée —
    // passerait inaperçu indéfiniment).
    if (error) console.error("[analytics] page_views insert failed:", error);

    if (data.sessionId) {
      await (supabaseAdmin as any)
        .from("user_sessions")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", data.sessionId)
        .is("ended_at", null);
    }
    return { ok: true };
  });

/** Enregistre une vue de profil thérapeute (visiteur connecté ou anonyme). */
export const logTherapistProfileView = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      therapistId: z.string().uuid(),
      sessionId: z.string().uuid().optional(),
      durationSeconds: z.number().int().min(0).max(86400).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await getOptionalUserId();
    const userType = userId ? await resolveUserType(userId) : null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await (supabaseAdmin as any).from("therapist_profile_views").insert({
      therapist_id: data.therapistId,
      viewer_user_id: userId,
      viewer_type: userType,
      session_id: data.sessionId ?? null,
      duration_seconds: data.durationSeconds ?? null,
    });
    if (error) console.error("[analytics] therapist_profile_views insert failed:", error);
    return { ok: true };
  });

/** Enregistre un clic sur "Réserver" (confirmation dans le widget de RDV). */
export const logTherapistBookingClick = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      therapistId: z.string().uuid(),
      sessionId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await getOptionalUserId();
    const userType = userId ? await resolveUserType(userId) : null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await (supabaseAdmin as any).from("therapist_booking_clicks").insert({
      therapist_id: data.therapistId,
      viewer_user_id: userId,
      viewer_type: userType,
      session_id: data.sessionId ?? null,
    });
    if (error) console.error("[analytics] therapist_booking_clicks insert failed:", error);
    return { ok: true };
  });

// =======================================================================
// Lecture — admin uniquement (rubrique /admin/analytics)
// =======================================================================

const PERIODS = ["day", "week", "month"] as const;
type Period = (typeof PERIODS)[number];

function periodStart(period: Period): Date {
  const d = new Date();
  if (period === "day") {
    d.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    const day = d.getDay() || 7; // lundi = 1 ... dimanche = 7
    d.setDate(d.getDate() - (day - 1));
    d.setHours(0, 0, 0, 0);
  } else {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

const overviewFilter = z.object({
  period: z.enum(PERIODS).default("day"),
  userType: z.enum(USER_TYPES).optional(),
});

export const getAnalyticsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(overviewFilter)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const todayStart = periodStart("day").toISOString();
    const monthStart = periodStart("month").toISOString();
    const rangeStart = periodStart(data.period).toISOString();

    const withType = <T>(q: T): T =>
      data.userType ? ((q as any).eq("user_type", data.userType) as T) : q;

    // `as any` : ces tables n'existent pas encore dans le database.types.ts
    // généré (migration pas encore appliquée à qqwud / types pas régénérés) —
    // même convention que le reste du code pour les tables toutes fraîches
    // (voir admin.functions.ts, `(supabaseAdmin as any).from("reviews")`).
    const [dauQ, mauQ, sessionsQ, durationsQ] = await Promise.all([
      withType(
        (supabaseAdmin as any)
          .from("user_sessions")
          .select("user_id", { count: "exact", head: true })
          .gte("last_seen_at", todayStart),
      ),
      withType(
        (supabaseAdmin as any)
          .from("user_sessions")
          .select("user_id", { count: "exact", head: true })
          .gte("last_seen_at", monthStart),
      ),
      withType(
        (supabaseAdmin as any)
          .from("user_sessions")
          .select("id", { count: "exact", head: true })
          .gte("started_at", rangeStart),
      ),
      withType(
        (supabaseAdmin as any)
          .from("user_sessions")
          .select("started_at,ended_at,last_seen_at")
          .gte("started_at", rangeStart)
          .limit(5000),
      ),
    ]);

    // DAU/MAU comptent des SESSIONS, pas des utilisateurs distincts (PostgREST
    // ne fait pas de count(distinct) via head:true) — approximation volontaire
    // pour rester simple en v1 ; passer par une vue SQL dédiée si un compte
    // d'utilisateurs distincts strict devient nécessaire.
    const rows = (durationsQ as any).data as
      | { started_at: string; ended_at: string | null; last_seen_at: string }[]
      | null;
    let avgSessionDurationSeconds = 0;
    if (rows && rows.length > 0) {
      const total = rows.reduce((sum, r) => {
        const end = new Date(r.ended_at ?? r.last_seen_at ?? r.started_at).getTime();
        const start = new Date(r.started_at).getTime();
        return sum + Math.max(0, (end - start) / 1000);
      }, 0);
      avgSessionDurationSeconds = Math.round(total / rows.length);
    }

    return {
      dau: (dauQ as any).count ?? 0,
      mau: (mauQ as any).count ?? 0,
      sessionsInPeriod: (sessionsQ as any).count ?? 0,
      avgSessionDurationSeconds,
    };
  });

export const getTopTherapists = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      period: z.enum(PERIODS).default("month"),
      limit: z.number().int().min(1).max(50).default(10),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = periodStart(data.period).toISOString();

    const [{ data: views }, { data: clicks }] = await Promise.all([
      (supabaseAdmin as any)
        .from("therapist_profile_views")
        .select("therapist_id")
        .gte("created_at", since)
        .limit(20000),
      (supabaseAdmin as any)
        .from("therapist_booking_clicks")
        .select("therapist_id")
        .gte("created_at", since)
        .limit(20000),
    ]);

    const viewCounts = new Map<string, number>();
    for (const v of (views ?? []) as { therapist_id: string }[]) {
      viewCounts.set(v.therapist_id, (viewCounts.get(v.therapist_id) ?? 0) + 1);
    }
    const clickCounts = new Map<string, number>();
    for (const c of (clicks ?? []) as { therapist_id: string }[]) {
      clickCounts.set(c.therapist_id, (clickCounts.get(c.therapist_id) ?? 0) + 1);
    }

    const topIds = [...viewCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, data.limit)
      .map(([id]) => id);

    if (topIds.length === 0) return [];

    const { data: therapists } = await supabaseAdmin
      .from("therapists")
      .select("id,slug,first_name,last_name")
      .in("id", topIds);

    const byId = new Map((therapists ?? []).map((t: any) => [t.id, t]));

    return topIds.map((id) => {
      const t = byId.get(id);
      const viewCount = viewCounts.get(id) ?? 0;
      const clickCount = clickCounts.get(id) ?? 0;
      return {
        id,
        slug: t?.slug ?? null,
        firstName: t?.first_name ?? "—",
        lastName: t?.last_name ?? "",
        viewCount,
        clickCount,
        clickThroughRate: viewCount > 0 ? clickCount / viewCount : 0,
      };
    });
  });

export const getRecentlyActiveTherapists = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ limit: z.number().int().min(1).max(50).default(10) }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: sessions } = await (supabaseAdmin as any)
      .from("user_sessions")
      .select("user_id,started_at")
      .eq("user_type", "therapist")
      .order("started_at", { ascending: false })
      .limit(2000);

    const rows = (sessions ?? []) as { user_id: string; started_at: string }[];
    const lastSeen = new Map<string, string>();
    const sessions7d = new Map<string, number>();
    for (const s of rows) {
      if (!lastSeen.has(s.user_id)) lastSeen.set(s.user_id, s.started_at);
      if (s.started_at >= since7) {
        sessions7d.set(s.user_id, (sessions7d.get(s.user_id) ?? 0) + 1);
      }
    }

    const topUserIds = [...lastSeen.entries()]
      .sort((a, b) => (a[1] < b[1] ? 1 : -1))
      .slice(0, data.limit)
      .map(([userId]) => userId);

    if (topUserIds.length === 0) return [];

    const { data: therapists } = await supabaseAdmin
      .from("therapists")
      .select("id,user_id,slug,first_name,last_name")
      .in("user_id", topUserIds);

    return (therapists ?? []).map((t: any) => ({
      id: t.id,
      slug: t.slug,
      firstName: t.first_name ?? "—",
      lastName: t.last_name ?? "",
      lastSessionAt: lastSeen.get(t.user_id) ?? null,
      sessions7d: sessions7d.get(t.user_id) ?? 0,
    }));
  });

// =======================================================================
// nLPD — droit à l'oubli sur les données analytics (indépendant de la
// suppression de compte, pour une demande ciblée sur le tracking seul).
// =======================================================================

export const purgeUserAnalyticsData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).rpc("purge_user_analytics", { _uid: data.userId });
    if (error) throw new Error("Impossible de purger les données analytics de cet utilisateur.");
    return { ok: true };
  });

export const anonymizeUserAnalyticsData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).rpc("anonymize_user_analytics", { _uid: data.userId });
    if (error) throw new Error("Impossible d'anonymiser les données analytics de cet utilisateur.");
    return { ok: true };
  });
