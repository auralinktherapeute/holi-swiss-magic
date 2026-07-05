import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  Globe, Check, Clock, AlertTriangle, RefreshCw, ExternalLink, FileText, Search,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/indexation")({ component: Page });

// Données hébergées sur le projet Supabase des agents (lecture publique, actions par PIN)
const AGENTS_SUPABASE_URL = "https://gpldaaqwvwopttachrma.supabase.co";
const AGENTS_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwbGRhYXF3dndvcHR0YWNocm1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5ODIyOTAsImV4cCI6MjA5NjU1ODI5MH0.BKuw_l2YrTZXTDHFlMcTC0yoH003_naKeoJXYs61fQg";

const HEADERS = {
  apikey: AGENTS_ANON_KEY,
  Authorization: `Bearer ${AGENTS_ANON_KEY}`,
  "Content-Type": "application/json",
};

type IndexedUrl = {
  id: string;
  url: string;
  lang: string | null;
  page_type: string;
  status: string;
  coverage_state: string | null;
  last_crawl_at: string | null;
  last_checked_at: string | null;
  priority: number;
  check_count: number;
};

type Report = {
  id: string;
  run_at: string;
  trigger: string;
  urls_total: number;
  urls_checked: number;
  newly_indexed: number;
  newly_discovered: number;
  not_indexed: number;
  blocked: number;
  errors: number;
  quota_used: number;
  summary_md: string | null;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  indexed: { label: "Indexée", cls: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
  discovered_not_crawled: { label: "Découverte (file Google)", cls: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  crawled_not_indexed: { label: "Crawlée, non indexée", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  submitted: { label: "Soumise (sitemap)", cls: "bg-amber-500/10 text-amber-300/80 border-amber-500/20" },
  discovered: { label: "À contrôler", cls: "bg-muted/40 text-muted-foreground border-transparent" },
  pending_check: { label: "Contrôle en cours", cls: "bg-muted/40 text-muted-foreground border-transparent" },
  blocked_robots: { label: "Bloquée robots.txt", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  noindex: { label: "Noindex", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  canonical_other: { label: "Canonical ailleurs", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  error: { label: "Erreur", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  excluded: { label: "Exclue", cls: "bg-muted/40 text-muted-foreground border-transparent" },
};

const PAGE_TYPE_LABELS: Record<string, string> = {
  home: "Accueil", therapist: "Thérapeute", article: "Article", specialty: "Spécialité",
  static: "Statique", listing: "Listing", event: "Événements",
};

const PROBLEM_STATUSES = ["crawled_not_indexed", "blocked_robots", "noindex", "canonical_other", "error"];

function askPin(): string | null {
  const cached = sessionStorage.getItem("seo_validation_pin");
  if (cached) return cached;
  const pin = prompt("Code PIN de validation (4 chiffres) :");
  if (pin) sessionStorage.setItem("seo_validation_pin", pin);
  return pin;
}

function Page() {
  const [urls, setUrls] = useState<IndexedUrl[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "indexed" | "waiting" | "problems" | "reports">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        fetch(`${AGENTS_SUPABASE_URL}/rest/v1/indexed_urls?select=id,url,lang,page_type,status,coverage_state,last_crawl_at,last_checked_at,priority,check_count&order=priority.asc,url.asc&limit=1000`, { headers: HEADERS }),
        fetch(`${AGENTS_SUPABASE_URL}/rest/v1/indexing_reports?select=*&order=run_at.desc&limit=20`, { headers: HEADERS }),
      ]);
      if (!u.ok || !r.ok) throw new Error(`HTTP ${u.status}/${r.status}`);
      setUrls((await u.json()) as IndexedUrl[]);
      setReports((await r.json()) as Report[]);
    } catch (e) {
      toast.error(`Chargement impossible : ${e instanceof Error ? e.message : "erreur"}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const recheck = async (urlId: string) => {
    const pin = askPin();
    if (!pin) return;
    try {
      const r = await fetch(`${AGENTS_SUPABASE_URL}/rest/v1/rpc/request_url_recheck`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ p_url_id: urlId, p_pin: pin }),
      });
      const ok = (await r.json()) as boolean;
      if (!r.ok || !ok) {
        sessionStorage.removeItem("seo_validation_pin");
        toast.error("PIN invalide");
        return;
      }
      toast.success("Recontrôle planifié — traité au prochain run (lundi 9h ou en session)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur réseau");
    }
  };

  const counts = {
    total: urls.length,
    indexed: urls.filter((u) => u.status === "indexed").length,
    waiting: urls.filter((u) => ["discovered_not_crawled", "submitted", "discovered", "pending_check"].includes(u.status)).length,
    problems: urls.filter((u) => PROBLEM_STATUSES.includes(u.status)).length,
    unchecked: urls.filter((u) => !u.last_checked_at).length,
  };
  const pct = counts.total ? Math.round((counts.indexed / counts.total) * 100) : 0;

  const visible = urls.filter((u) => {
    if (typeFilter !== "all" && u.page_type !== typeFilter) return false;
    if (tab === "indexed") return u.status === "indexed";
    if (tab === "waiting") return ["discovered_not_crawled", "submitted", "discovered", "pending_check"].includes(u.status);
    if (tab === "problems") return PROBLEM_STATUSES.includes(u.status);
    return true;
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6 text-cyan-300" /> Indexation Google
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suivi de l'indexation réelle des pages (URL Inspection API). L'indexation reste une décision
            de Google — ce tableau mesure, il ne force pas.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {[
            { v: counts.total, label: "Suivies", icon: Search, tone: "text-foreground" },
            { v: counts.indexed, label: "Indexées", icon: Check, tone: "text-cyan-300" },
            { v: counts.waiting, label: "En attente", icon: Clock, tone: "text-amber-400" },
            { v: counts.problems, label: "Problèmes", icon: AlertTriangle, tone: "text-red-400" },
          ].map(({ v, label, icon: Icon, tone }) => (
            <div key={label} className="rounded-lg border bg-card px-4 py-2 text-center min-w-20">
              <div className={`text-xl font-bold ${tone}`}>{v}</div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1 justify-center">
                <Icon className="h-3 w-3" /> {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{counts.indexed} / {counts.total} pages indexées</span>
          <span>{pct} %{counts.unchecked > 0 ? ` · ${counts.unchecked} pas encore contrôlées` : ""}</span>
        </div>
        <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
        </div>
      </div>

      <div className="flex items-center gap-2 border-b overflow-x-auto">
        {([
          { k: "all", label: `Toutes (${counts.total})` },
          { k: "indexed", label: `Indexées (${counts.indexed})` },
          { k: "waiting", label: `En attente (${counts.waiting})` },
          { k: "problems", label: `Problèmes (${counts.problems})` },
          { k: "reports", label: `Comptes rendus (${reports.length})` },
        ] as const).map(({ k, label }) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap ${
              tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
        {tab !== "reports" && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="ml-auto rounded-md border bg-background px-2 py-1 text-xs"
          >
            <option value="all">Tous types</option>
            {Object.entries(PAGE_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : tab === "reports" ? (
        <div className="space-y-3">
          {reports.length === 0 && <p className="text-sm text-muted-foreground">Aucun compte rendu.</p>}
          {reports.map((r) => (
            <div key={r.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                {new Date(r.run_at).toLocaleString("fr-CH")} · {r.trigger} · {r.urls_checked} contrôlées · quota {r.quota_used}/2000
              </div>
              <div className="flex gap-3 flex-wrap text-xs mb-2">
                <span className="text-cyan-300">+{r.newly_indexed} indexées</span>
                <span className="text-violet-300">{r.newly_discovered} découvertes</span>
                <span className="text-amber-400">{r.not_indexed} non indexées</span>
                {r.blocked > 0 && <span className="text-red-400">{r.blocked} bloquées ⚠️</span>}
                {r.errors > 0 && <span className="text-red-400">{r.errors} erreurs</span>}
              </div>
              {r.summary_md && <p className="text-sm leading-relaxed whitespace-pre-line">{r.summary_md}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border bg-card divide-y divide-border/50">
          {visible.length === 0 && <p className="p-4 text-sm text-muted-foreground">Aucune URL dans cette catégorie.</p>}
          {visible.map((u) => {
            const meta = STATUS_META[u.status] ?? STATUS_META.discovered;
            const path = u.url.replace("https://holiswiss.ch", "") || "/";
            return (
              <div key={u.id} className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
                <span className="rounded-full border bg-muted/30 text-muted-foreground px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide w-20 text-center shrink-0">
                  {PAGE_TYPE_LABELS[u.page_type] ?? u.page_type}
                </span>
                <a href={u.url} target="_blank" rel="noreferrer" className="text-sm font-mono truncate flex-1 min-w-40 hover:text-cyan-300 transition" title={u.url}>
                  {path}
                </a>
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold shrink-0 ${meta.cls}`}>
                  {meta.label}
                </span>
                <span className="text-[11px] text-muted-foreground w-32 shrink-0">
                  {u.last_crawl_at
                    ? `Crawl ${new Date(u.last_crawl_at).toLocaleDateString("fr-CH")}`
                    : u.last_checked_at
                    ? `Vérifiée ${new Date(u.last_checked_at).toLocaleDateString("fr-CH")}`
                    : "Jamais contrôlée"}
                </span>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => recheck(u.id)}
                    title="Planifier un recontrôle"
                    className="rounded-md border p-1.5 text-muted-foreground hover:text-foreground transition"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                  <a
                    href={`https://search.google.com/search-console/inspect?resource_id=sc-domain:holiswiss.ch&id=${encodeURIComponent(u.url)}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Inspecter dans GSC"
                    className="rounded-md border p-1.5 text-muted-foreground hover:text-foreground transition"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground border-t pt-3">
        Contrôles via l'URL Inspection API (quota 2 000/jour — usage réel &lt; 150/run). Les nouveaux articles
        et thérapeutes sont détectés et mis en file automatiquement par l'audit du lundi 9h. « Découverte » =
        Google connaît la page et la crawlera ; l'indexation effective reste sa décision.
      </p>
    </div>
  );
}
