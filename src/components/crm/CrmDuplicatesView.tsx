import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import {
  getCrmMergePreview, listCrmDuplicateGroups, mergeCrmLeads, revertCrmMerge, setCrmDedupStatus,
} from "@/lib/crm-contacts.functions";
import { DEDUP_LEVEL_COLOR, DEDUP_LEVEL_LABEL, type DedupLevel } from "@/lib/crm-dedup";
import { crmBtn, crmBtnDanger, crmBtnGhost, crmCard, crmInput, crmLabel, fmtDate } from "./crm-ui";

const FIELD_LABELS: Record<string, string> = {
  first_name: "Prénom", last_name: "Nom", email: "Email", phone: "Téléphone",
  canton: "Ville / canton", specialty: "Spécialité", source: "Source", status: "Statut CRM",
  priority: "Priorité", assigned_to: "Responsable", notes: "Notes",
  last_contact_at: "Dernier contact", converted_therapist_id: "Profil thérapeute", created_at: "Créée le",
};

export function CrmDuplicatesView() {
  const listFn = useServerFn(listCrmDuplicateGroups);
  const statusFn = useServerFn(setCrmDedupStatus);
  const qc = useQueryClient();
  const [level, setLevel] = useState("");
  const [compare, setCompare] = useState<string[] | null>(null);

  const q = useQuery({
    queryKey: ["crm","duplicates", level],
    queryFn: () => listFn({ data: { level: (level || undefined) as DedupLevel | undefined } }),
  });

  const groups = q.data?.groups ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...crmCard, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select aria-label="Niveau de confiance" value={level} onChange={(e) => setLevel(e.target.value)} style={crmInput}>
          <option value="">Tous les niveaux</option>
          <option value="certain">Certain</option>
          <option value="probable">Probable</option>
          <option value="review">À examiner</option>
        </select>
        <span style={{ ...crmLabel, marginLeft: "auto" }}>{groups.length} groupe(s) — la fusion est toujours manuelle</span>
      </div>

      {q.isLoading && <div style={{ ...crmCard, color: "#94a3b8" }}>Analyse des doublons…</div>}
      {!q.isLoading && groups.length === 0 && (
        <div style={{ ...crmCard, textAlign: "center", color: "#94a3b8", padding: 32 }}>Aucun doublon détecté.</div>
      )}

      {groups.map((g: any) => (
        <div key={g.key} style={{ ...crmCard, borderLeft: `3px solid ${DEDUP_LEVEL_COLOR[g.level as DedupLevel]}` }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: `${DEDUP_LEVEL_COLOR[g.level as DedupLevel]}22`, color: DEDUP_LEVEL_COLOR[g.level as DedupLevel], fontWeight: 700 }}>
              {DEDUP_LEVEL_LABEL[g.level as DedupLevel]} · {g.score}
            </span>
            <span style={{ color: "#e2e8f0", fontSize: 13 }}>{g.reason}</span>
            <span style={{ ...crmLabel, marginLeft: "auto" }}>Statut : {g.dedupStatus === "ignored" ? "ignoré" : "à examiner"}</span>
          </div>

          <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 6 }}>
            {g.leads.map((l: any) => (
              <li key={l.id} style={{ display: "flex", gap: 10, flexWrap: "wrap", color: "#cbd5e1", fontSize: 12.5, padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ color: "white", fontWeight: 600, flex: "0 0 180px" }}>{l.name}</span>
                <span style={{ flex: "1 1 200px" }}>{l.email ?? "—"} · {l.phone ?? "—"}</span>
                <span>{l.canton ?? "—"}</span>
                <span>{l.source}</span>
                <span>{l.status}</span>
                <span style={{ color: "#64748b" }}>{fmtDate(l.created_at)}</span>
              </li>
            ))}
          </ul>

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button style={crmBtn} onClick={() => setCompare(g.leads.map((l: any) => l.id))}>Examiner</button>
            <button
              style={crmBtnGhost}
              onClick={async () => {
                await statusFn({ data: { leadIds: g.leads.map((l: any) => l.id), status: g.dedupStatus === "ignored" ? "open" : "ignored" } });
                qc.invalidateQueries({ queryKey: ["crm","duplicates"] });
                toast.success(g.dedupStatus === "ignored" ? "Groupe réouvert" : "Groupe ignoré (faux positif)");
              }}
            >
              {g.dedupStatus === "ignored" ? "Réouvrir" : "Ignorer (faux positif)"}
            </button>
          </div>
        </div>
      ))}

      {compare && <MergeDialog leadIds={compare} onClose={() => setCompare(null)} />}
    </div>
  );
}

export function MergeDialog({ leadIds, onClose }: { leadIds: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const previewFn = useServerFn(getCrmMergePreview);
  const mergeFn = useServerFn(mergeCrmLeads);
  const revertFn = useServerFn(revertCrmMerge);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const [lastMergeId, setLastMergeId] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["crm","merge-preview", leadIds.join(",")], queryFn: () => previewFn({ data: { leadIds } }) });
  const leads = (q.data?.leads ?? []) as any[];
  const counts = q.data?.counts ?? [];
  const comparison = q.data?.comparison ?? [];
  const primary = primaryId ?? leads.find((l) => l.converted_therapist_id)?.id ?? leads[0]?.id ?? null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Comparer et fusionner" style={{ position: "fixed", inset: 0, background: "rgba(6,4,16,0.78)", display: "grid", placeItems: "center", padding: 16, zIndex: 1000 }}>
      <div style={{ ...crmCard, width: "min(980px, 100%)", maxHeight: "90dvh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, color: "white", fontSize: 16 }}>Comparer et fusionner</h3>
          <button onClick={onClose} aria-label="Fermer" style={{ ...crmBtnGhost, minHeight: 36, padding: "6px 9px" }}><X size={15} aria-hidden /></button>
        </div>

        {q.isLoading && <div style={{ color: "#94a3b8" }}>Chargement de la comparaison…</div>}
        {q.isError && <div style={{ color: "#fecaca" }}>Erreur : {(q.error as Error).message}</div>}

        {leads.length > 0 && (
          <>
            <fieldset style={{ border: "none", padding: 0, margin: "0 0 14px" }}>
              <legend style={crmLabel}>Fiche principale conservée</legend>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
                {leads.map((l) => {
                  const c = counts.find((x: any) => x.id === l.id);
                  const active = primary === l.id;
                  return (
                    <label key={l.id} style={{ ...crmCard, padding: 12, flex: "1 1 220px", cursor: "pointer", borderColor: active ? "rgba(124,58,237,0.6)" : "rgba(255,255,255,0.08)", background: active ? "rgba(124,58,237,0.12)" : crmCard.background }}>
                      <input type="radio" name="primary" checked={active} onChange={() => setPrimaryId(l.id)} style={{ marginRight: 8 }} />
                      <span style={{ color: "white", fontWeight: 600, fontSize: 13 }}>{l.first_name} {l.last_name}</span>
                      <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>{l.email ?? "—"}</div>
                      <div style={{ ...crmLabel, marginTop: 6 }}>{l.source} · {c?.activities ?? 0} activité(s) · {c?.tasks ?? 0} tâche(s)</div>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, color: "#e2e8f0" }}>
                <caption className="sr-only">Comparaison des champs</caption>
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: "left", padding: "8px 10px", ...crmLabel, fontSize: 10.5 }}>Champ</th>
                    {leads.map((l) => (
                      <th key={l.id} scope="col" style={{ textAlign: "left", padding: "8px 10px", ...crmLabel, fontSize: 10.5 }}>
                        {l.first_name} {l.last_name}{primary === l.id ? " (principale)" : ""}
                      </th>
                    ))}
                    <th scope="col" style={{ textAlign: "left", padding: "8px 10px", ...crmLabel, fontSize: 10.5 }}>Valeur conservée</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row: any) => {
                    const tone = row.state === "different" ? "#fb923c" : row.state === "missing" ? "#64748b" : "#34d399";
                    const editable = row.state === "different" && !["created_at","source"].includes(row.field);
                    const primaryValue = row.values.find((v: any) => v.leadId === primary)?.value ?? null;
                    return (
                      <tr key={row.field} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "8px 10px", color: tone }}>{FIELD_LABELS[row.field] ?? row.field}</td>
                        {leads.map((l) => {
                          const v = row.values.find((x: any) => x.leadId === l.id)?.value;
                          return <td key={l.id} style={{ padding: "8px 10px", color: v == null || v === "" ? "#64748b" : "#e2e8f0" }}>{v == null || v === "" ? "—" : String(v)}</td>;
                        })}
                        <td style={{ padding: "8px 10px" }}>
                          {editable ? (
                            <select
                              aria-label={`Valeur conservée pour ${FIELD_LABELS[row.field] ?? row.field}`}
                              value={choices[row.field] ?? (primaryValue == null ? "" : String(primaryValue))}
                              onChange={(e) => setChoices((c) => ({ ...c, [row.field]: e.target.value === "" ? null : e.target.value }))}
                              style={{ ...crmInput, minHeight: 34, fontSize: 12, padding: "5px 8px" }}
                            >
                              {[...new Set(row.values.map((v: any) => (v.value == null ? "" : String(v.value))))].map((v) => (
                                <option key={String(v)} value={String(v)}>{v === "" ? "— (vide)" : String(v)}</option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>{primaryValue == null || primaryValue === "" ? "—" : String(primaryValue)}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ ...crmCard, padding: 12, marginTop: 12, borderLeft: "3px solid #7c3aed" }}>
              <div style={crmLabel}>Ce qui sera réattribué à la fiche principale</div>
              <div style={{ color: "#e2e8f0", fontSize: 12.5, marginTop: 4 }}>
                Notes, emails, activités, tâches et historique des fiches en double. Les fiches en double sont archivées
                (statut « fusionnée ») avec un lien vers la fiche principale — aucune suppression, fusion annulable.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button
                style={crmBtn}
                disabled={busy || !primary}
                onClick={async () => {
                  if (!primary) return;
                  const mergeIds = leads.map((l) => l.id).filter((id) => id !== primary);
                  if (!window.confirm(`Fusionner ${mergeIds.length} fiche(s) dans la fiche principale ? Cette action est journalisée et annulable.`)) return;
                  setBusy(true);
                  try {
                    const res = await mergeFn({ data: { primaryId: primary, mergeIds, fieldChoices: choices } });
                    setLastMergeId(res.mergeLogId);
                    qc.invalidateQueries({ queryKey: ["crm"] });
                    toast.success(`Fusion effectuée — ${res.reassigned.activities} activité(s), ${res.reassigned.tasks} tâche(s) réattribuées`);
                  } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
                }}
              >
                Confirmer la fusion
              </button>
              {lastMergeId && (
                <button
                  style={crmBtnDanger}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await revertFn({ data: { mergeLogId: lastMergeId } });
                      qc.invalidateQueries({ queryKey: ["crm"] });
                      setLastMergeId(null);
                      toast.success("Fusion annulée — fiches restaurées");
                    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
                  }}
                >
                  Annuler la fusion
                </button>
              )}
              <button style={crmBtnGhost} onClick={onClose}>Fermer</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
