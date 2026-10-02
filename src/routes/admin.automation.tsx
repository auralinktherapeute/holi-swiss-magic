import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Cpu, Lightbulb, ClipboardCheck, ScrollText, SlidersHorizontal, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  getAutomationOverview,
  setAutomationEnabled,
  updateAutomationRule,
  decideAutomationProposal,
} from "@/lib/automation.functions";
import {
  AUTOMATION_LEVELS,
  DECISIONS,
  DECISION_LABELS,
  EMPTY_STATES,
  LEVEL_LABELS,
  levelIndex,
  type AutomationDecision,
  type AutomationLevel,
} from "@/lib/automation-shared";
import { AutomationEmptyState } from "@/components/admin/AutomationEmptyState";

export const Route = createFileRoute("/admin/automation")({ component: Page });

type Tab = "recommendations" | "pending" | "journal" | "rules";
const TABS: { id: Tab; label: string; icon: typeof Lightbulb }[] = [
  { id: "recommendations", label: "Recommandations", icon: Lightbulb },
  { id: "pending", label: "À valider", icon: ClipboardCheck },
  { id: "journal", label: "Journal", icon: ScrollText },
  { id: "rules", label: "Règles", icon: SlidersHorizontal },
];

function Page() {
  const [tab, setTab] = useState<Tab>("recommendations");
  const qc = useQueryClient();
  const getFn = useServerFn(getAutomationOverview);
  const setEnabledFn = useServerFn(setAutomationEnabled);
  const ruleFn = useServerFn(updateAutomationRule);
  const decideFn = useServerFn(decideAutomationProposal);

  const q = useQuery({ queryKey: ["automation-overview"], queryFn: () => getFn() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["automation-overview"] });

  const toggleGlobal = useMutation({
    mutationFn: (enabled: boolean) => setEnabledFn({ data: { enabled } }),
    onSuccess: (r) => { toast.success(r.enabled ? "Agent Automation activé" : "Agent Automation désactivé"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveRule = useMutation({
    mutationFn: (v: { action_key: string; level: AutomationLevel; enabled: boolean }) => ruleFn({ data: v }),
    onSuccess: () => { toast.success("Règle enregistrée"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const decide = useMutation({
    mutationFn: (v: { proposal_id: string; decision: AutomationDecision; snooze_until?: string | null }) =>
      decideFn({ data: v }),
    onSuccess: () => { toast.success("Décision enregistrée"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const onDecide = (id: string, d: AutomationDecision) => {
    const snooze_until = d === "snooze" ? new Date(Date.now() + 7 * 864e5).toISOString() : null;
    decide.mutate({ proposal_id: id, decision: d, snooze_until });
  };

  const data = q.data;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cpu className="h-6 w-6 text-cyan-300" /> Agent Automation
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            L'agent observe et recommande ; vous décidez. Aucune action n'est exécutée dans cette phase,
            et l'agent ne peut jamais modifier ses propres règles de sécurité.
          </p>
        </div>
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 px-4 py-3 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-violet-300" aria-hidden />
          <label htmlFor="automation-global" className="text-sm font-medium">
            Réglage global {data?.enabled ? "activé" : "désactivé"}
          </label>
          <Switch
            id="automation-global"
            checked={!!data?.enabled}
            disabled={!data || toggleGlobal.isPending}
            onCheckedChange={(v) => toggleGlobal.mutate(v)}
          />
        </div>
      </div>

      <div role="tablist" aria-label="Sections Agent Automation" className="flex gap-2 flex-wrap border-b border-border pb-2">
        {TABS.map(({ id, label, icon: Icon }) => {
          const count =
            id === "recommendations" ? data?.recommendations.length
            : id === "pending" ? data?.pending.length
            : id === "journal" ? data?.runs.length : undefined;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`min-h-11 inline-flex items-center gap-2 rounded-lg px-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                tab === id ? "bg-violet-500/15 text-violet-200 border border-violet-500/40" : "text-muted-foreground hover:bg-muted/30 border border-transparent"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden /> {label}
              {count !== undefined && <span className="text-xs opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {q.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      )}
      {q.isError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm flex items-center justify-between gap-3" role="alert">
          <span>{(q.error as Error).message}</span>
          <button onClick={() => q.refetch()} className="min-h-11 inline-flex items-center gap-2 rounded-lg border px-3">
            <RefreshCw className="h-4 w-4" /> Réessayer
          </button>
        </div>
      )}

      {data && (tab === "recommendations" || tab === "pending") && (() => {
        const list = tab === "recommendations" ? data.recommendations : data.pending;
        if (!list.length) return <AutomationEmptyState text={tab === "recommendations" ? EMPTY_STATES.recommendations : EMPTY_STATES.pending} />;
        return (
          <ul className="space-y-3">
            {list.map((p) => (
              <li key={p.id} className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold">{p.title}</div>
                    {p.rationale && <p className="text-sm text-muted-foreground mt-1">{p.rationale}</p>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {LEVEL_LABELS[p.level as AutomationLevel] ?? p.level} · {new Date(p.created_at).toLocaleDateString("fr-CH")}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[...DECISIONS].reverse().map((d) => (
                    <button
                      key={d}
                      disabled={decide.isPending}
                      onClick={() => onDecide(p.id, d)}
                      className={`min-h-11 rounded-lg border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                        d === "accept" ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200" : "hover:bg-muted/30"
                      }`}
                    >
                      {DECISION_LABELS[d]}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        );
      })()}

      {data && tab === "journal" && (
        data.runs.length === 0 ? <AutomationEmptyState text={EMPTY_STATES.journal} /> : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-2">Date</th><th>Action</th><th>Niveau</th><th>Statut</th></tr>
            </thead>
            <tbody>
              {data.runs.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2">{new Date(r.created_at).toLocaleString("fr-CH")}</td>
                  <td>{r.action_key}</td>
                  <td>{LEVEL_LABELS[r.level as AutomationLevel] ?? r.level}</td>
                  <td>{r.rolled_back_at ? "Annulée" : r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {data && tab === "rules" && (
        <div className="space-y-6">
          <p className="text-xs text-muted-foreground">
            Plafond de la phase actuelle : <strong>{LEVEL_LABELS[data.phaseMaxLevel]}</strong>. Les niveaux au-delà sont verrouillés par la politique de sécurité.
          </p>
          <ul className="space-y-3">
            {data.catalog.map((a) => (
              <li key={a.key} className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold">{a.label}</div>
                    <p className="text-sm text-muted-foreground">{a.description}</p>
                    {!a.configured && <p className="text-xs text-amber-300 mt-1">Pas encore configurée (désactivée).</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor={`rule-${a.key}`} className="text-sm">{a.enabled ? "Active" : "Inactive"}</label>
                    <Switch
                      id={`rule-${a.key}`}
                      checked={a.enabled}
                      disabled={saveRule.isPending}
                      onCheckedChange={(v) => saveRule.mutate({ action_key: a.key, level: a.level, enabled: v })}
                    />
                  </div>
                </div>
                <div role="radiogroup" aria-label={`Niveau — ${a.label}`} className="flex gap-2 flex-wrap">
                  {AUTOMATION_LEVELS.map((lvl) => {
                    const locked = levelIndex(lvl) > levelIndex(a.ceiling);
                    return (
                      <button
                        key={lvl}
                        role="radio"
                        aria-checked={a.level === lvl}
                        disabled={locked || saveRule.isPending}
                        title={locked ? "Verrouillé par la politique de sécurité" : undefined}
                        onClick={() => saveRule.mutate({ action_key: a.key, level: lvl, enabled: a.enabled })}
                        className={`min-h-11 rounded-lg border px-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                          a.level === lvl ? "border-violet-500/60 bg-violet-500/15 text-violet-100" : "hover:bg-muted/30"
                        }`}
                      >
                        {LEVEL_LABELS[lvl]}{locked ? " (verrouillé)" : ""}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>

          <div>
            <h2 className="text-lg font-semibold mb-2">Indicateurs d'apprentissage</h2>
            {data.learning.length === 0 ? <AutomationEmptyState text={EMPTY_STATES.learning} /> : (
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th className="py-2">Action</th><th>Décisions</th><th>Acceptation</th><th>Résultats + / −</th><th>Suggestion (non appliquée)</th></tr>
                </thead>
                <tbody>
                  {data.learning.map((l) => (
                    <tr key={l.action_key} className="border-t">
                      <td className="py-2">{l.action_key}</td>
                      <td>{l.decisions}</td>
                      <td>{l.acceptance_rate === null ? "—" : `${Math.round(l.acceptance_rate * 100)} %`}</td>
                      <td>{l.positive} / {l.negative}</td>
                      <td>{l.suggested_level ? LEVEL_LABELS[l.suggested_level] : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
