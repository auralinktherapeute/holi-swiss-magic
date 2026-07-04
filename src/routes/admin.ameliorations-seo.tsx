import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Sparkles, Check, X, Clock, Rocket, ExternalLink, TrendingUp, ShieldCheck, MessageCircle, Send,
} from "lucide-react";
import { toast } from "sonner";
import { getWhatsappTarget, setWhatsappTarget, sendTestNotification } from "@/lib/seo-notifications.functions";

export const Route = createFileRoute("/admin/ameliorations-seo")({ component: Page });

// File de validation hébergée sur le projet Supabase des agents (lecture publique, écriture par PIN)
const AGENTS_SUPABASE_URL = "https://gpldaaqwvwopttachrma.supabase.co";
const AGENTS_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwbGRhYXF3dndvcHR0YWNocm1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5ODIyOTAsImV4cCI6MjA5NjU1ODI5MH0.BKuw_l2YrTZXTDHFlMcTC0yoH003_naKeoJXYs61fQg";

const HEADERS = {
  apikey: AGENTS_ANON_KEY,
  Authorization: `Bearer ${AGENTS_ANON_KEY}`,
  "Content-Type": "application/json",
};

type Improvement = {
  id: string;
  created_at: string;
  week: number | null;
  type: "quick-win" | "chantier" | "infra" | "contenu";
  category: "seo" | "geo" | "technique" | "contenu" | null;
  title: string;
  description: string;
  page_url: string | null;
  before_snippet: string | null;
  after_snippet: string | null;
  impact: string | null;
  status: "pending" | "approved" | "rejected" | "applied";
  applied_at: string | null;
  verified_at: string | null;
  commit_sha: string | null;
};

const TYPE_LABELS: Record<Improvement["type"], string> = {
  "quick-win": "Quick win",
  chantier: "Chantier",
  infra: "Infra",
  contenu: "Contenu",
};

const STATUS_META: Record<Improvement["status"], { label: string; cls: string }> = {
  pending: { label: "En attente de validation", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  approved: { label: "Approuvé — à appliquer", cls: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  applied: { label: "Appliqué & vérifié", cls: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
  rejected: { label: "Refusé", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
};

function askPin(): string | null {
  const cached = sessionStorage.getItem("seo_validation_pin");
  if (cached) return cached;
  const pin = prompt("Code PIN de validation (4 chiffres) :");
  if (pin) sessionStorage.setItem("seo_validation_pin", pin);
  return pin;
}

function Page() {
  const [tab, setTab] = useState<"pending" | "approved" | "applied" | "rejected">("pending");
  const [rows, setRows] = useState<Improvement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `${AGENTS_SUPABASE_URL}/rest/v1/seo_improvements?select=*&order=created_at.desc`,
        { headers: HEADERS },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setRows((await r.json()) as Improvement[]);
    } catch (e) {
      toast.error(`Chargement impossible : ${e instanceof Error ? e.message : "erreur"}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, status: "approved" | "rejected" | "pending") => {
    const pin = askPin();
    if (!pin) return;
    try {
      const r = await fetch(`${AGENTS_SUPABASE_URL}/rest/v1/rpc/set_seo_improvement_status`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ p_id: id, p_status: status, p_pin: pin }),
      });
      const ok = (await r.json()) as boolean;
      if (!r.ok || !ok) {
        sessionStorage.removeItem("seo_validation_pin");
        toast.error("PIN invalide ou mise à jour refusée");
        return;
      }
      toast.success(status === "approved" ? "Amélioration approuvée — Claude l'appliquera" : "Statut mis à jour");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur réseau");
    }
  };

  const counts = rows.reduce(
    (acc, r) => ((acc[r.status] += 1), acc),
    { pending: 0, approved: 0, applied: 0, rejected: 0 } as Record<Improvement["status"], number>,
  );
  const visible = rows.filter((r) => r.status === tab);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-violet-400" /> Amélioration SEO/GEO via Claude
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Chaque changement proposé ou appliqué par Claude est listé ici avec son avant/après.
            Rien n'est mis en ligne sans ton approbation.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {(
            [
              { k: "pending", label: "En attente", icon: Clock, tone: "text-amber-400" },
              { k: "approved", label: "Approuvés", icon: Check, tone: "text-violet-300" },
              { k: "applied", label: "Appliqués", icon: Rocket, tone: "text-cyan-300" },
            ] as const
          ).map(({ k, label, icon: Icon, tone }) => (
            <div key={k} className="rounded-lg border bg-card px-4 py-2 text-center min-w-20">
              <div className={`text-xl font-bold ${tone}`}>{counts[k]}</div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1 justify-center">
                <Icon className="h-3 w-3" /> {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 border-b overflow-x-auto">
        {(
          [
            { k: "pending", label: `En attente (${counts.pending})`, icon: Clock },
            { k: "approved", label: `Approuvés (${counts.approved})`, icon: Check },
            { k: "applied", label: `Appliqués (${counts.applied})`, icon: Rocket },
            { k: "rejected", label: `Refusés (${counts.rejected})`, icon: X },
          ] as const
        ).map(({ k, label, icon: Icon }) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap ${
              tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune amélioration dans cette catégorie.</p>
      ) : (
        <div className="space-y-4">
          {visible.map((r) => (
            <div key={r.id} className="rounded-lg border bg-card p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                    {TYPE_LABELS[r.type]}
                  </span>
                  {r.category ? (
                    <span className="rounded-full border bg-muted/40 text-muted-foreground px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide">
                      {r.category}
                    </span>
                  ) : null}
                  {r.week ? (
                    <span className="text-[11px] text-muted-foreground">Audit S{r.week}</span>
                  ) : null}
                </div>
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_META[r.status].cls}`}>
                  {STATUS_META[r.status].label}
                </span>
              </div>

              <h2 className="font-semibold text-base mb-1">{r.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">{r.description}</p>

              {(r.before_snippet || r.after_snippet) && (
                <div className="grid gap-2 sm:grid-cols-2 mb-3">
                  {r.before_snippet && (
                    <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-red-400 mb-1">Avant</div>
                      <div className="text-xs leading-relaxed font-mono break-words">{r.before_snippet}</div>
                    </div>
                  )}
                  {r.after_snippet && (
                    <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300 mb-1">Après</div>
                      <div className="text-xs leading-relaxed font-mono break-words">{r.after_snippet}</div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground mb-3">
                {r.impact && (
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5 text-cyan-300" /> {r.impact}
                  </span>
                )}
                {r.page_url && (
                  <a href={r.page_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground transition">
                    <ExternalLink className="h-3.5 w-3.5" /> Voir la page
                  </a>
                )}
                {r.commit_sha && (
                  <span className="font-mono">commit {r.commit_sha}</span>
                )}
                <span>{new Date(r.created_at).toLocaleDateString("fr-CH")}</span>
                {r.verified_at && (
                  <span className="flex items-center gap-1 text-cyan-300">
                    <ShieldCheck className="h-3.5 w-3.5" /> Vérifié en prod le {new Date(r.verified_at).toLocaleDateString("fr-CH")}
                  </span>
                )}
              </div>

              {r.status === "pending" && (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setStatus(r.id, "approved")}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-emerald-700 transition"
                  >
                    <Check className="h-3.5 w-3.5" /> Approuver
                  </button>
                  <button
                    onClick={() => setStatus(r.id, "rejected")}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-700 transition"
                  >
                    <X className="h-3.5 w-3.5" /> Refuser
                  </button>
                </div>
              )}
              {r.status === "rejected" && (
                <button
                  onClick={() => setStatus(r.id, "pending")}
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
                >
                  <Clock className="h-3.5 w-3.5" /> Remettre en attente
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <NotificationsCard />

      <p className="text-[11px] text-muted-foreground border-t pt-3">
        Validation protégée par PIN. Les éléments « Approuvés » sont appliqués par Claude (audit hebdo du lundi 9h ou en session),
        puis passent en « Appliqué &amp; vérifié » après contrôle du rendu réel en production.
      </p>
    </div>
  );
}

function NotificationsCard() {
  const getTarget = useServerFn(getWhatsappTarget);
  const saveTarget = useServerFn(setWhatsappTarget);
  const sendTest = useServerFn(sendTestNotification);
  const [status, setStatus] = useState<{ configured: boolean; source: string | null; masked: string | null } | null>(null);
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getTarget());
    } catch {
      setStatus(null);
    }
  }, [getTarget]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async () => {
    if (!number.trim()) return;
    setBusy(true);
    try {
      const r = await saveTarget({ data: { number: number.trim() } });
      toast.success(`Numéro WhatsApp enregistré (${r.masked})`);
      setNumber("");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const r = await sendTest({});
      const parts = [
        r.email.ok ? "Email ✓" : `Email ✗ (${r.email.error ?? "?"})`,
        r.whatsapp.ok ? "WhatsApp ✓" : `WhatsApp ✗ (${r.whatsapp.error ?? "?"})`,
      ];
      (r.email.ok && r.whatsapp.ok ? toast.success : toast.warning)(parts.join(" · "), { duration: 10000 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-5">
      <h2 className="font-semibold text-base flex items-center gap-2 mb-1">
        <MessageCircle className="h-4 w-4 text-cyan-300" /> Notifications WhatsApp
      </h2>
      <p className="text-xs text-muted-foreground mb-3">
        {status?.configured
          ? `Numéro configuré : ${status.masked} (source : ${status.source === "env" ? "variable d'environnement" : "réglages"})`
          : "Aucun numéro configuré — les notifications ne partent que par email."}
      </p>
      <div className="flex gap-2 flex-wrap items-center">
        <input
          type="tel"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="+41 79 000 00 00"
          className="rounded-md border bg-background px-3 py-1.5 text-sm w-48"
        />
        <button
          onClick={save}
          disabled={busy || !number.trim()}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" /> Enregistrer
        </button>
        <button
          onClick={test}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-muted/40 transition disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" /> Envoyer un test (email + WhatsApp)
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">
        Sandbox Twilio : pour recevoir les messages, ton numéro doit avoir rejoint la sandbox
        (envoyer le code « join … » au +1 415 523 8886 sur WhatsApp — l'accès expire après 72 h d'inactivité).
      </p>
    </div>
  );
}
