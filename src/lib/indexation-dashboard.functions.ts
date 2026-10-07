import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";
import {
  buildMyPageStatus,
  computeIndexationMetrics,
  indexationWarnings,
  myPageUrl,
  type IndexedUrlRow,
  type IndexingReportRow,
} from "@/lib/indexation-metrics";

/**
 * Tableau admin /admin/indexation — lecture serveur uniquement.
 * Le navigateur ne contacte plus le projet dédié.
 */
export const getIndexationDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const src = await import("@/lib/indexation-source.server");
    const now = Date.now();

    let urls: IndexedUrlRow[] | null = null;
    let reports: IndexingReportRow[] | null = null;
    let trackingError: string | null = null;
    try {
      [urls, reports] = await Promise.all([src.fetchTrackedUrls(), src.fetchReports()]);
    } catch (e) {
      console.error("indexation: suivi inaccessible", e instanceof Error ? e.message : e);
      trackingError = "Suivi inaccessible";
    }

    let expectedUrls: string[] | null = null;
    let sitemapError: string | null = null;
    try {
      const { buildSitemapBlocks } = await import("@/lib/sitemap-build.server");
      const { locOfBlock } = await import("@/lib/sitemap-groups");
      expectedUrls = (await buildSitemapBlocks()).map(locOfBlock);
    } catch (e) {
      console.error("indexation: plan du site non calculable", e instanceof Error ? e.message : e);
      sitemapError = "Plan du site indisponible";
    }

    const metrics = computeIndexationMetrics({
      urls,
      reports,
      expectedUrls,
      expectedComputedAt: new Date(now).toISOString(),
      now,
    });
    return {
      metrics,
      warnings: indexationWarnings({ m: metrics, reports, trackingError, sitemapError, now }),
      urls: urls ?? [],
      reports: reports ?? [],
      trackingAvailable: !trackingError,
      sitemapAvailable: !sitemapError,
      generatedAt: new Date(now).toISOString(),
    };
  });

/** Recontrôle d'une URL : même RPC qu'avant (PIN), désormais appelée par le serveur. */
export const requestUrlRecheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ urlId: z.string().uuid(), pin: z.string().min(1).max(32) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { callRecheckRpc } = await import("@/lib/indexation-source.server");
    return { ok: await callRecheckRpc(data.urlId, data.pin) };
  });

/**
 * Vue thérapeute : état Search Console de SA page, et rien d'autre.
 * Le profil est déduit de la session ; aucun slug n'est accepté du navigateur.
 */
export const getMyPageIndexStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const now = Date.now();
    const { data: me } = await context.supabase
      .from("therapists")
      .select("slug,status,verified")
      .eq("user_id", context.userId)
      .maybeSingle();
    const profile = me as {
      slug: string | null;
      status: string | null;
      verified: boolean | null;
    } | null;
    if (!profile) return null;
    const published = profile.status === "active" && !!profile.slug;
    const base = { published, adminValidated: profile.verified === true };
    if (!published)
      return {
        ...base,
        page: buildMyPageStatus({ published: false, row: null, fetchFailed: false, now }),
      };

    const { fetchOneUrlStatus } = await import("@/lib/indexation-source.server");
    try {
      const row = await fetchOneUrlStatus(myPageUrl(profile.slug as string));
      return {
        ...base,
        page: buildMyPageStatus({ published: true, row, fetchFailed: false, now }),
      };
    } catch (e) {
      console.error("indexation: état de page indisponible", e instanceof Error ? e.message : e);
      return {
        ...base,
        page: buildMyPageStatus({ published: true, row: null, fetchFailed: true, now }),
      };
    }
  });
