import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

// URL de l'Edge Function run-indexation déployée sur gpld
const RUN_INDEXATION_FN =
  "https://gpldaaqwvwopttachrma.supabase.co/functions/v1/run-indexation";

export type IndexationResult = {
  submitted: number;
  indexNowStatus: number;
  newUrlsAdded: number;
  notIndexedCount: number;
  reportId: string | null;
  errors: string[];
};

/**
 * Exécute le cycle d'indexation complet (IndexNow + sitemap + rapport + notification)
 * directement depuis le dashboard admin, sans dépendance à la tâche Claude planifiée.
 */
export const runFullIndexation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      scope: z.enum(["therapists", "all"]).default("therapists"),
      pin: z.string().min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const resp = await fetch(RUN_INDEXATION_FN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: data.scope, pin: data.pin }),
    });

    if (!resp.ok) {
      let errMsg = `HTTP ${resp.status}`;
      try {
        const err = (await resp.json()) as { error?: string };
        if (err.error) errMsg = err.error;
      } catch {
        // ignore
      }
      throw new Error(errMsg);
    }

    return (await resp.json()) as IndexationResult;
  });

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

/** Une URL poussée il y a moins de N jours n'est pas resoumise. */
const COOLDOWN_DAYS = 10;
/** Taille du lot, alignée sur celle de l'edge function `run-indexation`. */
const BATCH = 40;

/**
 * La file active, dans l'ordre de priorité — mêmes règles que l'edge function.
 *
 * TROIS FILTRES, et les deux premiers manquaient.
 *   1. `archived_at is null` — une URL acquise (indexée et stable) ou sortie du
 *      sitemap ne se repousse jamais. Sans ce filtre, `scope: "therapists"` ne
 *      regardait QUE `page_type`, donc repoussait aussi les fiches déjà
 *      indexées, et `scope: "all"` repoussait le site entier.
 *   2. Refroidissement — une URL inchangée resoumise en boucle finit ignorée
 *      par Bing. L'ancien commentaire de ce fichier affirmait l'inverse
 *      (« idempotent et sans quota pénalisant ») : c'était faux, et c'est ce
 *      qui a produit le re-ping des mêmes 24 URLs chaque jour jusqu'au 07/09.
 *   3. `priority asc` puis jamais-poussée d'abord — thérapeutes en tête.
 *
 * Le guillemet autour du timestamp est nécessaire : dans un `or=(…)`, le point
 * sépare colonne, opérateur et valeur, et un ISO 8601 nu casse l'analyse sur
 * son propre point de milliseconde.
 */
async function fetchQueue(scope: "therapists" | "unindexed" | "all"): Promise<string[]> {
  const cooldown = new Date(Date.now() - COOLDOWN_DAYS * 86400_000).toISOString();
  const scoped =
    scope === "therapists" ? "&page_type=eq.therapist" : scope === "unindexed" ? "&status=neq.indexed" : "";
  const res = await fetch(
    `${AGENTS_URL}/rest/v1/indexed_urls?select=url&archived_at=is.null${scoped}` +
      `&or=(last_submitted_at.is.null,last_submitted_at.lt."${cooldown}")` +
      `&order=priority.asc,last_submitted_at.asc.nullsfirst&limit=${BATCH}`,
    { headers: { apikey: AGENTS_ANON, Authorization: `Bearer ${AGENTS_ANON}` } },
  );
  if (!res.ok) throw new Error("Impossible de lire la file d'indexation.");
  const rows = (await res.json()) as { url: string }[];
  return rows.map((r) => r.url).filter((u) => u.startsWith(SITE));
}

/**
 * Ping IndexNow du lot prioritaire courant.
 *
 * ⚠️ Ne met PAS `last_submitted_at` à jour : la clé anon n'écrit pas sur
 * `indexed_urls`. Ce bouton reste donc un dépannage ; le cycle qui horodate,
 * archive et rend des comptes est `runFullIndexation` (edge function).
 */
export const pingIndexNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ scope: z.enum(["therapists", "unindexed", "all"]).default("therapists") }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const urls = await fetchQueue(data.scope);
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
