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
  /**
   * false = la table source n'existe pas encore en production (ex. la
   * délégation, développée mais pas déployée). Un tableau de bord qui affiche
   * « 0 » pour une source absente ment par omission : on le dit à la place.
   */
  available: boolean;
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

    // Une table absente ou renommée ne doit pas faire tomber tout le cerveau.
    // On distingue « 0 en attente » de « la table n'existe pas » (PGRST205) :
    // les deux valent zéro, mais ne veulent pas dire la même chose.
    type Counted = { n: number; ok: boolean };
    const count = async (build: () => any): Promise<Counted> => {
      try {
        const { count: c, error } = await build();
        if (error) return { n: 0, ok: error.code !== "PGRST205" && error.code !== "42P01" };
        return { n: c ?? 0, ok: true };
      } catch {
        return { n: 0, ok: false };
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
      count(() => db.from("therapist_articles").select("id", head).eq("statut", "en_attente_validation")),
      count(() => db.from("therapists").select("id", head)),
      count(() => db.from("therapists").select("id", head).eq("status", "active")),
    ]);

    const reviewsTotal = reviewsPending.n + reviewRepliesPending.n;
    const reviewsOk = reviewsPending.ok && reviewRepliesPending.ok;
    const agentsOk = agentRuns24h.ok && agentErrors24h.ok;
    const ABSENT = "Source absente en production";

    /** Un nœud vivant : compteur, seuils, et lien vers la page qui le traite. */
    const node = (
      c: Counted,
      hint: string,
      href: string,
      watchAt = 1,
      urgentAt = 5,
    ): BrainNodeState => ({
      pending: c.ok ? c.n : 0,
      tone: c.ok ? tone(c.n, watchAt, urgentAt) : "idle",
      hint: c.ok ? hint : ABSENT,
      href,
      available: c.ok,
    });

    const nodes: Record<string, BrainNodeState> = {
      routes_admin_therapeutes_tsx: node(
        therapistsPending,
        `${therapistsPending.n} fiche(s) en attente de validation`,
        "/admin/therapeutes",
        1,
        3,
      ),
      routes_admin_liste_attente_tsx: node(
        waitlistPending,
        `${waitlistPending.n} inscription(s) en liste d'attente`,
        "/admin/liste-attente",
      ),
      routes_admin_avis_tsx: node(
        { n: reviewsTotal, ok: reviewsOk },
        `${reviewsPending.n} avis + ${reviewRepliesPending.n} réponse(s) à modérer`,
        "/admin/avis",
      ),
      routes_admin_articles_tsx: node(
        articlesPending,
        `${articlesPending.n} article(s) en attente de validation`,
        "/admin/articles",
        1,
        4,
      ),
      routes_admin_paroles_tsx: node(
        expertArticlesPending,
        `${expertArticlesPending.n} texte(s) de thérapeute à relire`,
        "/admin/paroles",
        1,
        4,
      ),
      routes_admin_evenements_tsx: node(
        eventsPending,
        `${eventsPending.n} événement(s) à relire`,
        "/admin/evenements",
        1,
        4,
      ),
      routes_admin_notifications_tsx: node(
        notificationsUnread,
        `${notificationsUnread.n} notification(s) non lue(s)`,
        "/admin/notifications",
        1,
        8,
      ),
      routes_admin_delegation_tsx: node(
        delegationsOpen,
        `${delegationsOpen.n} délégation(s) en cours`,
        "/admin/delegation",
        1,
        3,
      ),
      routes_admin_crm_tsx: node(
        crmLeadsNew,
        `${crmLeadsNew.n} lead(s) à traiter`,
        "/admin/crm",
        1,
        6,
      ),
      // Les agents ne se mesurent pas en file d'attente mais en exécutions :
      // seuil propre, et une erreur suffit à passer en rouge.
      routes_admin_agents_tsx: {
        pending: agentsOk ? agentErrors24h.n : 0,
        tone: !agentsOk
          ? "idle"
          : agentErrors24h.n > 0
            ? "urgent"
            : agentRuns24h.n > 0
              ? "watch"
              : "idle",
        hint: agentsOk
          ? `${agentRuns24h.n} exécution(s) sur 24 h · ${agentErrors24h.n} en erreur`
          : ABSENT,
        href: "/admin/agents",
        available: agentsOk,
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
        therapistsTotal: therapistsTotal.n,
        therapistsActive: therapistsActive.n,
        pendingAll:
          therapistsPending.n +
          waitlistPending.n +
          reviewsTotal +
          articlesPending.n +
          eventsPending.n +
          expertArticlesPending.n,
        // null = pas de source en production, à distinguer de « aucune exécution »
        agentRuns24h: agentsOk ? agentRuns24h.n : null,
      },
    };
  });
