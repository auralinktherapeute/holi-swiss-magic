/**
 * Edge Function : run-indexation
 * Projet : gpldaaqwvwopttachrma
 * Déploiement : supabase functions deploy run-indexation --project-ref gpldaaqwvwopttachrma
 *
 * Cycle d'indexation serveur, appelé par pg_cron (`holiswiss-indexation-daily`,
 * 05:00 UTC) et par le bouton de /admin/indexation.
 *
 *   1. Validation PIN (seo_admin_secrets)
 *   2. Lecture du sitemap en ligne — SOURCE DE VÉRITÉ du périmètre
 *   3. Inspection Search Console : CONSTATER l'état réel (voir `gsc.ts`)
 *   4. Réconciliation : ajout des nouvelles URLs, ARCHIVAGE de ce qui est acquis
 *      ou sorti du périmètre
 *   5. Sélection de la file active par PRIORITÉ, avec refroidissement
 *   5bis. PRÉ-CONTRÔLE d'indexabilité du lot (voir `preflight.ts`)
 *   6. Ping IndexNow + horodatage de la soumission
 *   7. Rapport dans indexing_reports
 *   8. Notification admin (façade gardée, repli e-mail Resend)
 *
 * Le pré-contrôle est la garde d'entrée : on ne notifie IndexNow que d'URLs qui
 * répondent 200, ne redirigent pas, ne portent pas de `noindex` et se déclarent
 * canoniques d'elles-mêmes. Sans lui, 77 des 280 premières URLs poussées
 * n'auraient pas dû l'être (relevé du 08/09).
 *
 * L'inspection passe AVANT la réconciliation : l'archivage doit trancher sur des
 * états qu'on vient de constater, pas sur ceux d'il y a trois semaines. Elle se
 * désactive proprement si `GSC_SERVICE_ACCOUNT_JSON` est absent — le reste du
 * cycle tourne alors comme avant, en poussant sans savoir constater.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REFONTE DU 07/09/2026 — audit `docs/audit-indexation-2026-09-07.md`
 *
 * CE QUI N'ALLAIT PAS
 *   La sélection ne regardait que `status <> 'indexed'`. Or RIEN ne faisait
 *   jamais avancer `status` : l'inspection Search Console n'existe que dans la
 *   tâche Claude locale, qui ne tourne que si le Mac est ouvert. La file ne
 *   diminuait donc jamais et le cron re-pingait IndexNow avec LES MÊMES 24 URLs
 *   tous les jours — les e-mails des 05/09 et 06/09 étaient identiques à
 *   l'URL près. Bing finit par ignorer une URL resoumise inchangée en boucle.
 *
 * LE PRINCIPE QUI REMPLACE ÇA
 *   Le sitemap tranche. Une URL qu'il ne déclare plus n'a rien à faire dans la
 *   file : elle est archivée. Une URL acquise depuis 21 jours est archivée. Une
 *   URL poussée il y a moins de 10 jours attend son tour. Ce qui reste est
 *   servi dans l'ordre de priorité — thérapeutes d'abord.
 *
 *   Conséquence utile : désactiver un profil dans qqwud le sort du sitemap, donc
 *   de la file, tout seul. Il n'y a aucune liste de slugs à maintenir ici.
 *
 * GARDE-FOU
 *   L'archivage « hors sitemap » n'est appliqué QUE si le sitemap a été lu ET
 *   qu'il contient au moins SITEMAP_FLOOR URLs. Un sitemap en échec ou amputé
 *   archiverait sinon le site entier en une exécution.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ NOTIFICATION — `create_admin_notification` (qqwud) n'est PLUS appelable
 * avec la clé anon depuis le durcissement du 16/08 (EXECUTE révoqué : la
 * fonction écrit et déclenche un http_post sortant sans garde). Cette fonction
 * l'appelait encore : d'où un `errors:1` sur CHAQUE rapport `cron` depuis le
 * 24/08. On passe désormais par la façade gardée `request_admin_notification`
 * (migration 20260824174143), dont le sésame est le secret partagé
 * `agent_notify_secret` (seo_admin_secrets, gpld).
 */

import { accessToken, inspect, toStatus } from "./gsc.ts";
import { preflightAll } from "./preflight.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const INDEXNOW_KEY = "41c3cce6c762af43d78a7895dfc0afe3";
const SITE = "https://holiswiss.ch";
const UA = "holiswiss-indexation-agent/3.0";

// Clé anon qqwud — publique par nature (dépôt GitHub public).
const QQWUD_URL = "https://qqwudmnfavvaukuldulr.supabase.co";
const QQWUD_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxd3VkbW5mYXZ2YXVrdWxkdWxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5OTg2MjUsImV4cCI6MjA5NjU3NDYyNX0.P-8PAwboYoul28Iqx_UMGH0c9_NPwBTsJPCkRMXKEpY";

/** Nombre d'URLs sous lequel le sitemap est jugé non fiable (cf. garde-fou). */
const SITEMAP_FLOOR = 200;
/** Une URL poussée il y a moins de N jours n'est pas resoumise. */
const COOLDOWN_DAYS = 10;
/** Une URL indexée depuis N jours est considérée acquise. */
const INDEXED_STABLE_DAYS = 21;
/** Délai de grâce avant d'archiver une URL absente du sitemap. */
const OUT_OF_SITEMAP_GRACE_DAYS = 14;
/** Taille du lot poussé à IndexNow par exécution. */
const BATCH = 40;
/** URLs actives inspectées par exécution (quota Google : 2 000/j). */
const INSPECT_ACTIVE = 85;
/** Archivées re-contrôlées par exécution, pour rattraper une désindexation. */
const INSPECT_ARCHIVED = 15;
/** Inspections simultanées. L'API plafonne à ~600 req/min : on en est loin. */
const INSPECT_CONCURRENCY = 10;
/**
 * Au-delà de ce temps passé en inspection, on arrête d'en lancer.
 *
 * Une edge function tuée en cours de route ne produit NI rapport NI
 * notification : le cycle disparaît en silence, exactement le mode de panne
 * qu'on passe cette refonte à supprimer. Mieux vaut inspecter 70 URLs et finir
 * proprement que d'en viser 100 et perdre le run. Les URLs non traitées
 * gardent leur `last_checked_at`, donc elles repassent en tête au run suivant.
 */
const INSPECT_DEADLINE_MS = 90_000;
/** Propriété Search Console. */
const GSC_SITE = "sc-domain:holiswiss.ch";

type UrlRow = {
  id: string;
  url: string;
  page_type: string;
  status: string;
  priority: number;
  last_submitted_at: string | null;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function gpld(path: string, opts: RequestInit = {}): Promise<Response> {
  const base = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return fetch(`${base}${path}`, {
    ...opts,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });
}

async function secret(k: string): Promise<string | null> {
  const r = await gpld(`/rest/v1/seo_admin_secrets?k=eq.${k}&select=v`);
  if (!r.ok) return null;
  const rows: { v: string }[] = await r.json();
  return rows?.[0]?.v ?? null;
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400_000).toISOString();
}

/**
 * Échelle de priorité — UNE seule, partagée par le sitemap, ce run et le
 * dashboard. « D'abord les thérapeutes, ensuite les autres pages. »
 *
 *   1 fiche thérapeute · 2 accueil + listings · 3 spécialité
 *   4 blog · 5 statiques, paroles, événements
 */
function classify(url: string): { page_type: string; priority: number } {
  const p = url.replace(SITE, "");
  if (/^\/[a-z]{2}\/therapeute\//.test(p)) return { page_type: "therapist", priority: 1 };
  if (/^\/[a-z]{2}\/?$/.test(p)) return { page_type: "home", priority: 2 };
  if (/^\/[a-z]{2}\/therapeutes(\/|$)/.test(p)) return { page_type: "listing", priority: 2 };
  if (/^\/[a-z]{2}\/specialites\//.test(p)) return { page_type: "specialty", priority: 3 };
  if (/^\/[a-z]{2}\/blog(\/|$)/.test(p)) return { page_type: "article", priority: 4 };
  if (/^\/[a-z]{2}\/evenements\//.test(p)) return { page_type: "event", priority: 5 };
  return { page_type: "static", priority: 5 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { scope?: string; pin?: string; trigger?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { scope = "all", pin, trigger: rawTrigger = "manual" } = body;
  const ALLOWED_TRIGGERS = ["manual", "cron", "daily", "weekly", "initial"];
  const trigger = ALLOWED_TRIGGERS.includes(rawTrigger) ? rawTrigger : "manual";

  // ── 1. PIN ────────────────────────────────────────────────────────────────
  const expectedPin = await secret("validation_pin");
  if (!expectedPin) return json({ error: "Impossible de vérifier le PIN" }, 500);
  if (expectedPin !== String(pin)) return json({ error: "PIN invalide" }, 401);

  const now = new Date().toISOString();
  const errors: string[] = [];
  const archived: Record<string, number> = {};
  let newUrlsAdded = 0;
  let indexNowSubmitted = 0;
  let indexNowStatus = 0;

  // ── 2. Sitemap : le périmètre fait autorité ───────────────────────────────
  let sitemapUrls: Set<string> | null = null;
  try {
    const resp = await fetch(`${SITE}/sitemap.xml`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(20000),
    });
    if (!resp.ok) {
      errors.push(`Sitemap HTTP ${resp.status}`);
    } else {
      const xml = await resp.text();
      const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)]
        .map((m) => m[1].trim())
        .filter((u) => u.startsWith(SITE));
      if (locs.length < SITEMAP_FLOOR) {
        // Un sitemap amputé archiverait le site entier : on refuse de s'en servir.
        errors.push(`Sitemap suspect (${locs.length} URLs < ${SITEMAP_FLOOR}) — réconciliation ignorée`);
      } else {
        sitemapUrls = new Set(locs);
      }
    }
  } catch (e) {
    errors.push(`Sitemap: ${(e as Error).message}`);
  }

  // ── 3. Inspection Search Console ──────────────────────────────────────────
  //
  // AVANT la réconciliation, délibérément : l'archivage doit trancher sur des
  // états qu'on vient de constater, pas sur ceux d'il y a trois semaines.
  // Se désactive proprement si le secret est absent — le reste du cycle tourne.
  let inspected = 0;
  let newlyIndexed = 0;
  let unarchived = 0;
  let deadlineHit = 0; // URLs laissées de côté par l'échéance de temps
  const saJson = Deno.env.get("GSC_SERVICE_ACCOUNT_JSON");
  if (saJson) {
    try {
      const token = await accessToken(saJson);
      if (!token) throw new Error("jeton Google vide");

      // Actives d'abord, par priorité, jamais contrôlées en tête. Puis quelques
      // archivées « indexées stables » : si Google en a désindexé une, elle doit
      // revenir en file — c'est le SEUL cas de désarchivage.
      const [actResp, arcResp] = await Promise.all([
        gpld(
          `/rest/v1/indexed_urls?archived_at=is.null&select=id,url,status` +
            `&order=priority.asc,last_checked_at.asc.nullsfirst&limit=${INSPECT_ACTIVE}`,
        ),
        gpld(
          `/rest/v1/indexed_urls?archived_at=not.is.null&archive_reason=eq.indexed_stable` +
            `&select=id,url,status&order=last_checked_at.asc.nullsfirst&limit=${INSPECT_ARCHIVED}`,
        ),
      ]);
      const targets: { id: string; url: string; status: string; wasArchived?: boolean }[] = [
        ...(actResp.ok ? await actResp.json() : []),
        ...((arcResp.ok ? await arcResp.json() : []) as { id: string; url: string; status: string }[])
          .map((r) => ({ ...r, wasArchived: true })),
      ];

      // PAR PAQUETS PARALLÈLES, pas en série. En série, 30 inspections à ~2 s
      // dépassaient le budget de temps de l'edge function : le run du 07/09
      // s'est fait couper après 19 URLs. Dix à la fois tient largement, tout
      // en restant très loin du plafond de ~600 requêtes/minute de l'API.
      const startedAt = Date.now();
      for (let i = 0; i < targets.length; i += INSPECT_CONCURRENCY) {
        // On ne lance JAMAIS une vague qui ferait dépasser l'échéance : un run
        // tué ne produit ni rapport ni notification.
        if (Date.now() - startedAt > INSPECT_DEADLINE_MS) {
          deadlineHit = targets.length - i;
          break;
        }
        await Promise.all(
          targets.slice(i, i + INSPECT_CONCURRENCY).map(async (t) => {
            const res = await inspect(token, GSC_SITE, t.url);
            if (!res) return;
            inspected++;
            const status = toStatus(res, t.url);
            const patch: Record<string, unknown> = {
              status,
              coverage_state: res.coverageState,
              google_verdict: res.verdict,
              google_canonical: res.googleCanonical,
              last_crawl_at: res.lastCrawlTime ?? null,
              last_checked_at: now,
              updated_at: now,
            };
            if (status === "indexed" && t.status !== "indexed") {
              patch.indexed_at = now;
              newlyIndexed++;
            }
            // Une archivée qui n'est plus indexée retourne en file — le seul
            // désarchivage automatique, et la raison d'être du re-contrôle.
            if (t.wasArchived && status !== "indexed") {
              patch.archived_at = null;
              patch.archive_reason = null;
              unarchived++;
            }
            const up = await gpld(`/rest/v1/indexed_urls?id=eq.${t.id}`, {
              method: "PATCH",
              headers: { Prefer: "return=minimal" },
              body: JSON.stringify(patch),
            });
            if (!up.ok) errors.push(`MAJ inspection HTTP ${up.status}`);
          }),
        );
      }
    } catch (e) {
      errors.push(`Inspection GSC : ${(e as Error).message}`);
    }
  }

  // ── 4. Réconciliation ─────────────────────────────────────────────────────
  //
  // Les deux helpers d'archivage sont déclarés ici, avant leurs appels : le
  // hoisting les rendrait utilisables plus bas de toute façon, mais on ne lit
  // pas un cycle d'archivage en remontant le fichier.
  async function archivePatch(filter: string, reason: string, at: string): Promise<number | null> {
    const r = await gpld(`/rest/v1/indexed_urls?${filter}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ archived_at: at, archive_reason: reason, updated_at: at }),
    });
    if (!r.ok) {
      errors.push(`Archivage ${reason} HTTP ${r.status}`);
      return null;
    }
    return ((await r.json()) as unknown[]).length;
  }

  async function archiveByIds(ids: string[], reason: string, at: string): Promise<number | null> {
    let total = 0;
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const r = await gpld(`/rest/v1/indexed_urls?id=in.(${chunk.join(",")})`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ archived_at: at, archive_reason: reason, updated_at: at }),
      });
      if (!r.ok) {
        errors.push(`Archivage ${reason} HTTP ${r.status}`);
        return null;
      }
      total += chunk.length;
    }
    return total;
  }

  const trackedResp = await gpld(
    "/rest/v1/indexed_urls?select=id,url,archived_at,first_seen_at&limit=5000",
  );
  const tracked: {
    id: string;
    url: string;
    archived_at: string | null;
    first_seen_at: string | null;
  }[] = trackedResp.ok ? await trackedResp.json() : [];
  const trackedByUrl = new Map(tracked.map((r) => [r.url, r]));

  if (sitemapUrls) {
    // 4a. Nouvelles URLs du sitemap → suivi, avec la bonne priorité d'emblée.
    const missing = [...sitemapUrls].filter((u) => !trackedByUrl.has(u));
    if (missing.length > 0) {
      const toInsert = missing.map((url) => ({
        url,
        lang: url.replace(SITE, "").match(/^\/([a-z]{2})\//)?.[1] ?? null,
        status: "discovered",
        ...classify(url),
      }));
      const ins = await gpld("/rest/v1/indexed_urls", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(toInsert),
      });
      if (ins.ok) newUrlsAdded = missing.length;
      else errors.push(`Ajout nouvelles URLs HTTP ${ins.status}`);
    }

    // 4b. Sorties du périmètre : le sitemap ne les déclare plus.
    //     C'est ce qui archive tout seul les variantes de langue orphelines et
    //     les profils désactivés dans qqwud — sans liste à maintenir ici.
    //
    //     Délai de grâce : une URL vue pour la première fois il y a moins de
    //     OUT_OF_SITEMAP_GRACE_DAYS n'est PAS archivée. Le sitemap est
    //     reconstruit à chaque requête à partir de plusieurs tables ; une URL
    //     fraîche qui en disparaît une journée est plus probablement le
    //     symptôme d'un repli de lecture que d'une dépublication.
    const graceCutoff = daysAgo(OUT_OF_SITEMAP_GRACE_DAYS);
    const gone = tracked
      .filter(
        (r) =>
          r.archived_at === null &&
          !sitemapUrls!.has(r.url) &&
          (r.first_seen_at === null || r.first_seen_at < graceCutoff),
      )
      .map((r) => r.id);
    if (gone.length > 0) {
      const n = await archiveByIds(gone, "hors_sitemap", now);
      if (n !== null) archived.hors_sitemap = n;
    }
  }

  // 4c. Acquises : indexées et stables → on ne les repousse plus.
  archived.indexed_stable =
    (await archivePatch(
      `status=eq.indexed&archived_at=is.null&indexed_at=lt.${daysAgo(INDEXED_STABLE_DAYS)}`,
      "indexed_stable",
      now,
    )) ?? 0;

  // 4d. Google a choisi une autre URL canonique : la pousser ne sert à rien.
  archived.canonical_autre =
    (await archivePatch("status=eq.canonical_other&archived_at=is.null", "canonical_autre", now)) ?? 0;

  // 4e. Hors périmètre d'indexation par nature.
  archived.noindex =
    (await archivePatch(
      "status=in.(noindex,blocked_robots,excluded)&archived_at=is.null",
      "noindex",
      now,
    )) ?? 0;

  // ── 5. File active, par priorité, hors refroidissement ────────────────────
  //
  //  `archived_at is null`        → jamais ce qui est acquis ou hors périmètre
  //  `last_submitted_at` ancien   → jamais deux fois en moins de COOLDOWN_DAYS
  //  `order=priority.asc`         → thérapeutes d'abord, statiques en dernier
  //  `last_submitted_at nullsfirst` → jamais poussée avant déjà poussée
  // Le timestamp est ENTRE GUILLEMETS : dans un `or=(…)`, le point sépare
  // colonne, opérateur et valeur — un ISO 8601 nu (`2026-08-28T05:00:00.000Z`)
  // ferait échouer l'analyse de PostgREST sur son propre point de milliseconde.
  const cooldown = daysAgo(COOLDOWN_DAYS);
  const scopeFilter = scope === "therapists" ? "&page_type=eq.therapist" : "";
  const queueResp = await gpld(
    `/rest/v1/indexed_urls?archived_at=is.null${scopeFilter}` +
      `&or=(last_submitted_at.is.null,last_submitted_at.lt."${cooldown}")` +
      `&select=id,url,page_type,status,priority,last_submitted_at` +
      `&order=priority.asc,last_submitted_at.asc.nullsfirst&limit=${BATCH}`,
  );
  const queue: UrlRow[] = queueResp.ok ? await queueResp.json() : [];
  if (!queueResp.ok) errors.push(`Lecture file HTTP ${queueResp.status}`);

  // Compteurs : `limit=1` suffit, seul l'en-tête content-range est lu.
  async function countOf(filter: string): Promise<number> {
    const r = await gpld(`/rest/v1/indexed_urls?${filter}&select=id&limit=1`, {
      headers: { Prefer: "count=exact" },
    });
    return parseInt((r.headers.get("content-range") ?? "").split("/")[1] ?? "0") || 0;
  }
  const activeTotal = await countOf(`archived_at=is.null${scopeFilter}`);
  const totalUrls = await countOf("id=not.is.null"); // filtre toujours vrai : compte la table entière

  // ── 5bis. Pré-contrôle d'indexabilité — la garde d'entrée ─────────────────
  //
  // La sélection ne regardait que l'état du SUIVI ; elle ne regardait jamais ce
  // que l'URL RÉPOND. Relevé du 08/09 sur les 280 URLs déjà poussées : 77
  // n'auraient pas dû l'être (14 en 404, 59 en noindex, 4 qui redirigent, 4 à
  // canonical divergente). Notifier IndexNow d'une URL morte ou noindex n'est
  // pas seulement inutile — c'est se signaler à Bing comme une source peu fiable.
  const rejected: Record<string, number> = {};
  let pushable: UrlRow[] = queue;
  if (queue.length > 0) {
    const checks = await preflightAll(queue.map((u) => u.url), 10);
    const byUrl = new Map(checks.map((c) => [c.url, c]));
    const keep: UrlRow[] = [];
    const toArchive: { id: string; reason: string }[] = [];

    for (const u of queue) {
      const c = byUrl.get(u.url);
      if (!c || c.indexable) {
        keep.push(u);
        continue;
      }
      rejected[c.archiveReason ?? "injoignable"] =
        (rejected[c.archiveReason ?? "injoignable"] ?? 0) + 1;
      // `archiveReason: null` = défaillance jugée passagère (réseau, 5xx) :
      // l'URL est écartée de CE run mais reste en file.
      if (c.archiveReason) toArchive.push({ id: u.id, reason: c.archiveReason });
    }

    for (const [reason, ids] of Object.entries(
      toArchive.reduce<Record<string, string[]>>((acc, t) => {
        (acc[t.reason] ??= []).push(t.id);
        return acc;
      }, {}),
    )) {
      const n = await archiveByIds(ids, reason, now);
      if (n !== null) archived[reason] = (archived[reason] ?? 0) + n;
    }
    pushable = keep;
  }

  // ── 6. IndexNow ───────────────────────────────────────────────────────────
  if (pushable.length > 0) {
    try {
      const inow = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": UA },
        body: JSON.stringify({
          host: "holiswiss.ch",
          key: INDEXNOW_KEY,
          keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
          urlList: pushable.map((u) => u.url),
        }),
      });
      indexNowStatus = inow.status;
      if (inow.status === 200 || inow.status === 202) {
        indexNowSubmitted = pushable.length;
        // Horodater : c'est CE champ qui empêche la resoumission en boucle.
        const ids = pushable.map((u) => u.id);
        const mark = await gpld(`/rest/v1/indexed_urls?id=in.(${ids.join(",")})`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ last_submitted_at: now, updated_at: now }),
        });
        if (!mark.ok) errors.push(`Horodatage soumission HTTP ${mark.status}`);
      } else {
        errors.push(`IndexNow HTTP ${inow.status}`);
      }
    } catch (e) {
      errors.push(`IndexNow: ${(e as Error).message}`);
    }
  }

  // ── 7. Rapport ────────────────────────────────────────────────────────────
  const byType = pushable.reduce<Record<string, number>>((acc, u) => {
    acc[u.page_type] = (acc[u.page_type] ?? 0) + 1;
    return acc;
  }, {});
  const archivedTotal = Object.values(archived).reduce((a, b) => a + b, 0);
  const archivedLine =
    archivedTotal > 0
      ? Object.entries(archived)
          .filter(([, n]) => n > 0)
          .map(([r, n]) => `${n} ${r}`)
          .join(" · ")
      : "aucune";

  const pushed = pushable.length
    ? pushable.slice(0, 10).map((u) => `- P${u.priority} ${u.url.replace(SITE, "")}`).join("\n") +
      (pushable.length > 10 ? `\n- … et ${pushable.length - 10} autres` : "")
    : "_Rien à pousser : tout est archivé ou en refroidissement._";

  const summaryMd = `## Run ${trigger} — ${now.substring(0, 16).replace("T", " ")}

### Actions
- IndexNow : ${indexNowSubmitted > 0 ? `${indexNowSubmitted} URLs poussées → HTTP ${indexNowStatus}` : "0 URL poussée"}
- Composition du lot : ${Object.entries(byType).map(([t, n]) => `${n} ${t}`).join(" · ") || "—"}
- Écartées au pré-contrôle : ${Object.keys(rejected).length > 0 ? Object.entries(rejected).map(([r, n]) => `${n} ${r}`).join(" · ") : "aucune"}
- Nouvelles URLs du sitemap : ${newUrlsAdded > 0 ? `+${newUrlsAdded}` : "0"}
- Archivées ce run : ${archivedLine}
- Inspection GSC : ${saJson ? `${inspected} URLs contrôlées · ${newlyIndexed} nouvellement indexées${unarchived > 0 ? ` · ${unarchived} désarchivée(s)` : ""}${deadlineHit > 0 ? ` · ⏱ ${deadlineHit} reportées (échéance de temps)` : ""}` : "désactivée (secret GSC_SERVICE_ACCOUNT_JSON absent)"}
${errors.length > 0 ? `- ⚠️ Erreurs : ${errors.join(", ")}` : ""}

### Lot poussé (par priorité — thérapeutes d'abord)
${pushed}

### État
${activeTotal} URLs actives (non archivées)${scope === "therapists" ? " sur le périmètre thérapeutes" : ""} · ${totalUrls} suivies au total.
Refroidissement : ${COOLDOWN_DAYS} j. Archivage : indexée > ${INDEXED_STABLE_DAYS} j, ou sortie du sitemap.`;

  let reportId: string | null = null;
  try {
    const rResp = await gpld("/rest/v1/indexing_reports", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        run_at: now,
        trigger,
        urls_total: totalUrls,
        urls_checked: inspected,
        newly_indexed: newlyIndexed,
        newly_discovered: newUrlsAdded,
        not_indexed: activeTotal,
        blocked: archivedTotal,
        errors: errors.length,
        quota_used: inspected,
        summary_md: summaryMd,
      }),
    });
    if (rResp.ok) {
      const d = await rResp.json();
      reportId = Array.isArray(d) ? d[0]?.id : d?.id;
    } else {
      errors.push(`Rapport HTTP ${rResp.status}`);
    }
  } catch (e) {
    errors.push(`Rapport: ${(e as Error).message}`);
  }

  // ── 8. Notification ───────────────────────────────────────────────────────
  //
  // Façade gardée d'abord (`request_admin_notification`, secret partagé), repli
  // e-mail Resend. Le statut HTTP est VÉRIFIÉ dans les deux cas : c'est son
  // absence de contrôle qui a laissé la notification muette huit jours en août.
  const notifParts = [
    `${indexNowSubmitted} URLs → IndexNow HTTP ${indexNowStatus}`,
    inspected > 0 ? `${inspected} inspectées, ${newlyIndexed} nouvellement indexées` : null,
    newUrlsAdded > 0 ? `+${newUrlsAdded} nouvelles` : null,
    archivedTotal > 0 ? `${archivedTotal} archivées` : null,
    `${activeTotal} actives`,
    errors.length > 0 ? `${errors.length} erreur(s)` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const subject = `Indexation (${trigger}) — ${indexNowSubmitted} URLs poussées, ${activeTotal} en file`;

  let notified = false;
  const notifySecret = await secret("agent_notify_secret");
  if (!notifySecret) {
    errors.push("agent_notify_secret absent de seo_admin_secrets");
  } else {
    try {
      const nResp = await fetch(`${QQWUD_URL}/rest/v1/rpc/request_admin_notification`, {
        method: "POST",
        headers: {
          apikey: QQWUD_ANON,
          Authorization: `Bearer ${QQWUD_ANON}`,
          "Content-Type": "application/json",
          "User-Agent": UA,
        },
        body: JSON.stringify({
          _secret: notifySecret,
          _kind: "indexing_report",
          _subject: subject,
          _summary: notifParts,
          _link: "https://www.holiswiss.ch/admin/indexation",
        }),
      });
      notified = nResp.ok;
      if (!nResp.ok) {
        errors.push(`Notification in-app HTTP ${nResp.status}`);
      }
    } catch (e) {
      errors.push(`Notification in-app: ${(e as Error).message}`);
    }
  }

  if (!notified) {
    try {
      const resendKey = await secret("resend_api_key");
      if (!resendKey) {
        errors.push("Repli e-mail impossible : resend_api_key absente");
      } else {
        const mResp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
            // Cloudflare rejette l'User-Agent par défaut (erreur 1010) — leçon du 11/07.
            "User-Agent": UA,
          },
          body: JSON.stringify({
            from: "Holiswiss Indexation <noreply@holiswiss.ch>",
            to: ["contact@holiswiss.ch"],
            subject,
            html:
              `<div style="font-family:system-ui,sans-serif;background:#1a0a2e;color:#fff;padding:24px;border-radius:12px">` +
              `<h2 style="color:#a855f7;margin-top:0">${subject}</h2>` +
              `<p style="color:rgba(255,255,255,.7)">${notifParts}</p>` +
              `<pre style="white-space:pre-wrap;color:rgba(255,255,255,.7);font-size:13px">${
                summaryMd.replace(/[<>]/g, "")
              }</pre>` +
              `<p><a href="https://www.holiswiss.ch/admin/indexation" style="color:#22d3ee">Ouvrir /admin/indexation</a></p>` +
              `</div>`,
          }),
        });
        if (!mResp.ok) errors.push(`Repli e-mail HTTP ${mResp.status}`);
      }
    } catch (e) {
      errors.push(`Repli e-mail: ${(e as Error).message}`);
    }
  }

  // Le compteur d'erreurs du rapport est figé avant la notification : on réaligne.
  if (reportId && errors.length > 0) {
    await gpld(`/rest/v1/indexing_reports?id=eq.${reportId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ errors: errors.length }),
    }).catch(() => {});
  }

  return json({
    submitted: indexNowSubmitted,
    indexNowStatus,
    inspected,
    newlyIndexed,
    unarchived,
    deadlineHit,
    rejected,
    selected: queue.length,
    newUrlsAdded,
    archived,
    activeTotal,
    notIndexedCount: activeTotal,
    queue: queue.map((u) => ({ url: u.url, priority: u.priority, page_type: u.page_type })),
    reportId,
    errors,
  });
});
