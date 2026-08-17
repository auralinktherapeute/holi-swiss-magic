import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/resend-events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RESEND_WEBHOOK_SECRET ?? "";
        const rawBody = await request.text();

        const { verifyResendSignature, applyResendEvent } =
          await import("@/lib/newsletter-events.server");

        const svixId = request.headers.get("svix-id");
        const ok = verifyResendSignature(
          rawBody,
          {
            id: svixId,
            timestamp: request.headers.get("svix-timestamp"),
            signature: request.headers.get("svix-signature"),
          },
          secret,
        );
        if (!ok) return new Response("Unauthorized", { status: 401 });

        try {
          const event = JSON.parse(rawBody);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const result = await applyResendEvent(supabaseAdmin as never, svixId as string, event);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("[resend-events] failed", e);
          return new Response(JSON.stringify({ ok: false }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
