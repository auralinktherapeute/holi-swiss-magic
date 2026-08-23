import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldAlert, Check, Trash2, AlertTriangle, Ban, Clock, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { listFlaggedMessages, applySanction, resolveModerationItem } from "@/lib/community.functions";
import "@/styles/admin-design-system.css";

export const Route = createFileRoute("/admin/moderation")({ component: Page });

const SEV: Record<string, { bg: string; color: string; label: string }> = {
  grave: { bg: "rgba(248,113,113,0.12)", color: "#f87171", label: "Grave" },
  infraction: { bg: "rgba(251,191,36,0.12)", color: "#fbbf24", label: "Infraction" },
};

function Page() {
  const qc = useQueryClient();
  const fetchItems = useServerFn(listFlaggedMessages);
  const sanction = useServerFn(applySanction);
  const resolve = useServerFn(resolveModerationItem);
  const [family, setFamily] = useState<string>("");

  const query = useQuery({
    queryKey: ["moderation-queue", family],
    queryFn: () => fetchItems({ data: { familySlug: family || null } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["moderation-queue"] });

  const resolveMutation = useMutation({
    mutationFn: (v: { messageId: string; action: "keep" | "remove" }) => resolve({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(v.action === "remove" ? "Message supprimé" : "Signalement levé");
      invalidate();
    },
    onError: () => toast.error("Action impossible"),
  });

  const sanctionMutation = useMutation({
    mutationFn: (v: { userId: string; kind: "warning" | "suspension" | "ban"; familyId?: string | null; reason?: string }) =>
      sanction({ data: { ...v, days: v.kind === "suspension" ? 7 : undefined } }),
    onSuccess: (_d, v) => {
      toast.success(
        v.kind === "warning" ? "Avertissement enregistré" : v.kind === "suspension" ? "Suspension de 7 jours appliquée" : "Bannissement appliqué",
      );
      invalidate();
    },
    onError: () => toast.error("Sanction impossible"),
  });

  const items = (query.data as any)?.messages ?? [];
  const families = (query.data as any)?.families ?? [];
  const graves = items.filter((i: any) => i.moderation_severity === "grave").length;

  return (
    <div className="adm-root" style={{ minHeight: "100vh", background: "#0f0a1e" }}>
      <div className="adm-page">
        <div className="adm-page-header">
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div
              style={{
                width: 48, height: 48, borderRadius: 12,
                background: "rgba(248,113,113,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#f87171", flexShrink: 0,
              }}
            >
              <ShieldAlert size={22} />
            </div>
            <div>
              <h1 className="adm-page-title">File de modération — Salons</h1>
              <p className="adm-page-subtitle">
                {items.length} message{items.length > 1 ? "s" : ""} signalé{items.length > 1 ? "s" : ""} par l'agent modérateur
              </p>
            </div>
            {graves > 0 && (
              <div
                style={{
                  marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
                  background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)",
                  borderRadius: 10, padding: "6px 14px", color: "#f87171", fontSize: 13, fontWeight: 600,
                }}
              >
                <AlertTriangle size={14} /> {graves} grave{graves > 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label htmlFor="family-filter" style={{ display: "block", fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.6)" }}>
            Filtrer par salon
          </label>
          <select
            id="family-filter"
            value={family}
            onChange={(e) => setFamily(e.target.value)}
            style={{
              minHeight: 44, borderRadius: 10, padding: "0 12px", fontSize: 14,
              background: "rgba(255,255,255,0.06)", color: "#fff",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <option value="">Tous les salons</option>
            {families.map((f: any) => (
              <option key={f.id} value={f.slug}>{f.name}</option>
            ))}
          </select>
        </div>

        {query.isLoading ? (
          <div className="adm-card"><div style={{ padding: 24, color: "rgba(255,255,255,0.6)" }}>Chargement…</div></div>
        ) : items.length === 0 ? (
          <div className="adm-card">
            <div className="adm-empty">
              <div className="adm-empty-icon" style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80" }}>
                <ShieldAlert size={24} />
              </div>
              <div className="adm-empty-title">Aucun signalement en attente</div>
              <div className="adm-empty-sub">Les salons respectent la Charte de Bienveillance.</div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {items.map((item: any) => {
              const sev = SEV[item.moderation_severity ?? "infraction"] ?? SEV.infraction;
              return (
                <div key={item.id} className="adm-card">
                  <div style={{ padding: "18px 24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", borderRadius: 999, padding: "3px 10px", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                        <MessageSquare size={12} /> {item.family?.name ?? "Salon"}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 5, background: sev.bg, borderRadius: 999, padding: "3px 10px", fontSize: 12, color: sev.color, fontWeight: 600 }}>
                        <AlertTriangle size={11} /> {sev.label}
                      </span>
                      {item.warnings > 0 && (
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                          {item.warnings} avertissement{item.warnings > 1 ? "s" : ""} antérieur{item.warnings > 1 ? "s" : ""}
                        </span>
                      )}
                      {item.activeSanction && (
                        <span style={{ fontSize: 12, color: "#f87171", display: "flex", alignItems: "center", gap: 4 }}>
                          <Clock size={11} /> {item.activeSanction.kind === "ban" ? "Banni" : "Suspendu"}
                        </span>
                      )}
                      <span style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                        {new Date(item.created_at).toLocaleString("fr-CH")}
                      </span>
                    </div>

                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>par {item.author?.name}</p>
                    <p style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.6, marginBottom: 12 }}>
                      « {item.content} »
                    </p>
                    {item.flagged_reason && (
                      <p style={{ fontSize: 13, color: sev.color, marginBottom: 12 }}>Motif : {item.flagged_reason}</p>
                    )}
                    {item.report?.report_md && (
                      <details style={{ marginBottom: 14 }}>
                        <summary style={{ cursor: "pointer", fontSize: 13, color: "rgba(255,255,255,0.6)", minHeight: 44, display: "flex", alignItems: "center" }}>
                          Rapport de l'agent modérateur
                        </summary>
                        <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 8, fontFamily: "inherit" }}>
                          {item.report.report_md}
                        </pre>
                      </details>
                    )}

                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <button
                        className="adm-btn"
                        onClick={() => sanctionMutation.mutate({ userId: item.user_id, kind: "warning", familyId: item.family_id, reason: item.flagged_reason })}
                      >
                        <AlertTriangle size={14} /> Avertir
                      </button>
                      <button
                        className="adm-btn"
                        onClick={() => sanctionMutation.mutate({ userId: item.user_id, kind: "suspension", familyId: item.family_id, reason: item.flagged_reason })}
                      >
                        <Clock size={14} /> Suspendre 7 j
                      </button>
                      <button
                        className="adm-btn adm-btn-danger"
                        onClick={() => {
                          if (window.confirm("Bannir définitivement ce thérapeute des salons ?")) {
                            sanctionMutation.mutate({ userId: item.user_id, kind: "ban", familyId: null, reason: item.flagged_reason });
                          }
                        }}
                      >
                        <Ban size={14} /> Bannir
                      </button>
                      <button
                        className="adm-btn adm-btn-danger"
                        onClick={() => {
                          if (window.confirm("Supprimer ce message ?")) resolveMutation.mutate({ messageId: item.id, action: "remove" });
                        }}
                      >
                        <Trash2 size={14} /> Supprimer
                      </button>
                      <button className="adm-btn adm-btn-approve" onClick={() => resolveMutation.mutate({ messageId: item.id, action: "keep" })}>
                        <Check size={14} /> Conserver
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
