import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Endpoint dédié pour navigator.sendBeacon() : contrairement aux server
// functions TanStack (appelées via leur wrapper RPC généré), sendBeacon a
// besoin d'une URL fixe et n'envoie pas l'en-tête Authorization. On ne peut
// donc pas identifier l'appelant ici — on se contente de fermer la session
// désignée par son id, sans jamais faire confiance à un user_id fourni par
// le client (il n'y en a pas dans ce payload).
const payloadSchema = z.object({ sessionId: z.string().uuid() });

export const Route = createFileRoute("/api/public/analytics/end-session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const parsed = payloadSchema.safeParse(body);
        if (!parsed.success) return new Response("Bad request", { status: 400 });

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // Ferme uniquement une session encore ouverte : idempotent si le
          // beacon est envoyé plusieurs fois (rechargement, onglets multiples).
          await (supabaseAdmin as any)
            .from("user_sessions")
            .update({ ended_at: new Date().toISOString() })
            .eq("id", parsed.data.sessionId)
            .is("ended_at", null);
        } catch (e) {
          console.error("[analytics] beacon end-session failed:", e);
          // sendBeacon n'observe pas la réponse : on répond 204 dans tous les
          // cas pour ne jamais faire échouer la navigation du visiteur.
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});
