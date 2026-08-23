import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

function secretsMatch(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export const Route = createFileRoute("/api/public/moderate-message")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-moderation-secret") ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;

        const { data: setting } = await admin
          .from("app_settings")
          .select("value")
          .eq("key", "moderation_agent_secret")
          .maybeSingle();
        const expected = typeof setting?.value === "string" ? setting.value : String(setting?.value ?? "");
        if (!expected || !provided || !secretsMatch(provided, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const messageId = String(payload?.message_id ?? "");
        const content = String(payload?.content ?? "");
        if (!messageId || !content) return new Response("Bad request", { status: 400 });

        const input = {
          messageId,
          content,
          userId: String(payload?.user_id ?? ""),
          familyId: payload?.family_id ? String(payload.family_id) : null,
        };

        const { moderateMessage, applyModerationVerdict } = await import("@/lib/community-moderation.server");
        const verdict = await moderateMessage(input);
        if (!verdict) return new Response(JSON.stringify({ ok: false, skipped: true }), { status: 200 });

        const result = await applyModerationVerdict(input, verdict);
        return new Response(JSON.stringify({ ok: true, ...result, severity: verdict.severity }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
