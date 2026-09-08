import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/delegation")({ component: DelegationPage });

// --- Animations CSS injectées une seule fois ---
const DELEGATION_STYLES = `
  @keyframes holi-pulse {
    0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 6px currentColor; }
    50%       { opacity: 0.6; transform: scale(1.4); box-shadow: 0 0 14px currentColor; }
  }
  @keyframes holi-glow-cyan {
    0%, 100% { box-shadow: 0 0 8px rgba(92,200,250,0.3), 0 0 0 1px rgba(92,200,250,0.4); }
    50%       { box-shadow: 0 0 22px rgba(92,200,250,0.55), 0 0 0 1px rgba(92,200,250,0.7); }
  }
  @keyframes holi-glow-red {
    0%, 100% { box-shadow: 0 0 8px rgba(248,113,113,0.3), 0 0 0 1px rgba(248,113,113,0.4); }
    50%       { box-shadow: 0 0 22px rgba(248,113,113,0.55), 0 0 0 1px rgba(248,113,113,0.7); }
  }
  @keyframes holi-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes holi-progress-shine {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  .holi-card {
    transition: transform 180ms ease, box-shadow 180ms ease !important;
  }
  .holi-card:hover {
    transform: translateY(-2px) scale(1.01);
    box-shadow: 0 6px 24px rgba(184,110,249,0.2) !important;
  }
  .holi-btn-launch {
    transition: opacity 150ms, box-shadow 150ms, transform 100ms !important;
  }
  .holi-btn-launch:hover:not(:disabled) {
    box-shadow: 0 0 16px rgba(139,92,246,0.5) !important;
    transform: scale(1.04);
  }
  .holi-btn-launch:active:not(:disabled) {
    transform: scale(0.97);
  }
`;

function DelegationStylesInjector() {
  return <style dangerouslySetInnerHTML={{ __html: DELEGATION_STYLES }} />;
}

// --- Types agents / logs (lancement manuel) ---
type AgentStatus = "actif" | "inactif" | "running" | "error" | "paused" | "bientot";
type Community = "orchestration" | "content" | "growth" | "technical";

interface Agent {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  community: string;
  role: string | null;
  prompt_system: string | null;
  status: AgentStatus;
  trigger_type: string;
  cron_expression: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
  run_count: number;
  error_count: number;
  is_enabled: boolean;
  unique_role: string | null;
  can_verify_roles: string[] | null;
  deprecated_reason: string | null;
}

interface AgentLog {
  id: string;
  agent_slug: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  triggered_by: string;
  notes: string | null;
  message: string;
}

interface DelegationConfig {
  delegation_enabled: string;
  delegation_mode: string;
  objective_therapeutes: string;
  objective_deadline: string;
}

// --- Types pipeline de délégation ---
type DelegationPattern = "single-agent" | "fan-out-and-synthesize" | "classify-and-act" | "tournament" | "loop-until-done";
type DelegationRequestStatus = "pending" | "classifying" | "routing" | "executing" | "verifying" | "synthesizing" | "done" | "failed" | "blocked";
type DelegationStepPhase = "understand" | "route" | "delegate" | "verify" | "synthesize";
type DelegationStepStatus = "pending" | "running" | "success" | "error" | "rejected" | "skipped";

interface DelegationRequest {
  id: string;
  created_at: string;
  updated_at: string;
  requested_by: string | null;
  raw_input: string;
  classification: string | null;
  pattern: DelegationPattern | null;
  status: DelegationRequestStatus;
  plan: Record<string, unknown> | null;
  agents_used: string[] | null;
  verifier_slug: string | null;
  synthesis: Record<string, unknown> | null;
  open_concerns: Array<Record<string, unknown>> | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
}

interface DelegationStep {
  id: string;
  request_id: string;
  created_at: string;
  phase: DelegationStepPhase;
  step_order: number;
  agent_slug: string | null;
  verifier_of_step: string | null;
  status: DelegationStepStatus;
  input: unknown;
  output: unknown;
  verification_verdict: string | null;
  verification_notes: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
}

// --- Couleurs du design system HoliSwiss ---
const C = {
  bg: "#0f0a1e",
  bgCard: "rgba(29,18,56,0.9)",
  bgSection: "rgba(22,14,42,0.8)",
  border: "rgba(184,110,249,0.18)",
  borderActive: "rgba(184,110,249,0.45)",
  purple: "#b86ef9",
  purpleLight: "rgba(184,110,249,0.15)",
  cyan: "#5cc8fa",
  cyanLight: "rgba(92,200,250,0.12)",
  green: "#34d399",
  greenLight: "rgba(52,211,153,0.15)",
  red: "#f87171",
  redLight: "rgba(248,113,113,0.15)",
  amber: "#fbbf24",
  amberLight: "rgba(251,191,36,0.15)",
  text: "#ffffff",
  textMuted: "rgba(255,255,255,0.55)",
  textDim: "rgba(255,255,255,0.35)",
};

// Mapping community → libellé et couleur
const COMMUNITY_META: Record<Community, { label: string; color: string; bg: string }> = {
  orchestration: { label: "Orchestration", color: C.cyan, bg: C.cyanLight },
  content: { label: "Contenu", color: C.purple, bg: C.purpleLight },
  growth: { label: "Croissance", color: C.green, bg: C.greenLight },
  technical: { label: "Technique", color: C.amber, bg: C.amberLight },
};

// Mapping unique_role → libellé (roster à rôle unique du pipeline de délégation)
const ROLE_LABELS: Record<string, string> = {
  seo_geo: "SEO/GEO",
  copywriting: "Copywriting",
  ux_ui: "UX/UI",
  billing: "Billing/Payments",
  db_supabase: "DB/Supabase",
  security_rls: "Security/RLS",
  email: "Email",
  qa: "QA",
  translator: "Translator",
  synthesizer: "Synthesizer",
  orchestrator: "Orchestrateur",
};

const PHASE_META: Record<DelegationStepPhase, { label: string; icon: string }> = {
  understand: { label: "Comprendre", icon: "🧭" },
  route: { label: "Router", icon: "🧩" },
  delegate: { label: "Déléguer", icon: "🤝" },
  verify: { label: "Vérifier", icon: "🔍" },
  synthesize: { label: "Synthétiser", icon: "📝" },
};

// Mapping status → indicateur coloré
function StatusDot({ status }: { status: AgentStatus }) {
  const map: Record<AgentStatus, { color: string; label: string; pulse?: boolean }> = {
    actif:    { color: C.green,  label: "Actif" },
    running:  { color: C.cyan,   label: "En cours", pulse: true },
    inactif:  { color: C.textDim, label: "Inactif" },
    paused:   { color: C.amber,  label: "Pausé" },
    error:    { color: C.red,    label: "Erreur" },
    bientot:  { color: C.textDim, label: "Bientôt" },
  };
  const s = map[status] ?? map.inactif;
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: s.color,
        color: s.color,
        flexShrink: 0,
        animation: s.pulse ? "holi-pulse 1.4s ease-in-out infinite" : undefined,
        boxShadow: s.pulse ? `0 0 8px ${s.color}` : undefined,
      }} />
      <span style={{ fontSize: 12, color: s.color, fontWeight: 500 }}>{s.label}</span>
    </span>
  );
}

function StepStatusBadge({ status, verdict }: { status: DelegationStepStatus; verdict?: string | null }) {
  const map: Record<DelegationStepStatus, { color: string; label: string }> = {
    pending: { color: C.textDim, label: "En attente" },
    running: { color: C.cyan, label: "En cours" },
    success: { color: C.green, label: "OK" },
    error: { color: C.red, label: "Erreur" },
    rejected: { color: C.red, label: "Rejeté" },
    skipped: { color: C.textDim, label: "Ignoré" },
  };
  const s = map[status] ?? map.pending;
  const label = verdict ? verdict.toUpperCase() : s.label;
  return <span style={{ fontSize: 11, color: s.color, fontWeight: 700 }}>{label}</span>;
}

// Formater une date relative
function timeAgo(iso: string | null): string {
  if (!iso) return "jamais";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

// Icône emoji par community
function communityIcon(c: string) {
  if (c === "orchestration") return "🏛️";
  if (c === "content") return "✍️";
  if (c === "growth") return "📈";
  if (c === "technical") return "🔧";
  return "🤖";
}

// Verdict métier dérivé d'une délégation (pour recherche/filtres)
function requestVerdict(r: DelegationRequest): "approved" | "rejected" | "pending" | "error" {
  if (r.status === "done") return "approved";
  if (r.status === "blocked") return "rejected";
  if (r.status === "failed") return "error";
  return "pending";
}

// --- Modale d'édition du prompt ---
function EditPromptModal({
  agent,
  onClose,
  onSave,
}: {
  agent: Agent;
  onClose: () => void;
  onSave: (prompt: string) => Promise<void>;
}) {
  const [prompt, setPrompt] = useState(agent.prompt_system ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(prompt);
    setSaving(false);
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: "#1a1030", border: `1px solid ${C.borderActive}`,
        borderRadius: 16, padding: 24, width: "100%", maxWidth: 720,
        maxHeight: "85vh", overflowY: "auto",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{agent.name}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
              Prompt maître — sera adapté automatiquement en FR / DE / IT / EN
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 20 }}>×</button>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          style={{
            width: "100%", minHeight: 360, padding: 14,
            background: "rgba(0,0,0,0.3)", border: `1px solid ${C.border}`,
            borderRadius: 10, color: C.text, fontSize: 13, lineHeight: 1.6,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            resize: "vertical", outline: "none", boxSizing: "border-box",
          }}
          onFocus={(e) => { (e.target as HTMLElement).style.borderColor = C.borderActive; }}
          onBlur={(e) => { (e.target as HTMLElement).style.borderColor = C.border; }}
        />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button onClick={onClose} style={{
            padding: "8px 18px", borderRadius: 8, border: `1px solid ${C.border}`,
            background: "transparent", color: C.textMuted, cursor: "pointer", fontSize: 13,
          }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "8px 20px", borderRadius: 8, border: "none",
            background: `linear-gradient(135deg, ${C.purple}, ${C.cyan})`,
            color: "#fff", cursor: saving ? "wait" : "pointer", fontSize: 13, fontWeight: 600,
          }}>
            {saving ? "Sauvegarde…" : "Sauvegarder"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Carte d'un agent (lancement manuel simple) ---
function AgentCard({
  agent,
  onLaunch,
  onStop,
  onEditPrompt,
}: {
  agent: Agent;
  onLaunch: (a: Agent) => Promise<void>;
  onStop: (a: Agent) => Promise<void>;
  onEditPrompt: (a: Agent) => void;
}) {
  const [loading, setLoading] = useState(false);
  const cm = COMMUNITY_META[agent.community as Community];

  const handleLaunch = async () => {
    setLoading(true);
    await onLaunch(agent);
    setLoading(false);
  };
  const handleStop = async () => {
    setLoading(true);
    await onStop(agent);
    setLoading(false);
  };

  const canLaunch = agent.status !== "running" && agent.status !== "bientot";
  const canStop = agent.status === "running" || agent.status === "actif";

  const cardGlow = agent.status === "running"
    ? { animation: "holi-glow-cyan 2s ease-in-out infinite" }
    : agent.status === "error"
    ? { animation: "holi-glow-red 2s ease-in-out infinite" }
    : {};

  return (
    <div className="holi-card" style={{
      background: C.bgCard,
      border: `1px solid ${agent.status === "running" ? C.cyan : agent.status === "error" ? C.red : C.border}`,
      borderRadius: 12,
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      opacity: agent.deprecated_reason ? 0.55 : 1,
      ...cardGlow,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
          background: cm?.bg ?? C.purpleLight,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
        }}>
          {communityIcon(agent.community)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{agent.name}</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {agent.role}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {canLaunch && (
            <button
              onClick={handleLaunch}
              disabled={loading}
              title="Lancer l'agent"
              className="holi-btn-launch"
              style={{
                padding: "5px 12px", borderRadius: 7, border: "none",
                background: `linear-gradient(135deg, ${C.purple}, ${C.cyan})`,
                color: "#fff", fontSize: 12, fontWeight: 600, cursor: loading ? "wait" : "pointer",
                opacity: loading ? 0.7 : 1,
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              {loading
                ? <span style={{ display: "inline-block", width: 10, height: 10, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "holi-spin 0.7s linear infinite" }} />
                : "▶"}
              {loading ? "En cours…" : "Lancer"}
            </button>
          )}
          {canStop && (
            <button
              onClick={handleStop}
              disabled={loading}
              title="Arrêter l'agent"
              style={{
                padding: "5px 12px", borderRadius: 7, border: `1px solid ${C.border}`,
                background: "transparent", color: C.amber, fontSize: 12, cursor: loading ? "wait" : "pointer",
              }}
            >
              ⏹ Stop
            </button>
          )}
          <button
            onClick={() => onEditPrompt(agent)}
            title="Éditer le prompt"
            style={{
              padding: "5px 10px", borderRadius: 7, border: `1px solid ${C.border}`,
              background: "transparent", color: C.textMuted, fontSize: 12, cursor: "pointer",
            }}
          >
            ✏
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <StatusDot status={agent.status} />
        {agent.unique_role && (
          <span style={{ fontSize: 10, color: C.purple, background: C.purpleLight, padding: "1px 8px", borderRadius: 999, fontWeight: 600 }}>
            {ROLE_LABELS[agent.unique_role] ?? agent.unique_role}
          </span>
        )}
        <span style={{ fontSize: 11, color: C.textDim }}>
          Dernier run : {timeAgo(agent.last_run_at)}
        </span>
        <span style={{ fontSize: 11, color: C.textDim }}>
          {agent.run_count} runs
        </span>
        {agent.cron_expression && (
          <span style={{
            fontSize: 10, color: C.cyan, background: C.cyanLight,
            padding: "1px 7px", borderRadius: 999, fontFamily: "monospace",
          }}>
            cron: {agent.cron_expression}
          </span>
        )}
        {agent.error_count > 0 && (
          <span style={{
            fontSize: 10, color: C.red, background: C.redLight,
            padding: "1px 7px", borderRadius: 999,
          }}>
            {agent.error_count} erreur{agent.error_count > 1 ? "s" : ""}
          </span>
        )}
        {agent.deprecated_reason && (
          <span style={{ fontSize: 10, color: C.textDim, fontStyle: "italic" }}>
            déprécié — {agent.deprecated_reason}
          </span>
        )}
      </div>
    </div>
  );
}

// --- Composant de logs en temps réel (lancement manuel) ---
function LogsFeed({ logs, filter, onFilterChange }: {
  logs: AgentLog[];
  filter: string;
  onFilterChange: (f: string) => void;
}) {
  const filters = [
    { key: "all", label: "Tous" },
    { key: "success", label: "Succès" },
    { key: "error", label: "Erreurs" },
    { key: "running", label: "En cours" },
  ];

  const filtered = filter === "all" ? logs : logs.filter((l) => l.status === filter);

  const statusIcon = (s: string) => {
    if (s === "success") return "✅";
    if (s === "error") return "❌";
    if (s === "started" || s === "running") return "🔄";
    if (s === "stopped") return "⏹";
    return "ℹ️";
  };

  return (
    <div style={{ background: C.bgSection, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{
        padding: "14px 18px", borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>📋 Logs en temps réel</span>
        <div style={{ display: "flex", gap: 6 }}>
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => onFilterChange(f.key)}
              style={{
                padding: "4px 12px", borderRadius: 999, border: "none", fontSize: 12, cursor: "pointer",
                background: filter === f.key ? C.purple : "rgba(255,255,255,0.07)",
                color: filter === f.key ? "#fff" : C.textMuted,
                fontWeight: filter === f.key ? 600 : 400,
                transition: "all 150ms",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxHeight: 320, overflowY: "auto", padding: "10px 18px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: C.textDim, fontSize: 13, padding: "30px 0" }}>
            Aucun log pour le moment
          </div>
        ) : (
          filtered.map((log) => (
            <div key={log.id} style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "8px 0", borderBottom: `1px solid rgba(255,255,255,0.04)`,
            }}>
              <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1.4 }}>{statusIcon(log.status)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12, color: C.textMuted, marginRight: 8 }}>
                  {new Date(log.started_at).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span style={{ fontSize: 12, color: C.purple, fontWeight: 600, marginRight: 6 }}>
                  {log.agent_slug}
                </span>
                <span style={{ fontSize: 12, color: C.text }}>
                  {log.message || log.notes || log.error_message || log.status}
                </span>
              </div>
              {log.duration_ms && (
                <span style={{ fontSize: 10, color: C.textDim, flexShrink: 0 }}>{log.duration_ms}ms</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// --- Timeline des 5 phases d'une délégation ---
function PipelineTimeline({ steps }: { steps: DelegationStep[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const sorted = useMemo(() => [...steps].sort((a, b) => a.step_order - b.step_order), [steps]);

  if (sorted.length === 0) {
    return <div style={{ fontSize: 12, color: C.textDim, padding: "8px 0" }}>En attente de la première étape…</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sorted.map((s) => {
        const meta = PHASE_META[s.phase] ?? { label: s.phase, icon: "•" };
        const isOpen = expanded === s.id;
        const borderColor = s.status === "error" || s.status === "rejected" ? C.red : s.status === "running" ? C.cyan : C.border;
        return (
          <div key={s.id} style={{ background: C.bgCard, border: `1px solid ${borderColor}`, borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setExpanded(isOpen ? null : s.id)}>
              <span style={{ fontSize: 16 }}>{meta.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: "0.05em" }}>{meta.label}</span>
              {s.agent_slug && <span style={{ fontSize: 11, color: C.purple }}>{s.agent_slug}</span>}
              {s.verifier_of_step && <span style={{ fontSize: 10, color: C.textDim }}>(vérifie une autre étape)</span>}
              <span style={{ marginLeft: "auto" }}><StepStatusBadge status={s.status} verdict={s.verification_verdict} /></span>
              <span style={{ fontSize: 11, color: C.textDim }}>{isOpen ? "▲" : "▼"}</span>
            </div>
            {isOpen && (
              <pre style={{
                marginTop: 8, fontSize: 11, color: C.textMuted, whiteSpace: "pre-wrap", maxHeight: 260, overflowY: "auto",
                background: "rgba(0,0,0,0.25)", padding: 10, borderRadius: 8, fontFamily: "'JetBrains Mono', monospace",
              }}>
                {JSON.stringify({ input: s.input, output: s.output, verification_notes: s.verification_notes }, null, 2)}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Bloc de synthèse finale (format de sortie obligatoire) ---
function SynthesisBlock({ synthesis }: { synthesis: Record<string, unknown> | null }) {
  if (!synthesis) return null;
  const agentsUtilises = (synthesis.agents_utilises as string[] | undefined) ?? [];
  const resultats = (synthesis.resultats_agents as Array<{ agent: string; resume: string }> | undefined) ?? [];
  const verif = synthesis.resultat_verificateur as { verdict?: string; raisons?: string[] } | undefined;
  const trad = synthesis.resultat_traducteur as { verdict?: string; raisons?: string[] } | null | undefined;
  const vigilance = (synthesis.points_vigilance as string[] | undefined) ?? [];

  const verdictColor = (v?: string) => v === "approved" ? C.green : v === "rejected" ? C.red : C.amber;

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.borderActive}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <span style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>Plan</span>
        <div style={{ fontSize: 13, color: C.text, marginTop: 2 }}>{String(synthesis.plan ?? "—")}</div>
      </div>
      <div>
        <span style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>Agents utilisés</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
          {agentsUtilises.map((a) => (
            <span key={a} style={{ fontSize: 11, color: C.purple, background: C.purpleLight, padding: "2px 8px", borderRadius: 999 }}>
              {ROLE_LABELS[a] ?? a}
            </span>
          ))}
        </div>
      </div>
      <div>
        <span style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>Résultat de chaque agent</span>
        {resultats.map((r, i) => (
          <div key={i} style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
            <strong style={{ color: C.text }}>{ROLE_LABELS[r.agent] ?? r.agent}</strong> — {r.resume}
          </div>
        ))}
      </div>
      <div>
        <span style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>Résultat du vérificateur</span>
        <div style={{ fontSize: 12, color: verdictColor(verif?.verdict), marginTop: 4, fontWeight: 700 }}>{verif?.verdict?.toUpperCase() ?? "—"}</div>
        {(verif?.raisons ?? []).map((r, i) => (<div key={i} style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>• {r}</div>))}
      </div>
      {trad && (
        <div>
          <span style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>Vérification traduction</span>
          <div style={{ fontSize: 12, color: verdictColor(trad.verdict), marginTop: 4, fontWeight: 700 }}>{trad.verdict?.toUpperCase() ?? "—"}</div>
        </div>
      )}
      <div>
        <span style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>Synthèse finale</span>
        <div style={{ fontSize: 13, color: C.text, marginTop: 4, lineHeight: 1.5 }}>{String(synthesis.synthese_finale ?? "—")}</div>
      </div>
      {vigilance.length > 0 && (
        <div>
          <span style={{ fontSize: 11, color: C.amber, textTransform: "uppercase", letterSpacing: "0.05em" }}>⚠ Points de vigilance restants</span>
          {vigilance.map((v, i) => (<div key={i} style={{ fontSize: 12, color: C.amber, marginTop: 4 }}>• {v}</div>))}
        </div>
      )}
    </div>
  );
}

function BlockedNotice({ request }: { request: DelegationRequest }) {
  if (request.status !== "blocked") return null;
  return (
    <div style={{ background: C.redLight, border: `1px solid ${C.red}`, borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.red }}>⚠ Délégation bloquée</div>
      {(request.open_concerns ?? []).map((concern, i) => {
        const raisons = concern.raisons;
        const raisonsText = Array.isArray(raisons) ? raisons.join(" | ") : typeof raisons === "string" ? raisons : "";
        return (
          <div key={i} style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
            {String(concern.message ?? "")}{raisonsText ? ` — ${raisonsText}` : ""}
          </div>
        );
      })}
    </div>
  );
}

// --- Zone "Déléguer une tâche" : pipeline complet en temps réel ---
function DelegateTaskPanel({ onRequestChange }: { onRequestChange: (r: DelegationRequest) => void }) {
  const [taskText, setTaskText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeRequest, setActiveRequest] = useState<DelegationRequest | null>(null);
  const [steps, setSteps] = useState<DelegationStep[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  useEffect(() => {
    if (!activeRequest) return;
    const channel = supabase
      .channel(`delegation-active-${activeRequest.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delegation_steps", filter: `request_id=eq.${activeRequest.id}` }, (payload) => {
        setSteps((prev) => {
          if (payload.eventType === "DELETE") return prev.filter((s) => s.id !== (payload.old as DelegationStep).id);
          const row = payload.new as DelegationStep;
          return prev.some((s) => s.id === row.id) ? prev.map((s) => (s.id === row.id ? row : s)) : [...prev, row];
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "delegation_requests", filter: `id=eq.${activeRequest.id}` }, (payload) => {
        const row = payload.new as DelegationRequest;
        setActiveRequest(row);
        onRequestChange(row);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRequest?.id]);

  const handleDelegate = async () => {
    const input = taskText.trim();
    if (!input) return;
    setSubmitting(true);
    setSteps([]);
    try {
      const { data: inserted, error: insertErr } = await db.from("delegation_requests")
        .insert({ raw_input: input, status: "pending" }).select().single();
      if (insertErr) throw new Error(insertErr.message);
      setActiveRequest(inserted as DelegationRequest);
      onRequestChange(inserted as DelegationRequest);
      toast(`Délégation lancée : "${input.slice(0, 60)}${input.length > 60 ? "…" : ""}"`);

      const { error: fnError } = await db.functions.invoke("run-agent", { body: { delegation_request_id: inserted.id } });
      if (fnError) throw new Error(fnError.message ?? "Erreur du pipeline de délégation");

      const { data: finalRequest } = await db.from("delegation_requests").select("*").eq("id", inserted.id).single();
      if (finalRequest) {
        setActiveRequest(finalRequest as DelegationRequest);
        onRequestChange(finalRequest as DelegationRequest);
        if (finalRequest.status === "done") toast.success("Délégation terminée ✅");
        else if (finalRequest.status === "blocked") toast.error("Délégation bloquée — vérification rejetée");
      }
      setTaskText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ background: C.bgSection, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 16 }}>🧭</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: "0.08em" }}>Déléguer une tâche</span>
        <span style={{ fontSize: 11, color: C.textDim }}>comprendre → router → déléguer → vérifier → synthétiser</span>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <textarea
          value={taskText}
          onChange={(e) => setTaskText(e.target.value)}
          placeholder='Ex. : "Rédige un article sur la sophrologie à Genève", "Vérifie les RLS de la table invoices", "Quel est le meilleur titre pour un article sur le reiki ?"'
          style={{
            flex: "1 1 320px", minHeight: 68, padding: 12, background: "rgba(0,0,0,0.3)", border: `1px solid ${C.border}`,
            borderRadius: 10, color: C.text, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box",
          }}
        />
        <button
          onClick={handleDelegate}
          disabled={submitting || !taskText.trim()}
          className="holi-btn-launch"
          style={{
            padding: "10px 24px", borderRadius: 10, border: "none", alignSelf: "flex-start",
            background: `linear-gradient(135deg, ${C.purple}, ${C.cyan})`, color: "#fff", fontWeight: 700, fontSize: 13,
            cursor: submitting || !taskText.trim() ? "not-allowed" : "pointer",
            opacity: submitting || !taskText.trim() ? 0.55 : 1,
          }}
        >
          {submitting ? "Pipeline en cours…" : "Déléguer"}
        </button>
      </div>

      {activeRequest && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: C.textMuted }}>Pattern : <strong style={{ color: C.purple }}>{activeRequest.pattern ?? "…"}</strong></span>
            <span style={{ fontSize: 11, color: C.textMuted }}>
              Statut : <strong style={{ color: activeRequest.status === "done" ? C.green : (activeRequest.status === "blocked" || activeRequest.status === "failed") ? C.red : C.cyan }}>{activeRequest.status}</strong>
            </span>
          </div>
          <PipelineTimeline steps={steps} />
          {activeRequest.status === "done" && <SynthesisBlock synthesis={activeRequest.synthesis} />}
          <BlockedNotice request={activeRequest} />
        </div>
      )}
    </div>
  );
}

// --- Recherche + filtres métier ---
function BusinessFilters({
  search, onSearchChange, verdictFilter, onVerdictFilterChange, domainFilter, onDomainFilterChange,
  blockedOnly, onBlockedOnlyChange, showDeprecated, onShowDeprecatedChange,
}: {
  search: string; onSearchChange: (v: string) => void;
  verdictFilter: string; onVerdictFilterChange: (v: string) => void;
  domainFilter: string; onDomainFilterChange: (v: string) => void;
  blockedOnly: boolean; onBlockedOnlyChange: (v: boolean) => void;
  showDeprecated: boolean; onShowDeprecatedChange: (v: boolean) => void;
}) {
  const verdicts = [
    { key: "all", label: "Tous" },
    { key: "approved", label: "Approuvé" },
    { key: "rejected", label: "Rejeté" },
    { key: "pending", label: "En cours" },
    { key: "error", label: "Erreur" },
  ];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", background: C.bgSection, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px" }}>
      <input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="🔍 Rechercher un agent, une tâche, un blocage, un conflit…"
        style={{ flex: "1 1 260px", padding: "8px 12px", background: "rgba(0,0,0,0.3)", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12, outline: "none" }}
      />
      <select
        value={domainFilter}
        onChange={(e) => onDomainFilterChange(e.target.value)}
        style={{ padding: "7px 10px", borderRadius: 8, background: "rgba(0,0,0,0.3)", border: `1px solid ${C.border}`, color: C.text, fontSize: 12 }}
      >
        <option value="all">Tous domaines</option>
        {Object.entries(ROLE_LABELS).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
      </select>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {verdicts.map((v) => (
          <button
            key={v.key}
            onClick={() => onVerdictFilterChange(v.key)}
            style={{
              padding: "6px 12px", borderRadius: 999, border: "none", fontSize: 11, cursor: "pointer",
              background: verdictFilter === v.key ? C.purple : "rgba(255,255,255,0.07)",
              color: verdictFilter === v.key ? "#fff" : C.textMuted, fontWeight: verdictFilter === v.key ? 700 : 400,
            }}
          >
            {v.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => onBlockedOnlyChange(!blockedOnly)}
        style={{
          padding: "6px 12px", borderRadius: 999, border: `1px solid ${blockedOnly ? C.red : C.border}`, fontSize: 11, cursor: "pointer",
          background: blockedOnly ? C.redLight : "transparent", color: blockedOnly ? C.red : C.textMuted, fontWeight: blockedOnly ? 700 : 400,
        }}
      >
        ⚠ Bloquées uniquement
      </button>
      <button
        onClick={() => onShowDeprecatedChange(!showDeprecated)}
        style={{
          padding: "6px 12px", borderRadius: 999, border: `1px solid ${C.border}`, fontSize: 11, cursor: "pointer",
          background: showDeprecated ? "rgba(255,255,255,0.1)" : "transparent", color: C.textMuted,
        }}
      >
        {showDeprecated ? "Masquer les dépréciés" : "Afficher les dépréciés"}
      </button>
    </div>
  );
}

// --- Panneau de métriques réelles (exécution du pipeline, pas déco) ---
function MetricsPanel({ requests, verifySteps }: { requests: DelegationRequest[]; verifySteps: DelegationStep[] }) {
  const closed = requests.filter((r) => ["done", "failed", "blocked"].includes(r.status));
  const successRate = closed.length ? Math.round((requests.filter((r) => r.status === "done").length / closed.length) * 100) : null;

  const rejectRate = verifySteps.length
    ? Math.round((verifySteps.filter((s) => s.verification_verdict === "rejected").length / verifySteps.length) * 100)
    : null;

  const doneWithDuration = requests.filter((r) => r.status === "done" && r.duration_ms);
  const avgDurationSec = doneWithDuration.length
    ? Math.round(doneWithDuration.reduce((sum, r) => sum + (r.duration_ms ?? 0), 0) / doneWithDuration.length / 1000)
    : null;

  const vigilanceCount = requests.filter((r) =>
    (r.status === "blocked" && (r.open_concerns?.length ?? 0) > 0) ||
    (r.status === "done" && ((r.synthesis?.points_vigilance as string[] | undefined)?.length ?? 0) > 0)
  ).length;

  const stats = [
    { label: "Taux de succès", value: successRate !== null ? `${successRate}%` : "—", color: C.green },
    { label: "Taux de rejet vérificateur", value: rejectRate !== null ? `${rejectRate}%` : "—", color: rejectRate && rejectRate > 30 ? C.red : C.amber },
    { label: "Durée moyenne", value: avgDurationSec !== null ? `${avgDurationSec}s` : "—", color: C.cyan },
    { label: "Points de vigilance ouverts", value: String(vigilanceCount), color: vigilanceCount > 0 ? C.amber : C.textMuted },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
      {stats.map((s) => (
        <div key={s.label} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// --- Historique des délégations passées ---
function DelegationHistory({ requests, onSelect }: { requests: DelegationRequest[]; onSelect: (r: DelegationRequest) => void }) {
  return (
    <div style={{ background: C.bgSection, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>🗂 Historique des délégations</span>
        <span style={{ fontSize: 11, color: C.textDim }}>{requests.length}</span>
      </div>
      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        {requests.length === 0 ? (
          <div style={{ textAlign: "center", color: C.textDim, fontSize: 13, padding: "24px 0" }}>Aucune délégation ne correspond</div>
        ) : requests.map((r) => (
          <div
            key={r.id}
            onClick={() => onSelect(r)}
            style={{ padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
          >
            <span style={{ fontSize: 11, color: C.textDim, flexShrink: 0, width: 70 }}>{timeAgo(r.created_at)}</span>
            <span style={{ fontSize: 12, color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.raw_input}</span>
            <span style={{ fontSize: 10, color: C.purple, background: C.purpleLight, padding: "1px 8px", borderRadius: 999, flexShrink: 0 }}>{r.pattern ?? "…"}</span>
            <span style={{
              fontSize: 10, flexShrink: 0, fontWeight: 700,
              color: r.status === "done" ? C.green : (r.status === "blocked" || r.status === "failed") ? C.red : C.cyan,
            }}>
              {r.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Modale de détail d'une délégation passée (lecture seule) ---
function HistoryDetailModal({ request, onClose }: { request: DelegationRequest; onClose: () => void }) {
  const [steps, setSteps] = useState<DelegationStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data } = await db.from("delegation_steps").select("*").eq("request_id", request.id).order("step_order");
      if (!cancelled) { setSteps((data ?? []) as DelegationStep[]); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [request.id]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: "#1a1030", border: `1px solid ${C.borderActive}`, borderRadius: 16, padding: 24,
        width: "100%", maxWidth: 760, maxHeight: "85vh", overflowY: "auto",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 10 }}>
          <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{request.raw_input}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 20, flexShrink: 0 }}>×</button>
        </div>
        {loading ? (
          <div style={{ color: C.textMuted, fontSize: 13 }}>Chargement…</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <PipelineTimeline steps={steps} />
            {request.synthesis && <SynthesisBlock synthesis={request.synthesis} />}
            <BlockedNotice request={request} />
          </div>
        )}
      </div>
    </div>
  );
}

// --- Page principale ---
function DelegationPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [config, setConfig] = useState<DelegationConfig | null>(null);
  const [therapeutesCount, setTherapeutesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [logFilter, setLogFilter] = useState("all");
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [globalPausing, setGlobalPausing] = useState(false);

  const [delegationRequests, setDelegationRequests] = useState<DelegationRequest[]>([]);
  const [verifySteps, setVerifySteps] = useState<DelegationStep[]>([]);
  const [historyDetail, setHistoryDetail] = useState<DelegationRequest | null>(null);

  const [search, setSearch] = useState("");
  const [verdictFilter, setVerdictFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all");
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [showDeprecated, setShowDeprecated] = useState(false);

  const loadData = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const [agentsRes, configRes, logsRes, countRes, requestsRes, verifyStepsRes] = await Promise.all([
      db.from("ai_agents").select("*").order("community").order("name"),
      db.from("delegation_config").select("key,value"),
      db.from("ai_agent_logs").select("*").order("started_at", { ascending: false }).limit(50),
      db.from("therapists").select("id", { count: "exact", head: true }).eq("status", "active"),
      db.from("delegation_requests").select("*").order("created_at", { ascending: false }).limit(50),
      db.from("delegation_steps").select("*").eq("phase", "verify").order("created_at", { ascending: false }).limit(200),
    ]);

    if (agentsRes.data) setAgents(agentsRes.data as Agent[]);
    if (logsRes.data) setLogs(logsRes.data as AgentLog[]);
    if (countRes.count !== null) setTherapeutesCount(countRes.count);
    if (requestsRes.data) setDelegationRequests(requestsRes.data as DelegationRequest[]);
    if (verifyStepsRes.data) setVerifySteps(verifyStepsRes.data as DelegationStep[]);
    if (configRes.data) {
      const map: Record<string, string> = {};
      for (const row of configRes.data) map[row.key] = row.value ?? "";
      setConfig(map as unknown as DelegationConfig);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();

    const logsChannel = supabase
      .channel("delegation-logs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ai_agent_logs" }, (payload) => {
        setLogs((prev) => [payload.new as AgentLog, ...prev].slice(0, 50));
      })
      .subscribe();

    const requestsChannel = supabase
      .channel("delegation-requests-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "delegation_requests" }, (payload) => {
        if (payload.eventType === "DELETE") {
          setDelegationRequests((prev) => prev.filter((r) => r.id !== (payload.old as DelegationRequest).id));
          return;
        }
        const row = payload.new as DelegationRequest;
        setDelegationRequests((prev) => {
          const exists = prev.some((r) => r.id === row.id);
          const next = exists ? prev.map((r) => (r.id === row.id ? row : r)) : [row, ...prev];
          return next.slice(0, 50);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(logsChannel);
      supabase.removeChannel(requestsChannel);
    };
  }, [loadData]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const handleRequestChange = useCallback((req: DelegationRequest) => {
    setDelegationRequests((prev) => {
      const exists = prev.some((r) => r.id === req.id);
      return exists ? prev.map((r) => (r.id === req.id ? req : r)) : [req, ...prev];
    });
  }, []);

  const handleLaunch = async (agent: Agent) => {
    setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, status: "running" as AgentStatus } : a));
    toast(`${agent.name} en cours d'exécution…`);

    try {
      const { data, error } = await db.functions.invoke("run-agent", {
        body: { agent_slug: agent.slug },
      });

      if (error) throw new Error(error.message ?? "Erreur Edge Function");

      const { data: updated } = await db.from("ai_agents").select("*").eq("id", agent.id).single();
      if (updated) {
        setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, ...updated } : a));
      }

      toast.success(`${agent.name} terminé ✅`);
      const { data: newLogs } = await db.from("ai_agent_logs")
        .select("*").order("started_at", { ascending: false }).limit(50);
      if (newLogs) setLogs(newLogs as AgentLog[]);

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`${agent.name} — ${msg}`);
      setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, status: "error" as AgentStatus } : a));
    }
  };

  const handleStop = async (agent: Agent) => {
    await db.from("ai_agents").update({ status: "paused" }).eq("id", agent.id);
    await db.from("ai_agent_logs").insert({
      agent_id: agent.id,
      agent_slug: agent.slug,
      status: "stopped",
      started_at: new Date().toISOString(),
      triggered_by: "manual",
      message: `Agent ${agent.name} arrêté manuellement`,
      level: "info",
    });
    setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, status: "paused" as AgentStatus } : a));
    toast(`${agent.name} mis en pause`);
  };

  const handleSavePrompt = async (prompt: string) => {
    if (!editingAgent) return;
    const { error } = await db
      .from("ai_agents")
      .update({ prompt_system: prompt, updated_at: new Date().toISOString() })
      .eq("id", editingAgent.id);
    if (error) { toast.error("Erreur lors de la sauvegarde"); return; }
    setAgents((prev) => prev.map((a) => a.id === editingAgent.id ? { ...a, prompt_system: prompt } : a));
    toast.success("Prompt sauvegardé");
  };

  const handleGlobalPause = async () => {
    const enabled = config?.delegation_enabled === "true";
    setGlobalPausing(true);
    await db.from("delegation_config").update({ value: enabled ? "false" : "true" }).eq("key", "delegation_enabled");
    if (enabled) {
      await db.from("ai_agents").update({ status: "paused" }).eq("status", "running");
      setAgents((prev) => prev.map((a) => a.status === "running" ? { ...a, status: "paused" as AgentStatus } : a));
    }
    setConfig((prev) => prev ? { ...prev, delegation_enabled: enabled ? "false" : "true" } : prev);
    setGlobalPausing(false);
    toast(enabled ? "Délégation mise en pause" : "Délégation activée");
  };

  const objectif = parseInt(config?.objective_therapeutes ?? "100");
  const deadline = config?.objective_deadline ? new Date(config.objective_deadline) : new Date("2026-11-24");
  const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / 86400000));
  const progressPct = Math.min(100, Math.round((therapeutesCount / objectif) * 100));
  const delegationActive = config?.delegation_enabled === "true";

  const searchLower = search.trim().toLowerCase();

  const filteredAgents = useMemo(() => agents.filter((a) => {
    if (!showDeprecated && a.deprecated_reason) return false;
    if (domainFilter !== "all" && a.unique_role !== domainFilter) return false;
    if (searchLower) {
      const hay = `${a.name} ${a.unique_role ?? ""} ${a.slug} ${a.role ?? ""}`.toLowerCase();
      if (!hay.includes(searchLower)) return false;
    }
    return true;
  }), [agents, showDeprecated, domainFilter, searchLower]);

  const filteredRequests = useMemo(() => delegationRequests.filter((r) => {
    if (blockedOnly && r.status !== "blocked") return false;
    if (verdictFilter !== "all" && requestVerdict(r) !== verdictFilter) return false;
    if (domainFilter !== "all" && !(r.agents_used ?? []).includes(domainFilter)) return false;
    if (searchLower) {
      const hay = `${r.raw_input} ${r.classification ?? ""} ${JSON.stringify(r.open_concerns ?? [])}`.toLowerCase();
      if (!hay.includes(searchLower)) return false;
    }
    return true;
  }), [delegationRequests, blockedOnly, verdictFilter, domainFilter, searchLower]);

  const byComm = (comm: Community) => filteredAgents.filter((a) => a.community === comm);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: C.bg }}>
        <div style={{ color: C.purple, fontSize: 14 }}>Chargement de la délégation…</div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh", padding: "24px 28px", fontFamily: "'Inter', system-ui, sans-serif", color: C.text }}>
      <DelegationStylesInjector />

      {/* ── En-tête ── */}
      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: "20px 24px", marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
              🏛️ The Summer Delegation
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted }}>
              Orchestrateur → agents spécialisés → vérificateur → synthèse — Gérald Henry
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={handleGlobalPause}
              disabled={globalPausing}
              style={{
                padding: "9px 18px", borderRadius: 10, border: "none", fontWeight: 600, fontSize: 13,
                cursor: globalPausing ? "wait" : "pointer",
                background: delegationActive
                  ? `linear-gradient(135deg, ${C.green}, #059669)`
                  : "rgba(255,255,255,0.08)",
                color: delegationActive ? "#fff" : C.textMuted,
                transition: "all 200ms",
              }}
            >
              {delegationActive ? "● DÉLÉGATION ACTIVE" : "⏸ DÉLÉGATION EN PAUSE"}
            </button>
          </div>
        </div>

        {/* Barre de progression — bandeau business, distinct des métriques d'exécution */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: C.textMuted }}>
              Progression : <strong style={{ color: C.text }}>{therapeutesCount}/{objectif} thérapeutes</strong>
              <span style={{ marginLeft: 8, color: C.purple, fontWeight: 600 }}>({progressPct}%)</span>
            </span>
            <span style={{ fontSize: 13, color: C.amber, fontWeight: 600 }}>J-{daysLeft} avant le 24 nov. 2026</span>
          </div>
          <div style={{ height: 8, background: "rgba(255,255,255,0.07)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${progressPct}%`,
              background: `linear-gradient(90deg, ${C.purple}, ${C.cyan}, ${C.purple})`,
              backgroundSize: "200% 100%",
              borderRadius: 999,
              transition: "width 800ms ease",
              animation: "holi-progress-shine 3s linear infinite",
            }} />
          </div>
        </div>
      </div>

      {/* ── Déléguer une tâche (pipeline complet) ── */}
      <div style={{ marginBottom: 20 }}>
        <DelegateTaskPanel onRequestChange={handleRequestChange} />
      </div>

      {/* ── Recherche + filtres métier ── */}
      <div style={{ marginBottom: 20 }}>
        <BusinessFilters
          search={search} onSearchChange={setSearch}
          verdictFilter={verdictFilter} onVerdictFilterChange={setVerdictFilter}
          domainFilter={domainFilter} onDomainFilterChange={setDomainFilter}
          blockedOnly={blockedOnly} onBlockedOnlyChange={setBlockedOnly}
          showDeprecated={showDeprecated} onShowDeprecatedChange={setShowDeprecated}
        />
      </div>

      {/* ── Métriques réelles d'exécution du pipeline ── */}
      <div style={{ marginBottom: 20 }}>
        <MetricsPanel requests={delegationRequests} verifySteps={verifySteps} />
      </div>

      {/* ── Sections agents par community (lancement manuel conservé) ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {(["orchestration", "content", "growth", "technical"] as Community[]).map((comm) => {
          const meta = COMMUNITY_META[comm];
          const commAgents = byComm(comm);
          if (commAgents.length === 0) return null;
          return (
            <div key={comm} style={{
              background: C.bgSection,
              border: `1px solid ${C.border}`,
              borderRadius: 14, overflow: "hidden",
            }}>
              <div style={{
                padding: "12px 18px",
                borderBottom: `1px solid ${C.border}`,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: 16 }}>{communityIcon(comm)}</span>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: meta.color,
                  textTransform: "uppercase", letterSpacing: "0.08em",
                }}>
                  {meta.label}
                </span>
                <span style={{
                  fontSize: 11, color: meta.color, background: meta.bg,
                  padding: "1px 8px", borderRadius: 999,
                }}>
                  {commAgents.length} agent{commAgents.length > 1 ? "s" : ""}
                </span>
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                gap: 12, padding: 14,
              }}>
                {commAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onLaunch={handleLaunch}
                    onStop={handleStop}
                    onEditPrompt={setEditingAgent}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Historique des délégations ── */}
      <div style={{ marginTop: 24 }}>
        <DelegationHistory requests={filteredRequests} onSelect={setHistoryDetail} />
      </div>

      {/* ── Logs en temps réel (lancement manuel) ── */}
      <div style={{ marginTop: 24 }}>
        <LogsFeed logs={logs} filter={logFilter} onFilterChange={setLogFilter} />
      </div>

      {/* ── Modales ── */}
      {editingAgent && (
        <EditPromptModal
          agent={editingAgent}
          onClose={() => setEditingAgent(null)}
          onSave={handleSavePrompt}
        />
      )}
      {historyDetail && (
        <HistoryDetailModal request={historyDetail} onClose={() => setHistoryDetail(null)} />
      )}
    </div>
  );
}
