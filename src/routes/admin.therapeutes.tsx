import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Check, X, Pause, ExternalLink, Loader2,
  Download, ChevronUp, ChevronDown, Users,
} from "lucide-react";
import { toast } from "sonner";
import { listTherapistsAdmin, updateTherapistStatus } from "@/lib/admin.functions";
import "@/styles/admin-design-system.css";

export const Route = createFileRoute("/admin/therapeutes")({ component: Page });

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente", active: "Actif", rejected: "Rejeté", suspended: "Suspendu",
};
const CANTONS = ["all","VD","GE","VS","FR","NE","JU","BE","ZH","BS","BL","AG","SO","LU","ZG","SG","TI","TG","GR","UR","SZ","OW","NW","GL","AI","AR","SH","ZG"];
const PAGE_SIZE = 20;

type SortKey = "name" | "canton" | "status" | "created_at";
type SortDir = "asc" | "desc";
type Action = { id: string; name: string; type: "active" | "rejected" | "suspended" } | null;

function StatusBadge({ status }: { status: string }) {
  const cls = status === "active" ? "active" : status === "pending" ? "pending" : status === "suspended" ? "suspended" : "rejected";
  return <span className={`adm-badge ${cls}`}>{STATUS_LABELS[status] ?? status}</span>;
}

function exportCSV(rows: any[]) {
  const header = ["Prénom", "Nom", "Email", "Canton", "Statut", "Inscrit"];
  const lines = rows.map((r) => [
    r.first_name, r.last_name, r.email ?? "", r.canton ?? "",
    STATUS_LABELS[r.status] ?? r.status,
    new Date(r.created_at).toLocaleDateString("fr-CH"),
  ].map((v) => `"${v}"`).join(","));
  const csv = [header.join(","), ...lines].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  a.download = `therapeutes_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

function Page() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [canton, setCanton] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchList = useServerFn(listTherapistsAdmin);
  const updateStatus = useServerFn(updateTherapistStatus);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-therapists", statusFilter, canton, search, page],
    queryFn: () => fetchList({ data: { status: statusFilter, canton, search, page, pageSize: PAGE_SIZE } }),
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronUp size={12} style={{ opacity: 0.3 }} />;
    return sortDir === "asc" ? <ChevronUp size={12} style={{ color: "#b86ef9" }} /> : <ChevronDown size={12} style={{ color: "#b86ef9" }} />;
  };

  const confirmAction = async () => {
    if (!action) return;
    if (action.type === "rejected" && reason.trim().length === 0) return;
    try {
      await updateStatus({ data: { id: action.id, status: action.type, reason: reason || undefined } });
      toast.success(`${action.name} : statut mis à jour`);
      qc.invalidateQueries({ queryKey: ["admin-therapists"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setAction(null); setReason(""); setConfirmText("");
    }
  };

  const filterTabs = [
    { value: "all",       label: "Tous",        count: total },
    { value: "pending",   label: "En attente" },
    { value: "active",    label: "Actifs" },
    { value: "suspended", label: "Suspendus" },
    { value: "rejected",  label: "Rejetés" },
  ];

  return (
    <div className="adm-root" style={{ minHeight: "100vh", background: "#0f0a1e" }}>
      <div className="adm-page">

        {/* Header */}
        <motion.div
          className="adm-page-header"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 className="adm-page-title">Thérapeutes</h1>
              <p className="adm-page-subtitle">Validation, modération et gestion des comptes</p>
            </div>
            <button
              className="adm-btn adm-btn-secondary"
              style={{ fontSize: 13 }}
              onClick={() => exportCSV(rows)}
            >
              <Download size={14} />
              Exporter CSV
            </button>
          </div>
        </motion.div>

        {/* Toolbar */}
        <div className="adm-toolbar">
          {/* Status tabs */}
          <div className="adm-tabs">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                className={`adm-tab ${statusFilter === tab.value ? "active" : ""}`}
                onClick={() => { setStatusFilter(tab.value); setPage(1); }}
              >
                {tab.label}
                {tab.count != null && (
                  <span style={{
                    marginLeft: 6, fontSize: 11, fontWeight: 600,
                    background: "rgba(255,255,255,0.1)", padding: "0 6px",
                    borderRadius: 999, color: "rgba(255,255,255,0.6)",
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Canton select */}
          <select
            className="adm-select"
            value={canton}
            onChange={(e) => { setCanton(e.target.value); setPage(1); }}
          >
            <option value="all">Tous cantons</option>
            {CANTONS.filter((c) => c !== "all").map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Search */}
          <div className="adm-search" style={{ marginLeft: "auto" }}>
            <Search size={15} />
            <input
              type="text"
              placeholder="Nom, email, spécialité…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {/* Table */}
        <motion.div
          className="adm-card"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort("name")} className={sortKey === "name" ? "sorted" : ""}>
                    Thérapeute <span className="sort-icon"><SortIcon col="name" /></span>
                  </th>
                  <th onClick={() => handleSort("canton")} className={sortKey === "canton" ? "sorted" : ""}>
                    Canton <span className="sort-icon"><SortIcon col="canton" /></span>
                  </th>
                  <th>Spécialités</th>
                  <th onClick={() => handleSort("status")} className={sortKey === "status" ? "sorted" : ""}>
                    Statut <span className="sort-icon"><SortIcon col="status" /></span>
                  </th>
                  <th onClick={() => handleSort("created_at")} className={sortKey === "created_at" ? "sorted" : ""}>
                    Inscrit <span className="sort-icon"><SortIcon col="created_at" /></span>
                  </th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {[200, 60, 140, 80, 90, 80].map((w, j) => (
                        <td key={j} style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <div className="adm-skeleton" style={{ height: 14, width: w }} />
                        </td>
                      ))}
                    </tr>
                  ))
                  : rows.map((r: any, i: number) => (
                    <motion.tr
                      key={r.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <td>
                        <div style={{ fontWeight: 600, color: "#fff" }}>{r.first_name} {r.last_name}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{r.email ?? "—"}</div>
                      </td>
                      <td>{r.canton ?? "—"}</td>
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {(r.specialties ?? []).slice(0, 2).map((s: string) => (
                            <span key={s} style={{
                              fontSize: 11, padding: "2px 8px", borderRadius: 999,
                              background: "rgba(184,110,249,0.1)", color: "#b86ef9",
                              border: "1px solid rgba(184,110,249,0.2)",
                            }}>{s}</span>
                          ))}
                        </div>
                      </td>
                      <td><StatusBadge status={r.status} /></td>
                      <td style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, whiteSpace: "nowrap" }}>
                        {new Date(r.created_at).toLocaleDateString("fr-CH", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            className="adm-btn adm-btn-icon"
                            title="Voir profil"
                            onClick={() => window.open(`/fr/therapeute/${r.slug}`, "_blank")}
                          >
                            <ExternalLink size={14} />
                          </button>
                          {r.status !== "active" && (
                            <button
                              className="adm-btn adm-btn-approve"
                              onClick={() => setAction({ id: r.id, name: `${r.first_name} ${r.last_name}`, type: "active" })}
                            >
                              <Check size={13} /> Valider
                            </button>
                          )}
                          {r.status !== "rejected" && r.status !== "active" && (
                            <button
                              className="adm-btn adm-btn-reject"
                              onClick={() => setAction({ id: r.id, name: `${r.first_name} ${r.last_name}`, type: "rejected" })}
                            >
                              <X size={13} /> Rejeter
                            </button>
                          )}
                          {r.status === "active" && (
                            <button
                              className="adm-btn adm-btn-reject"
                              onClick={() => setAction({ id: r.id, name: `${r.first_name} ${r.last_name}`, type: "suspended" })}
                            >
                              <Pause size={13} /> Suspendre
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))
                }
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="adm-empty">
                        <div className="adm-empty-icon"><Users size={24} /></div>
                        <div className="adm-empty-title">Aucun thérapeute trouvé</div>
                        <div className="adm-empty-sub">Modifiez vos filtres pour afficher d'autres résultats</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 0 && (
            <div style={{ padding: "0 16px 16px" }}>
              <div className="adm-pagination">
                <span className="adm-pagination-info">
                  {total} thérapeute{total > 1 ? "s" : ""} · page {page} / {totalPages}
                </span>
                <div className="adm-pagination-btns">
                  <button className="adm-page-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Précédent</button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const n = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                    return (
                      <button
                        key={n}
                        className={`adm-page-btn ${page === n ? "current" : ""}`}
                        onClick={() => setPage(n)}
                      >
                        {n}
                      </button>
                    );
                  })}
                  <button className="adm-page-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Suivant →</button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Modal confirmation */}
      <AnimatePresence>
        {action && (
          <motion.div
            className="adm-modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="adm-modal"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <div className="adm-modal-title">
                {action.type === "active"    && "✅ Valider ce thérapeute ?"}
                {action.type === "rejected"  && "❌ Rejeter ce thérapeute ?"}
                {action.type === "suspended" && "⏸ Suspendre ce thérapeute ?"}
              </div>
              <div className="adm-modal-desc">
                <strong style={{ color: "#fff" }}>{action.name}</strong>
                {action.type === "active" && " sera visible sur l'annuaire public."}
                {action.type === "rejected" && " recevra une notification de rejet."}
                {action.type === "suspended" && " sera masqué de l'annuaire."}
              </div>

              {action.type === "rejected" && (
                <div className="adm-field">
                  <label className="adm-label">Raison du rejet *</label>
                  <textarea
                    className="adm-input adm-textarea"
                    placeholder="Expliquez la raison du rejet…"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={500}
                  />
                </div>
              )}

              {action.type === "suspended" && (
                <div className="adm-field">
                  <label className="adm-label">Tapez CONFIRMER pour valider</label>
                  <input
                    className="adm-modal-input"
                    placeholder="CONFIRMER"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  className="adm-btn adm-btn-secondary"
                  onClick={() => { setAction(null); setReason(""); setConfirmText(""); }}
                >
                  Annuler
                </button>
                <button
                  className={`adm-btn ${action.type === "active" ? "adm-btn-approve" : "adm-btn-danger"}`}
                  onClick={confirmAction}
                  disabled={
                    (action.type === "rejected" && reason.trim().length === 0) ||
                    (action.type === "suspended" && confirmText !== "CONFIRMER")
                  }
                  style={{ opacity: (
                    (action.type === "rejected" && reason.trim().length === 0) ||
                    (action.type === "suspended" && confirmText !== "CONFIRMER")
                  ) ? 0.4 : 1 }}
                >
                  Confirmer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
