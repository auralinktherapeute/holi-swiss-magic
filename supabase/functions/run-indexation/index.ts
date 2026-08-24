/**
 * Edge Function : run-indexation
 * Projet : gpldaaqwvwopttachrma
 * Déploiement : supabase functions deploy run-indexation --project-ref gpldaaqwvwopttachrma
 *
 * Exécute le cycle d'indexation complet depuis le dashboard admin :
 *   1. Validation PIN (seo_admin_secrets)
 *   2. Récupération des URLs non indexées (thérapeutes en priorité)
 *   3. Ping IndexNow (Bing/IA — ChatGPT s'appuie sur l'index Bing)
 *   4. Comparaison sitemap → ajout des nouvelles URLs au suivi
 *   5. Insertion d'un rapport dans indexing_reports
 *   6. Notification admin : RPC qqwud, avec repli e-mail Resend
 *
 * Auth : PIN 4 chiffres dans le body (même PIN que les autres actions admin gpld).
 * GSC URL Inspection : non disponible depuis le dashboard (nécessite un compte de service
 *   Google — à ajouter via le secret GSC_SERVICE_ACCOUNT_JSON).
 *
 * Appelée aussi par pg_cron (job `holiswiss-indexation-daily`, voir cron.job) : c'est
 * ce qui garantit un cycle quotidien même Mac éteint. La tâche Claude locale ne tournant
 * que si l'app est ouverte, elle n'avait produit que 12 runs en 50 jours (trou de 15
 * jours du 09/08 au 24/08) — d'où ce doublon serveur, qui porte `trigger: 'cron'`.
 *
 * ⚠️ `create_admin_notification` (qqwud) n'est PLUS appelable avec la clé anon depuis la
 * migration de durcissement 20260816215809 (EXECUTE révoqué à anon — délibéré : la
 * fonction écrit et déclenche un http_post sortant sans garde). L'échec était jusqu'ici
 * SILENCIEUX car la réponse n'était pas vérifiée. On vérifie désormais, et on retombe
 * sur un e-mail Resend direct. Rétablissement du canal in-app : appliquer via Lovable la
 * migration `20260824_request_admin_notification.sql` (RPC gardée par secret partagé).
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const INDEXNOW_KEY = "41c3cce6c762af43d78a7895dfc0afe3";
const SITE = "https://holiswiss.ch";
// Clé anon qqwud — publique par nature (dans le repo GitHub public)
const QQWUD_URL = "https://qqwudmnfavvaukuldulr.supabase.co";
const QQWUD_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxd3VkbW5mYXZ2YXVrdWxkdWxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5OTg2MjUsImV4cCI6MjA5NjU3NDYyNX0.P-8PAwboYoul28Iqx_UMGH0c9_NPwBTsJPCkRMXKEpY";

type IndexedUrlRow = { id: string; url: string; page_type: string; status: string };

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Parse body
  let body: { scope?: string; pin?: string; trigger?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { scope = "therapists", pin, trigger: rawTrigger = "manual" } = body;
  // La contrainte indexing_reports_trigger_check n'accepte que ces valeurs.
  const ALLOWED_TRIGGERS = ["manual", "cron", "daily", "weekly", "initial"];
  const trigger = ALLOWED_TRIGGERS.includes(rawTrigger) ? rawTrigger : "manual";

  // 1. Validate PIN
  const pinResp = await gpld("/rest/v1/seo_admin_secrets?k=eq.validation_pin&select=v");
  if (!pinResp.ok) return json({ error: "Impossible de vérifier le PIN" }, 500);
  const pinRows: { v: string }[] = await pinResp.json();
  if (!pinRows?.[0]?.v || pinRows[0].v !== String(pin)) {
    return json({ error: "PIN invalide" }, 401);
  }

  const now = new Date().toISOString();
  const errors: string[] = [];
  let indexNowSubmitted = 0;
  let indexNowStatus = 0;
  let newUrlsAdded = 0;

  // 2. Total URLs suivies
  const totalResp = await gpld("/rest/v1/indexed_urls?select=id", {
    headers: { Prefer: "count=exact" },
  });
  const contentRange = totalResp.headers.get("content-range") ?? "";
  const totalUrls = parseInt(contentRange.split("/")[1] ?? "0") || 0;

  // 3. URLs non indexées selon le scope (max 40)
  const filter =
    scope === "therapists"
      ? "page_type=eq.therapist&status=neq.indexed"
      : "status=neq.indexed";
  const urlsResp = await gpld(
    `/rest/v1/indexed_urls?${filter}&select=id,url,page_type,status&order=priority.asc&limit=40`,
  );
  const urlRows: IndexedUrlRow[] = urlsResp.ok ? await urlsResp.json() : [];

  const therapistUrls = urlRows
    .filter((u) => u.page_type === "therapist")
    .map((u) => u.url);
  const notIndexedCount = therapistUrls.length;

  // 4. Ping IndexNow pour les thérapeutes non indexés
  if (therapistUrls.length > 0) {
    try {
      const inow = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "holiswiss-indexation-agent/2.0",
        },
        body: JSON.stringify({
          host: "holiswiss.ch",
          key: INDEXNOW_KEY,
          keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
          urlList: therapistUrls,
        }),
      });
      indexNowStatus = inow.status;
      if (inow.status === 200 || inow.status === 202) {
        indexNowSubmitted = therapistUrls.length;
      } else {
        errors.push(`IndexNow HTTP ${inow.status}`);
      }
    } catch (e) {
      errors.push(`IndexNow: ${(e as Error).message}`);
    }
  }

  // 5. Comparaison sitemap → nouvelles URLs
  try {
    const sitemapResp = await fetch(`${SITE}/sitemap.xml`, {
      headers: { "User-Agent": "holiswiss-indexation-agent/2.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (sitemapResp.ok) {
      const xml = await sitemapResp.text();
      const sitemapUrls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);

      const trackedResp = await gpld("/rest/v1/indexed_urls?select=url");
      const tracked: { url: string }[] = trackedResp.ok ? await trackedResp.json() : [];
      const trackedSet = new Set(tracked.map((r) => r.url));

      const missing = sitemapUrls.filter((u) => u.startsWith(SITE) && !trackedSet.has(u));
      if (missing.length > 0) {
        const toInsert = missing.map((url) => {
          const isTherapist = url.includes("/therapeute/");
          const isArticle = url.includes("/blog/") || url.includes("/article/");
          const isSpecialty = url.includes("/specialites/");
          const isListing =
            /\/therapeutes\/?$/.test(url) || /\/therapeutes\/[^/]+\/?$/.test(url);
          const lang = url.match(/\/([a-z]{2})\//)?.[1] ?? null;
          const page_type = isTherapist
            ? "therapist"
            : isArticle
              ? "article"
              : isSpecialty
                ? "specialty"
                : isListing
                  ? "listing"
                  : "static";
          const priority = isTherapist ? 1 : isArticle ? 2 : isSpecialty ? 3 : 4;
          return { url, lang, page_type, status: "discovered", priority };
        });
        const ins = await gpld("/rest/v1/indexed_urls", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(toInsert),
        });
        if (ins.ok) {
          newUrlsAdded = missing.length;
        } else {
          errors.push(`Ajout nouvelles URLs HTTP ${ins.status}`);
        }
      }
    } else {
      errors.push(`Sitemap HTTP ${sitemapResp.status}`);
    }
  } catch (e) {
    errors.push(`Sitemap: ${(e as Error).message}`);
  }

  // 6. Rapport Markdown
  const therapistList = therapistUrls
    .slice(0, 10)
    .map((u) => `- ${u.replace(SITE, "")}`)
    .join("\n");
  const moreTherapists =
    therapistUrls.length > 10 ? `\n- … et ${therapistUrls.length - 10} autres` : "";

  const summaryMd = `## Run dashboard — ${now.substring(0, 16).replace("T", " ")}

### Actions
- IndexNow : ${indexNowSubmitted > 0 ? `${indexNowSubmitted} URLs thérapeutes pingées → HTTP ${indexNowStatus}` : "0 URL pingée (aucune thérapeute non indexée dans ce scope)"}
- Nouvelles URLs sitemap : ${newUrlsAdded > 0 ? `+${newUrlsAdded} ajoutées au suivi` : "0 nouvelle"}
- Inspection GSC : non disponible depuis le dashboard (nécessite GSC_SERVICE_ACCOUNT_JSON)
${errors.length > 0 ? `- Erreurs : ${errors.join(", ")}` : ""}

### Thérapeutes non indexées (${notIndexedCount})
${therapistList}${moreTherapists}

### État total
${totalUrls + newUrlsAdded} URLs suivies.`;

  // 7. Insertion rapport
  let reportId: string | null = null;
  try {
    const rResp = await gpld("/rest/v1/indexing_reports", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        run_at: now,
        trigger,
        urls_total: totalUrls + newUrlsAdded,
        urls_checked: 0,
        newly_indexed: 0,
        newly_discovered: newUrlsAdded,
        not_indexed: notIndexedCount,
        blocked: 0,
        errors: errors.length,
        quota_used: 0,
        summary_md: summaryMd,
      }),
    });
    if (rResp.ok) {
      const rData = await rResp.json();
      reportId = Array.isArray(rData) ? rData[0]?.id : rData?.id;
    } else {
      errors.push(`Rapport HTTP ${rResp.status}`);
    }
  } catch (e) {
    errors.push(`Rapport: ${(e as Error).message}`);
  }

  // 8. Notification admin — in-app d'abord, e-mail Resend en repli.
  //    Le statut HTTP est VÉRIFIÉ : c'est son absence de contrôle qui a laissé la
  //    notification muette pendant huit jours après le durcissement du 16/08.
  const notifParts = [
    `IndexNow: ${indexNowSubmitted} URLs → HTTP ${indexNowStatus}`,
    newUrlsAdded > 0 ? `+${newUrlsAdded} nouvelles URLs` : null,
    errors.length > 0 ? `${errors.length} erreur(s)` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const subject = `Indexation (${trigger}) — ${indexNowSubmitted} thérapeutes → IndexNow`;

  let notified = false;
  try {
    const nResp = await fetch(`${QQWUD_URL}/rest/v1/rpc/create_admin_notification`, {
      method: "POST",
      headers: {
        apikey: QQWUD_ANON,
        Authorization: `Bearer ${QQWUD_ANON}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        _kind: "indexing_report",
        _subject: subject,
        _summary: notifParts,
        _link: "https://www.holiswiss.ch/admin/indexation",
      }),
    });
    notified = nResp.ok;
    if (!nResp.ok) {
      errors.push(`Notification in-app HTTP ${nResp.status} (EXECUTE anon révoqué le 16/08)`);
    }
  } catch (e) {
    errors.push(`Notification in-app: ${(e as Error).message}`);
  }

  // Repli : e-mail direct via Resend (clé dans seo_admin_secrets, RLS deny-all).
  if (!notified) {
    try {
      const kResp = await gpld("/rest/v1/seo_admin_secrets?k=eq.resend_api_key&select=v");
      const kRows: { v: string }[] = kResp.ok ? await kResp.json() : [];
      const resendKey = kRows?.[0]?.v;
      if (!resendKey) {
        errors.push("Repli e-mail impossible : resend_api_key absente de seo_admin_secrets");
      } else {
        const mResp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
            // Cloudflare rejette l'User-Agent par défaut (erreur 1010) — leçon du 11/07.
            "User-Agent": "holiswiss-indexation-agent/2.0",
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

  // Le compteur d'erreurs du rapport est figé avant ces étapes : on le réaligne.
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
    newUrlsAdded,
    notIndexedCount,
    reportId,
    errors,
  });
});
