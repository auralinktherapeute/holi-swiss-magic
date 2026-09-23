import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

/**
 * Webhook SVHH : enregistre ou révoque la certification SVHH d'un thérapeute.
 * Signature obligatoire (HMAC SHA-256 du corps brut, en-tête x-svhh-signature).
 * Révocation = statut seul ; la ligne, la date et la référence sont conservées.
 * Aucune donnée personnelle renvoyée, ni signature ni secret journalisés.
 */

const Body = z.discriminatedUnion("status", [
  z.object({
    therapist_slug: z.string().trim().min(1).max(200),
    status: z.literal("active"),
    certified_since: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s)),
    external_reference: z.string().trim().min(1).max(200),
  }),
  z.object({
    therapist_slug: z.string().trim().min(1).max(200),
    status: z.literal("revoked"),
    certified_since: z.string().optional(),
    external_reference: z.string().trim().min(1).max(200),
  }),
]);

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export function verifySvhhSignature(raw: string, header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const given = header.trim().replace(/^sha256=/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(given)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  return timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"));
}

export const Route = createFileRoute("/api/public/svhh/certification")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["SVHH_WEBHOOK_SECRET"];
        if (!secret) return json({ error: "not_configured" }, 503);

        const raw = await request.text();
        if (raw.length > 10_000) return json({ error: "payload_too_large" }, 413);
        if (!verifySvhhSignature(raw, request.headers.get("x-svhh-signature"), secret)) {
          return json({ error: "invalid_signature" }, 401);
        }

        let parsed: z.infer<typeof Body>;
        try {
          const r = Body.safeParse(JSON.parse(raw));
          if (!r.success) return json({ error: "invalid_body" }, 400);
          parsed = r.data;
        } catch {
          return json({ error: "invalid_json" }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: t, error: tErr } = await supabaseAdmin
          .from("therapists")
          .select("id")
          .eq("slug", parsed.therapist_slug)
          .maybeSingle();
        if (tErr) return json({ error: "read_failed" }, 500);
        if (!t) return json({ error: "therapist_not_found" }, 404);

        const { data: org, error: oErr } = await supabaseAdmin
          .from("certification_organizations")
          .select("id")
          .eq("code", "SV")
          .maybeSingle();
        if (oErr || !org) return json({ error: "organization_not_found" }, 500);

        const { data: current, error: cErr } = await supabaseAdmin
          .from("therapist_org_certifications")
          .select("id,status")
          .eq("therapist_id", t.id)
          .eq("organization_id", org.id)
          .maybeSingle();
        if (cErr) return json({ error: "read_failed" }, 500);

        let certId: string | null = current?.id ?? null;
        if (parsed.status === "active") {
          const { data: up, error } = await supabaseAdmin
            .from("therapist_org_certifications")
            .upsert(
              {
                therapist_id: t.id,
                organization_id: org.id,
                status: "active",
                certified_since: parsed.certified_since,
                external_reference: parsed.external_reference,
              },
              { onConflict: "therapist_id,organization_id" },
            )
            .select("id")
            .single();
          if (error) return json({ error: "write_failed" }, 500);
          certId = up.id;
        } else if (current && current.status !== "revoked") {
          const { error } = await supabaseAdmin
            .from("therapist_org_certifications")
            .update({ status: "revoked" })
            .eq("id", current.id);
          if (error) return json({ error: "write_failed" }, 500);
        }

        // Historique : uniquement sur un vrai changement de statut.
        const oldStatus = current?.status ?? null;
        if (certId && oldStatus !== parsed.status && (parsed.status === "active" || current)) {
          const { error: hErr } = await (supabaseAdmin as any)
            .from("therapist_org_certification_history")
            .insert({ certification_id: certId, old_status: oldStatus, new_status: parsed.status, changed_by: null });
          if (hErr) console.warn("[svhh-webhook] history_insert_failed", hErr.code ?? "unknown");
        }

        return json({ ok: true, therapist_slug: parsed.therapist_slug, status: parsed.status }, 200);
      },
    },
  },
});
