import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  listBlockedTherapistSignups,
  repairBlockedTherapistSignup,
} from "@/lib/signup-alerts.functions";

export function BlockedSignupsPanel() {
  const list = useServerFn(listBlockedTherapistSignups);
  const repair = useServerFn(repairBlockedTherapistSignup);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-blocked-signups"],
    queryFn: () => list(),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  const fix = useMutation({
    mutationFn: (userId: string) => repair({ data: { userId } }),
    onSuccess: () => {
      toast.success("Rôle thérapeute attribué. Le compte peut se connecter.");
      qc.invalidateQueries({ queryKey: ["admin-blocked-signups"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Échec de la réparation."),
  });

  const items = data?.items ?? [];

  return (
    <section
      className="adm-card"
      aria-labelledby="blocked-signups-title"
      style={{ marginBottom: 20, borderColor: items.length ? "rgba(239,68,68,0.45)" : undefined }}
    >
      <div className="adm-card-header">
        <span className="adm-card-title" id="blocked-signups-title">
          <AlertTriangle size={16} style={{ verticalAlign: "-3px", marginRight: 8, color: "#ef4444" }} />
          Inscriptions thérapeutes bloquées
        </span>
        <span style={{ fontSize: 13, color: items.length ? "#ef4444" : "rgba(255,255,255,0.5)" }}>
          {isLoading ? "Analyse…" : `${items.length} compte${items.length > 1 ? "s" : ""}`}
        </span>
      </div>

      {isLoading ? (
        <div className="adm-empty">
          <Loader2 size={20} className="animate-spin" aria-hidden />
          <div className="adm-empty-sub">Vérification des 30 derniers jours…</div>
        </div>
      ) : items.length === 0 ? (
        <div className="adm-empty">
          <div className="adm-empty-icon"><CheckCircle2 size={24} /></div>
          <div className="adm-empty-title">Aucun blocage détecté</div>
          <div className="adm-empty-sub">
            Toute nouvelle inscription bloquée déclenche une alerte e-mail et une notification.
          </div>
        </div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Compte</th>
                <th>Problème</th>
                <th>Inscrit le</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.user_id}>
                  <td style={{ fontWeight: 600, color: "#fff" }}>{row.email ?? "—"}</td>
                  <td style={{ color: "#f59e0b" }}>{row.reason}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {new Date(row.created_at).toLocaleDateString("fr-CH", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td>
                    {row.stage === "email_unconfirmed" ? (
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                        En attente de confirmation d'e-mail
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="adm-btn"
                        onClick={() => fix.mutate(row.user_id)}
                        disabled={fix.isPending}
                        aria-label={`Débloquer le compte ${row.email ?? row.user_id}`}
                        style={{
                          minHeight: 44,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "0 14px",
                          borderRadius: 8,
                          border: "1px solid rgba(184,110,249,0.5)",
                          background: "rgba(184,110,249,0.15)",
                          color: "#fff",
                          cursor: fix.isPending ? "not-allowed" : "pointer",
                        }}
                      >
                        {fix.isPending ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                        Débloquer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
