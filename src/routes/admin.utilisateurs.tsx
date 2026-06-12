import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Ban, ShieldCheck, Download, UserCog } from "lucide-react";
import { toast } from "sonner";
import { listUsersAdmin, setUserRole, deleteUserAdmin, banUserAdmin } from "@/lib/admin.functions";
import "@/styles/admin-design-system.css";

export const Route = createFileRoute("/admin/utilisateurs")({ component: Page });

const ROLES = ["admin", "moderator", "therapist", "user"] as const;
const ROLE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  admin:     { bg: "rgba(248,113,113,0.12)", color: "#f87171", border: "rgba(248,113,113,0.3)" },
  moderator: { bg: "rgba(251,191,36,0.12)",  color: "#fbbf24", border: "rgba(251,191,36,0.3)" },
  therapist: { bg: "rgba(184,110,249,0.12)", color: "#b86ef9", border: "rgba(184,110,249,0.3)" },
  user:      { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "rgba(255,255,255,0.12)" },
};

function exportCSV(users: any[]) {
  const header = ["Email","Rôles","Créé","Dernière connexion","Statut"];
  const lines = users.map((u) => [
    u.email,
    u.roles.join("|"),
    new Date(u.created_at).toLocaleDateString("fr-CH"),
    u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("fr-CH") : "—",
    u.banned_until && new Date(u.banned_until) > new Date() ? "Suspendu" : "Actif",
  ].map((v) => `"${v}"`).join(","));
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `utilisateurs_${new Date().toISOString().slice(0,10)}.csv`; a.click();
}

function Page() {
  const fetchUsers = useServerFn(listUsersAdmin);
  const updateRole = useServerFn(setUserRole);
  const deleteUser = useServerFn(deleteUserAdmin);
  const banUser = useServerFn(banUserAdmin);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers({ data: { page: 1, perPage: 100 } }),
  });

  const [toDelete, setToDelete] = useState<{ id: string; email: string } | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const toggleRole = async (userId: string, role: string, enabled: boolean) => {
    try {
      await updateRole({ data: { userId, role: role as any, enabled } });
      toast.success("Rôle mis à jour");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) { toast.error(e.message ?? "Erreur"); }
  };

  const toggleBan = async (userId: string, isBanned: boolean) => {
    try {
      await banUser({ data: { userId, ban: !isBanned } });
      toast.success(isBanned ? "Compte réactivé" : "Compte suspendu");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) { toast.error(e.message ?? "Erreur"); }
  };

  const confirmDelete = async () => {
    if (!toDelete || confirmText !== "CONFIRMER") return;
    try {
      await deleteUser({ data: { userId: toDelete.id } });
      toast.success("Utilisateur supprimé");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) { toast.error(e.message ?? "Erreur"); }
    finally { setToDelete(null); setConfirmText(""); }
  };

  const users = data?.users ?? [];

  return (
    <div className="adm-root" style={{ minHeight: "100vh", background: "#0f0a1e" }}>
      <div className="adm-page">

        <motion.div
          className="adm-page-header"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 className="adm-page-title">Utilisateurs</h1>
              <p className="adm-page-subtitle">Gestion des comptes, rôles et accès</p>
            </div>
            <button
              className="adm-btn adm-btn-secondary" style={{ fontSize: 13 }}
              onClick={() => exportCSV(users)}
            >
              <Download size={14} /> Exporter CSV
            </button>
          </div>
        </motion.div>

        <motion.div
          className="adm-card"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Rôles</th>
                  <th>Inscrit</th>
                  <th>Dernière connexion</th>
                  <th>Statut</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {[220, 180, 80, 80, 70, 70].map((w, j) => (
                        <td key={j} style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <div className="adm-skeleton" style={{ height: 14, width: w }} />
                        </td>
                      ))}
                    </tr>
                  ))
                  : users.map((u: any, i: number) => {
                    const banned = u.banned_until && new Date(u.banned_until) > new Date();
                    return (
                      <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}>
                        <td style={{ fontWeight: 500, color: "#fff" }}>{u.email}</td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {ROLES.map((r) => {
                              const has = u.roles?.includes(r);
                              const rc = ROLE_COLORS[r];
                              return (
                                <button
                                  key={r}
                                  onClick={() => toggleRole(u.id, r, !has)}
                                  style={{
                                    fontSize: 11, padding: "2px 9px", borderRadius: 999,
                                    border: `1px solid ${has ? rc.border : "rgba(255,255,255,0.1)"}`,
                                    background: has ? rc.bg : "transparent",
                                    color: has ? rc.color : "rgba(255,255,255,0.35)",
                                    cursor: "pointer", transition: "all 150ms",
                                    fontWeight: has ? 600 : 400,
                                  }}
                                >
                                  {r}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
                          {new Date(u.created_at).toLocaleDateString("fr-CH", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
                          {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("fr-CH", { day: "numeric", month: "short" }) : "—"}
                        </td>
                        <td>
                          <span className={`adm-badge ${banned ? "suspended" : "active"}`}>
                            {banned ? "Suspendu" : "Actif"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <button
                              className="adm-btn adm-btn-icon"
                              title={banned ? "Réactiver" : "Suspendre"}
                              onClick={() => toggleBan(u.id, !!banned)}
                            >
                              {banned ? <ShieldCheck size={14} /> : <Ban size={14} />}
                            </button>
                            <button
                              className="adm-btn adm-btn-icon"
                              title="Supprimer"
                              onClick={() => setToDelete({ id: u.id, email: u.email })}
                              style={{ color: "#f87171" }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                }
                {!isLoading && users.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="adm-empty">
                        <div className="adm-empty-icon"><UserCog size={24} /></div>
                        <div className="adm-empty-title">Aucun utilisateur</div>
                        <div className="adm-empty-sub">Les comptes créés apparaîtront ici</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* Modal suppression */}
      <AnimatePresence>
        {toDelete && (
          <motion.div
            className="adm-modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="adm-modal"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            >
              <div className="adm-modal-title" style={{ color: "#f87171" }}>⚠ Supprimer cet utilisateur ?</div>
              <div className="adm-modal-desc">
                <strong style={{ color: "#fff" }}>{toDelete.email}</strong> sera supprimé définitivement.
                Toutes ses données seront perdues. Cette action est irréversible.
              </div>
              <div className="adm-field">
                <label className="adm-label">Tapez CONFIRMER pour valider</label>
                <input
                  className="adm-modal-input"
                  placeholder="CONFIRMER"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="adm-btn adm-btn-secondary" onClick={() => { setToDelete(null); setConfirmText(""); }}>
                  Annuler
                </button>
                <button
                  className="adm-btn adm-btn-danger"
                  onClick={confirmDelete}
                  disabled={confirmText !== "CONFIRMER"}
                  style={{ opacity: confirmText !== "CONFIRMER" ? 0.4 : 1 }}
                >
                  <Trash2 size={14} /> Supprimer définitivement
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
