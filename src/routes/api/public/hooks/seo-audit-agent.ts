import { createFileRoute } from "@tanstack/react-router";

const EXPECTED_APIKEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxd3VkbW5mYXZ2YXVrdWxkdWxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5OTg2MjUsImV4cCI6MjA5NjU3NDYyNX0.P-8PAwboYoul28Iqx_UMGH0c9_NPwBTsJPCkRMXKEpY";

export const Route = createFileRoute("/api/public/hooks/seo-audit-agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("apikey") !== EXPECTED_APIKEY) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { runSeoAudit, getPreviousCriticalCodes, notifyCriticalIssues } =
          await import("@/lib/seo-audit-runner.server");

        try {
          const prev = await getPreviousCriticalCodes();
          const result = await runSeoAudit();
          await notifyCriticalIssues(prev, result.issues);
          return Response.json({
            ok: true,
            seo_score: result.seo_score,
            geo_score: result.geo_score,
            global_score: result.global_score,
            critical_count: result.critical_count,
            resolved_count: result.resolved_count,
            audited_urls: result.audited_urls,
            audit_date: result.audit_date,
          });
        } catch (e) {
          console.error("[seo-audit-agent] failed", e);
          return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});