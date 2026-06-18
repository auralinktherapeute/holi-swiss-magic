import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SITE = "https://holiswiss.ch";

const TARGET_URLS: { url: string; label: string; type: "page" | "listing" | "article" | "profile" }[] = [
  { url: `${SITE}/fr`,                                       label: "Accueil",          type: "page" },
  { url: `${SITE}/fr/therapeutes`,                           label: "Liste thérapeutes", type: "listing" },
  { url: `${SITE}/fr/blog`,                                  label: "Blog",             type: "listing" },
  { url: `${SITE}/fr/evenements`,                            label: "Événements",       type: "listing" },
  { url: `${SITE}/fr/tarifs`,                                label: "Tarifs",           type: "page" },
  { url: `${SITE}/fr/contact`,                               label: "Contact",          type: "page" },
  { url: `${SITE}/fr/blog/qu-est-ce-que-la-sophrologie`,     label: "Article blog",     type: "article" },
];

export type AuditIssue = {
  code: string;
  url: string;
  label: string;
  severity: "critical" | "warning" | "good";
  priority: "P1" | "P2" | "P3";
  category: "seo_onpage" | "seo_technical" | "geo" | "multilang";
  title: string;
  description: string;
  action: string;
};

export type AuditResult = {
  seo_score: number;
  geo_score: number;
  global_score: number;
  issues: AuditIssue[];
  critical_count: number;
  resolved_count: number;
  audited_urls: number;
  audit_date: string; // yyyy-mm-dd
};

function clamp(n: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, n)); }

async function fetchPage(url: string): Promise<{ status: number; html: string }> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "HoliSwiss-SEO-Audit-Agent/1.0" },
      signal: AbortSignal.timeout(12_000),
    });
    const html = await res.text();
    return { status: res.status, html };
  } catch {
    return { status: 0, html: "" };
  }
}

function analyse(html: string) {
  const has = (re: RegExp) => re.test(html);
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
  const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? "";
  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
  return {
    title,
    titleLen: title.length,
    metaDesc,
    metaLen: metaDesc.length,
    h1Count,
    hasCanonical: has(/<link[^>]+rel=["']canonical["']/i),
    hasOg:        has(/<meta[^>]+property=["']og:title["']/i),
    hasHreflang:  has(/<link[^>]+rel=["']alternate["'][^>]+hreflang=/i),
    hasJsonLd:    has(/<script[^>]+type=["']application\/ld\+json["']/i),
    hasFaq:       has(/"@type"\s*:\s*"FAQPage"/i),
    hasArticle:   has(/"@type"\s*:\s*"(Article|BlogPosting|NewsArticle)"/i),
    hasH2:        has(/<h2[\s>]/i),
  };
}

export async function runSeoAudit(): Promise<AuditResult> {
  const issues: AuditIssue[] = [];
  let seoSum = 0;
  let geoSum = 0;
  let counted = 0;

  for (const t of TARGET_URLS) {
    const { status, html } = await fetchPage(t.url);
    if (status === 0 || status >= 500) {
      issues.push({
        code: `unreachable:${t.url}`, url: t.url, label: t.label,
        severity: "critical", priority: "P1", category: "seo_technical",
        title: `Page injoignable — ${t.label}`,
        description: `La page ${t.url} a retourné un statut ${status || "réseau"}.`,
        action: "Vérifier l'hébergement, les redirections et le statut HTTP de cette URL.",
      });
      continue;
    }
    if (status === 404) {
      issues.push({
        code: `404:${t.url}`, url: t.url, label: t.label,
        severity: "critical", priority: "P1", category: "seo_technical",
        title: `Erreur 404 — ${t.label}`,
        description: `La page ${t.url} renvoie une erreur 404.`,
        action: "Restaurer la page ou mettre en place une redirection 301 vers l'URL équivalente.",
      });
      continue;
    }

    const a = analyse(html);
    let seo = 100;
    let geo = 100;

    if (!a.title)                       { seo -= 25; issues.push(mk(t, "no-title", "critical", "P1", "seo_onpage", "Titre <title> manquant", "Aucun titre de page détecté.", "Ajouter une balise <title> unique de 30 à 60 caractères.")); }
    else if (a.titleLen < 25 || a.titleLen > 65) {
      seo -= 8; issues.push(mk(t, "title-length", "warning", "P2", "seo_onpage", "Longueur du titre non optimale", `Le titre fait ${a.titleLen} caractères.`, "Viser 30 à 60 caractères, mot-clé principal en premier."));
    }
    if (!a.metaDesc)                    { seo -= 15; issues.push(mk(t, "no-meta-desc", "critical", "P1", "seo_onpage", "Meta description manquante", "Aucune meta description trouvée.", "Ajouter une meta description unique de 120 à 160 caractères.")); }
    else if (a.metaLen < 80 || a.metaLen > 170) {
      seo -= 5; issues.push(mk(t, "meta-length", "warning", "P3", "seo_onpage", "Longueur de meta description non optimale", `La meta fait ${a.metaLen} caractères.`, "Viser 120 à 160 caractères avec un appel à l'action."));
    }
    if (a.h1Count === 0)                { seo -= 12; issues.push(mk(t, "no-h1", "warning", "P2", "seo_onpage", "Balise H1 manquante", "Aucun H1 détecté sur la page.", "Ajouter un seul H1 décrivant clairement le contenu.")); }
    else if (a.h1Count > 1)             { seo -= 6;  issues.push(mk(t, "multi-h1", "warning", "P3", "seo_onpage", "Plusieurs H1 détectés", `${a.h1Count} balises H1 sur la page.`, "N'en garder qu'un seul par page.")); }
    if (!a.hasCanonical)                { seo -= 8;  issues.push(mk(t, "no-canonical", "warning", "P2", "seo_technical", "URL canonique absente", "Aucun rel=canonical détecté.", "Ajouter <link rel=\"canonical\"> dans le <head>.")); }
    if (!a.hasOg)                       { seo -= 5;  issues.push(mk(t, "no-og", "warning", "P3", "seo_onpage", "Open Graph manquant", "Aucune balise og:title détectée.", "Ajouter og:title, og:description, og:image.")); }
    if (!a.hasHreflang)                 { seo -= 8;  issues.push(mk(t, "no-hreflang", "warning", "P2", "multilang", "Balises hreflang manquantes", "Aucun lien alternate hreflang détecté.", "Déclarer hreflang FR/DE/EN/IT pour chaque page.")); }

    // GEO checks
    if (!a.hasJsonLd)                   { geo -= 25; issues.push(mk(t, "no-jsonld", "critical", "P1", "geo", "Données structurées JSON-LD absentes", "Les IA exploitent JSON-LD pour comprendre le contenu.", "Ajouter un script JSON-LD adapté (LocalBusiness, Article, FAQPage…).")); }
    if (t.type === "article" && !a.hasArticle) { geo -= 15; issues.push(mk(t, "no-article-schema", "warning", "P2", "geo", "Schéma Article manquant", "L'article ne déclare pas de schéma Article/BlogPosting.", "Ajouter un JSON-LD de type BlogPosting avec auteur, date, image.")); }
    if (t.type === "listing" && !a.hasFaq)     { geo -= 8;  issues.push(mk(t, "no-faq", "warning", "P3", "geo", "FAQ structurée manquante", "Une FAQ structurée améliore la citation par les IA.", "Ajouter un bloc FAQ + JSON-LD FAQPage en bas de page.")); }
    if (!a.hasH2)                       { geo -= 6;  issues.push(mk(t, "no-h2", "warning", "P3", "geo", "Sous-titres H2 absents", "Une structure claire H2/H3 facilite l'extraction par les IA.", "Découper le contenu avec des H2/H3 thématiques.")); }
    if (html.length < 1500)             { geo -= 10; issues.push(mk(t, "thin-content", "warning", "P2", "geo", "Contenu trop court", `Page de seulement ${html.length} caractères HTML.`, "Étoffer le contenu avec définitions, exemples, FAQ.")); }

    seoSum += clamp(seo);
    geoSum += clamp(geo);
    counted++;
  }

  const seo_score = counted ? Math.round(seoSum / counted) : 0;
  const geo_score = counted ? Math.round(geoSum / counted) : 0;
  const global_score = Math.round(seo_score * 0.55 + geo_score * 0.45);

  const critical_count = issues.filter((i) => i.severity === "critical").length;

  // Resolved findings count (from seo_findings table — manual fixes)
  const { count: resolved_count } = await supabaseAdmin
    .from("seo_findings")
    .select("*", { count: "exact", head: true })
    .eq("status", "resolved");

  const today = new Date().toISOString().slice(0, 10);
  const result: AuditResult = {
    seo_score, geo_score, global_score,
    issues, critical_count, resolved_count: resolved_count ?? 0,
    audited_urls: counted, audit_date: today,
  };

  // Persist (upsert today's row)
  await supabaseAdmin
    .from("seo_audit_history")
    .upsert({
      audit_date: today,
      seo_score, geo_score, global_score,
      critical_count, resolved_count: result.resolved_count,
      summary: { issues, audited_urls: counted, ran_at: new Date().toISOString() },
    }, { onConflict: "audit_date" });

  return result;
}

function mk(
  t: { url: string; label: string },
  code: string,
  severity: AuditIssue["severity"],
  priority: AuditIssue["priority"],
  category: AuditIssue["category"],
  title: string, description: string, action: string,
): AuditIssue {
  return { code: `${code}:${t.url}`, url: t.url, label: t.label, severity, priority, category, title, description, action };
}

export async function notifyCriticalIssues(prevCriticalCodes: Set<string>, issues: AuditIssue[]) {
  const newCriticals = issues.filter((i) => i.severity === "critical" && !prevCriticalCodes.has(i.code));
  if (newCriticals.length === 0) return;
  // Use the SQL function that posts to admin-notify
  try {
    await supabaseAdmin.rpc("notify_admin_event", {
      _kind: "seo_critical",
      _subject: `Audit SEO : ${newCriticals.length} point(s) critique(s) détecté(s)`,
      _summary: newCriticals.slice(0, 5).map((i) => `• ${i.title} (${i.label})`).join("\n"),
      _link: "/admin/seo",
    });
  } catch (e) {
    console.error("[seo-audit] notify failed", e);
  }
}

export async function getPreviousCriticalCodes(): Promise<Set<string>> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const { data } = await supabaseAdmin
    .from("seo_audit_history")
    .select("summary")
    .lt("audit_date", new Date().toISOString().slice(0, 10))
    .order("audit_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const set = new Set<string>();
  const issues = (data?.summary as { issues?: AuditIssue[] } | null)?.issues ?? [];
  for (const i of issues) if (i.severity === "critical") set.add(i.code);
  return set;
}