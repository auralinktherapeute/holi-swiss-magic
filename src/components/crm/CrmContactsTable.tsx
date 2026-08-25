import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Copy, Mail, Phone, Search } from "lucide-react";
import { listCrmContacts, type CrmContactRow } from "@/lib/crm-contacts.functions";
import { DEDUP_LEVEL_COLOR, DEDUP_LEVEL_LABEL, type DedupLevel } from "@/lib/crm-dedup";
import { CRM_STATUS, crmBtn, crmBtnGhost, crmCard, crmInput, crmLabel, fmtDate, healthColor } from "./crm-ui";

const CANTONS = ["AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU","NE","NW","OW","SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH"];

export function CrmContactsTable({ onOpen }: { onOpen: (leadId: string) => void }) {
  const listFn = useServerFn(listCrmContacts);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const [status, setStatus] = useState("");
  const [canton, setCanton] = useState("");
  const [source, setSource] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [health, setHealth] = useState("");
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => setPage(1), [debounced, status, canton, source, profileStatus, plan, health, onlyDuplicates]);

  const q = useQuery({
    queryKey: ["crm","contacts", debounced, status, canton, source, profileStatus, plan, health, onlyDuplicates, page],
    queryFn: () =>
      listFn({
        data: {
          search: debounced || undefined,
          status: status || undefined,
          canton: canton || undefined,
          source: source || undefined,
          profileStatus: profileStatus || undefined,
          plan: plan || undefined,
          health: (health || undefined) as "low" | "mid" | "high" | undefined,
          onlyDuplicates: onlyDuplicates || undefined,
          page,
          pageSize,
        },
      }),
  });

  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...crmCard, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <label style={{ position: "relative", flex: "1 1 260px" }}>
          <span style={{ position: "absolute", left: 12, top: 13, color: "#94a3b8" }}><Search size={16} aria-hidden /></span>
          <input
            aria-label="Rechercher un contact"
            placeholder="Nom, email, téléphone, ville, canton, spécialité…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...crmInput, width: "100%", paddingLeft: 36 }}
          />
        </label>
        <select aria-label="Statut CRM" value={status} onChange={(e) => setStatus(e.target.value)} style={crmInput}>
          <option value="">Tous statuts CRM</option>
          {Object.entries(CRM_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select aria-label="Statut du profil" value={profileStatus} onChange={(e) => setProfileStatus(e.target.value)} style={crmInput}>
          <option value="">Tous profils</option>
          <option value="active">Profil actif</option>
          <option value="pending">Profil en attente</option>
          <option value="suspended">Profil suspendu</option>
          <option value="rejected">Profil refusé</option>
        </select>
        <select aria-label="Canton" value={canton} onChange={(e) => setCanton(e.target.value)} style={crmInput}>
          <option value="">Tous cantons</option>
          {CANTONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select aria-label="Source" value={source} onChange={(e) => setSource(e.target.value)} style={crmInput}>
          <option value="">Toutes sources</option>
          <option value="inscription">Inscription</option>
          <option value="waitlist">Liste d'attente</option>
          <option value="manual">Manuelle</option>
        </select>
        <select aria-label="Abonnement" value={plan} onChange={(e) => setPlan(e.target.value)} style={crmInput}>
          <option value="">Tous abonnements</option>
          <option value="free">Gratuit</option>
          <option value="pro">Pro</option>
          <option value="elite_pro">Elite Pro</option>
        </select>
        <select aria-label="Santé du profil" value={health} onChange={(e) => setHealth(e.target.value)} style={crmInput}>
          <option value="">Toute santé</option>
          <option value="low">Faible (&lt; 50)</option>
          <option value="mid">Moyenne (50–74)</option>
          <option value="high">Bonne (≥ 75)</option>
        </select>
        <button
          onClick={() => setOnlyDuplicates((v) => !v)}
          aria-pressed={onlyDuplicates}
          style={onlyDuplicates ? crmBtn : crmBtnGhost}
        >
          <Copy size={13} aria-hidden style={{ verticalAlign: -2, marginRight: 6 }} />
          Doublons
        </button>
      </div>

      <div style={{ ...crmLabel, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{total} contact{total > 1 ? "s" : ""} consolidé{total > 1 ? "s" : ""}</span>
        <span>{q.data?.duplicateGroups ?? 0} groupe(s) de doublons détecté(s)</span>
      </div>

      {q.isLoading && <div style={{ ...crmCard, color: "#94a3b8" }}>Chargement…</div>}
      {q.isError && <div style={{ ...crmCard, color: "#fecaca" }}>Erreur : {(q.error as Error).message}</div>}
      {!q.isLoading && rows.length === 0 && (
        <div style={{ ...crmCard, textAlign: "center", color: "#94a3b8", padding: 32 }}>Aucun contact ne correspond à ces critères.</div>
      )}

      {rows.length > 0 && (
        <div style={{ ...crmCard, padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "#e2e8f0" }}>
              <caption className="sr-only">Contacts CRM consolidés</caption>
              <thead style={{ background: "rgba(255,255,255,0.03)" }}>
                <tr>
                  {["Contact","Profession","Coordonnées","Ville / canton","Statut","Santé","Dernière comm.","Source","Créé le",""].map((h) => (
                    <th key={h} scope="col" style={{ textAlign: "left", padding: "11px 14px", ...crmLabel, fontSize: 10.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r: CrmContactRow, i: number) => {
                  const s = CRM_STATUS[r.status] ?? CRM_STATUS.new;
                  const dupLevel = r.duplicate_level as DedupLevel | null;
                  return (
                    <motion.tr
                      key={r.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, transition: { delay: Math.min(i, 12) * 0.015 } }}
                      style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {r.photo_url ? (
                            <img src={r.photo_url} alt="" width={32} height={32} loading="lazy" style={{ width: 32, height: 32, borderRadius: 999, objectFit: "cover" }} />
                          ) : (
                            <span aria-hidden style={{ width: 32, height: 32, borderRadius: 999, background: "rgba(124,58,237,0.3)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, color: "white" }}>
                              {(r.first_name?.[0] ?? "?").toUpperCase()}
                            </span>
                          )}
                          <span style={{ fontWeight: 600, color: "white" }}>{r.first_name} {r.last_name}</span>
                          {dupLevel && (
                            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: `${DEDUP_LEVEL_COLOR[dupLevel]}22`, color: DEDUP_LEVEL_COLOR[dupLevel], fontWeight: 700 }}>
                              Doublon · {DEDUP_LEVEL_LABEL[dupLevel]}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", color: "#cbd5e1" }}>{r.profession ?? "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#cbd5e1" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
                          {r.email && <span><Mail size={11} aria-hidden /> {r.email}</span>}
                          {r.phone && <span><Phone size={11} aria-hidden /> {r.phone}</span>}
                          {!r.email && !r.phone && "—"}
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{[r.city, r.canton].filter(Boolean).join(" · ") || "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: `${s.color}22`, color: s.color, fontWeight: 600 }}>{s.label}</span>
                      </td>
                      <td style={{ padding: "10px 14px", color: healthColor(r.health_score), fontWeight: 700 }}>{r.health_score ?? "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#94a3b8", fontSize: 12 }}>{fmtDate(r.last_contact_at)}</td>
                      <td style={{ padding: "10px 14px", color: "#94a3b8", fontSize: 12 }}>{r.sources.join(", ")}</td>
                      <td style={{ padding: "10px 14px", color: "#64748b", fontSize: 11 }}>{fmtDate(r.created_at)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        <button onClick={() => onOpen(r.id)} aria-label={`Ouvrir la fiche de ${r.first_name} ${r.last_name}`} style={{ ...crmBtn, minHeight: 36, padding: "7px 12px" }}>
                          Ouvrir
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pages > 1 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center" }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={{ ...crmBtnGhost, opacity: page <= 1 ? 0.4 : 1 }}>Précédent</button>
          <span style={{ color: "#94a3b8", fontSize: 13 }}>Page {page} / {pages}</span>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} style={{ ...crmBtnGhost, opacity: page >= pages ? 0.4 : 1 }}>Suivant</button>
        </div>
      )}
    </div>
  );
}
