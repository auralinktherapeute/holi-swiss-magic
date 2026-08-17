import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

/**
 * État live du cerveau (/admin/cerveau).
 *
 * Les compteurs sont agrégés ICI, côté serveur, avec la service key : le
 * navigateur ne reçoit que des nombres et des libellés — jamais une ligne de
 * `therapists` ou de `reviews`. C'est ce qui permet d'afficher le tableau de
 * bord depuis n'importe quel appareil sans élargir la surface exposée.
 */

type Tone = "idle" | "watch" | "urgent";

/** node_id du graphe → ce qui s'y passe en ce moment. */
export type BrainNodeState = {
  pending: number;
  tone: Tone;
  hint: string;
  href?: string;
};

export type BrainActivityItem = {
  id: string;
  at: string;
  source: "notification" | "agent";
  label: string;
  detail: string | null;
  nodeId: string | null;
  tone: Tone;
};

const tone = (n: number, watchAt = 1, urgentAt = 5): Tone =>
  n >= urgentAt ? "urgent" : n >= watchAt ? "watch" : "idle";

export const getBrainState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    // Une table absente ou renommée ne doit pas faire tomber tout le cerveau :
    // le nœud concerné retombe simplement à zéro.
    const count = async (build: () => any): Promise<number> => {
      try {
        const { count: c } = await build();
        return c ?? 0;
      } catch {
        return 0;
      }
    };
    const rows = async <T>(build: () => any): Promise<T[]> => {
      try {
        const { data } = await build();
        return (data ?? []) as T[];
      } catch {
        return [];
      }
    };

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const head = { count: "exact" as const, head: true };

    const [
      therapistsPending,
      waitlistPending,
      reviewsPending,
      reviewRepliesPending,
      articlesPending,
      eventsPending,
      notificationsUnread,
      delegationsOpen,
      agentRuns24h,
      agentErrors24h,
      crmLeadsNew,
      expertArticlesPending,
      therapistsTotal,
      therapistsActive,
    ] = await Promise.all([
      count(() => db.from("therapists").select("id", head).eq("status", "pending")),
      count(() => db.from("waiting_list").select("id", head).eq("status", "pending")),
      count(() => db.from("reviews").select("id", head).eq("status", "pending")),
      count(() => db.from("reviews").select("id", head).eq("therapist_reply_status", "pending")),
      count(() => db.from("articles").select("id", head).eq("status", "pending_validation")),
      count(() => db.from("events").select("id", head).eq("status", "pending_review")),
      count(() => db.from("notifications").select("id", head).eq("is_read", false)),
      count(() =>
        db.from("delegation_requests").select("id", head).in("status", ["pending", "running"]),
      ),
      count(() => db.from("ai_agent_logs").select("id", head).gte("started_at", since24h)),
      count(() =>
        db
          .from("ai_agent_logs")
          .select("id", head)
          .gte("started_at", since24h)
          .eq("status", "error"),
      ),
      count(() => db.from("crm_leads").select("id", head).eq("status", "new")),
      count(() => db.from("therapist_articles").select("id", head).eq("status", "pending")),
      count(() => db.from("therapists").select("id", head)),
      count(() => db.from("therapists").select("id", head).eq("status", "active")),
    ]);

    const reviewsTotal = reviewsPending + reviewRepliesPending;

    const nodes: Record<string, BrainNodeState> = {
      routes_admin_therapeutes_tsx: {
        pending: therapistsPending,
        tone: tone(therapistsPending, 1, 3),
        hint: `${therapistsPending} fiche(s) en attente de validation`,
        href: "/admin/therapeutes",
      },
      routes_admin_liste_attente_tsx: {
        pending: waitlistPending,
        tone: tone(waitlistPending, 1, 5),
        hint: `${waitlistPending} inscription(s) en liste d'attente`,
        href: "/admin/liste-attente",
      },
      routes_admin_avis_tsx: {
        pending: reviewsTotal,
        tone: tone(reviewsTotal, 1, 5),
        hint: `${reviewsPending} avis + ${reviewRepliesPending} réponse(s) à modérer`,
        href: "/admin/avis",
      },
      routes_admin_articles_tsx: {
        pending: articlesPending,
        tone: tone(articlesPending, 1, 4),
        hint: `${articlesPending} article(s) en attente de validation`,
        href: "/admin/articles",
      },
      routes_admin_paroles_tsx: {
        pending: expertArticlesPending,
        tone: tone(expertArticlesPending, 1, 4),
        hint: `${expertArticlesPending} texte(s) de thérapeute à relire`,
        href: "/admin/paroles",
      },
      routes_admin_evenements_tsx: {
        pending: eventsPending,
        tone: tone(eventsPending, 1, 4),
        hint: `${eventsPending} événement(s) à relire`,
        href: "/admin/evenements",
      },
      routes_admin_notifications_tsx: {
        pending: notificationsUnread,
        tone: tone(notificationsUnread, 1, 8),
        hint: `${notificationsUnread} notification(s) non lue(s)`,
        href: "/admin/notifications",
      },
      routes_admin_delegation_tsx: {
        pending: delegationsOpen,
        tone: tone(delegationsOpen, 1, 3),
        hint: `${delegationsOpen} délégation(s) en cours`,
        href: "/admin/delegation",
      },
      routes_admin_agents_tsx: {
        pending: agentErrors24h,
        tone: agentErrors24h > 0 ? "urgent" : agentRuns24h > 0 ? "watch" : "idle",
        hint: `${agentRuns24h} exécution(s) sur 24 h · ${agentErrors24h} en erreur`,
        href: "/admin/agents",
      },
      routes_admin_crm_tsx: {
        pending: crmLeadsNew,
        tone: tone(crmLeadsNew, 1, 6),
        hint: `${crmLeadsNew} lead(s) à traiter`,
        href: "/admin/crm",
      },
    };

    // ── Flux d'activité : notifications + exécutions d'agents, fusionnées ──
    const [notifs, logs] = await Promise.all([
      rows<any>(() =>
        db
          .from("notifications")
          .select("id,kind,subject,summary,is_read,created_at")
          .order("created_at", { ascending: false })
          .limit(15),
      ),
      rows<any>(() =>
        db
          .from("ai_agent_logs")
          .select("id,agent_slug,status,message,started_at")
          .order("started_at", { ascending: false })
          .limit(15),
      ),
    ]);

    const activity: BrainActivityItem[] = [
      ...notifs.map((n) => ({
        id: `n_${n.id}`,
        at: n.created_at as string,
        source: "notification" as const,
        label: (n.subject as string) || (n.kind as string) || "Notification",
        detail: (n.summary as string) ?? null,
        nodeId: "routes_admin_notifications_tsx",
        tone: (n.is_read ? "idle" : "watch") as Tone,
      })),
      ...logs.map((l) => ({
        id: `a_${l.id}`,
        at: l.started_at as string,
        source: "agent" as const,
        label: `Agent ${l.agent_slug ?? "?"}`,
        detail: (l.message as string) ?? null,
        nodeId: "routes_admin_agents_tsx",
        tone: (l.status === "error" ? "urgent" : l.status === "running" ? "watch" : "idle") as Tone,
      })),
    ]
      .filter((a) => !!a.at)
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 24);

    return {
      ts: new Date().toISOString(),
      nodes,
      activity,
      totals: {
        therapistsTotal,
        therapistsActive,
        pendingAll:
          therapistsPending +
          waitlistPending +
          reviewsTotal +
          articlesPending +
          eventsPending +
          expertArticlesPending,
        agentRuns24h,
      },
    };
  });
