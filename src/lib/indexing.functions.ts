import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

// Clé IndexNow — servie en texte brut par la route /<clé>.txt (vérification
// de propriété du domaine). IndexNow notifie Bing/Seznam/Yandex, et donc les
// IA qui s'appuient sur l'index Bing (ChatGPT en premier lieu).
export const INDEXNOW_KEY = "41c3cce6c762af43d78a7895dfc0afe3";

const SITE = "https://holiswiss.ch";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

// Base de suivi des agents (gpld) — lecture seule avec la clé anon publique
// (même source que le tableau /admin/indexation côté client).
const AGENTS_URL = "https://gpldaaqwvwopttachrma.supabase.co";
const AGENTS_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwbGRhYXF3dndvcHR0YWNocm1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5ODIyOTAsImV4cCI6MjA5NjU1ODI5MH0.BKuw_l2YrTZXTDHFlMcTC0yoH003_naKeoJXYs61fQg";

async function fetchTrackedUrls(scope: "therapists" | "unindexed" | "all"): Promise<string[]> {
  const filters =
    scope === "therapists"
      ? "&page_type=eq.therapist"
      : scope === "unindexed"
        ? "&status=neq.indexed"
        : "";
  const res = await fetch(
    `${AGENTS_URL}/rest/v1/indexed_urls?select=url${filters}&order=priority.asc&limit=1000`,
    { headers: { apikey: AGENTS_ANON, Authorization: `Bearer ${AGENTS_ANON}` } },
  );
  if (!res.ok) throw new Error("Impossible de lire la liste des URLs suivies.");
  const rows = (await res.json()) as { url: string }[];
  return rows.map((r) => r.url).filter((u) => u.startsWith(SITE));
}

/**
 * Ping IndexNow avec les URLs du scope choisi. Idempotent et sans quota
 * pénalisant : Bing accepte les re-soumissions.
 */
export const pingIndexNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ scope: z.enum(["therapists", "unindexed", "all"]).default("therapists") }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const urls = await fetchTrackedUrls(data.scope);
    if (urls.length === 0) return { submitted: 0, status: 0 };

    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: "holiswiss.ch",
        key: INDEXNOW_KEY,
        keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
        urlList: urls.slice(0, 10000),
      }),
    });

    // 200 = OK, 202 = accepté (clé pas encore vérifiée) — les deux sont bons
    if (res.status !== 200 && res.status !== 202) {
      throw new Error(`IndexNow a refusé la soumission (HTTP ${res.status}).`);
    }
    return { submitted: urls.length, status: res.status };
  });
