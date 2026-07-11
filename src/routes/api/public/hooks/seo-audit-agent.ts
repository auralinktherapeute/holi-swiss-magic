import { createFileRoute } from "@tanstack/react-router";

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/hooks/seo-audit-agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SEO_AUDIT_AGENT_SECRET ?? "";
        const provided =
          request.headers.get("x-agent-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (!expected || !timingSafeEqualStr(provided, expected)) {
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