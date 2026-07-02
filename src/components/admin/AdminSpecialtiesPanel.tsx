import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Save, Check, X } from "lucide-react";
import {
  listAdminTaxonomy, saveFamily, saveSpecialty, deleteSpecialty,
  resolvePendingImport, dismissPendingImport,
} from "@/lib/specialties-admin.functions";

type Family = any; type Specialty = any; type Pending = any;

const emptyFamily = (order: number): Family => ({
  id: null, slug: "", name_fr: "", name_de: null, name_it: null, name_en: null,
  description_fr: null, icon: null, sort_order: order, is_featured: false,
});
const emptySpecialty = (family_id: string, order: number): Specialty => ({
  id: null, family_id, slug: "", name_fr: "", name_de: null, name_it: null, name_en: null,
  description_fr: null, aliases: [], is_active: true, is_featured: false, sort_order: order,
});

export function AdminSpecialtiesPanel() {
  const qc = useQueryClient();
  const fetchAll = useServerFn(listAdminTaxonomy);
  const fetchSaveF = useServerFn(saveFamily);
  const fetchSaveS = useServerFn(saveSpecialty);
  const fetchDelS = useServerFn(deleteSpecialty);
  const fetchResolve = useServerFn(resolvePendingImport);
  const fetchDismiss = useServerFn(dismissPendingImport);

  const q = useQuery({ queryKey: ["admin-taxonomy"], queryFn: () => fetchAll() });
  const [activeFamId, setActiveFamId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ kind: "family" | "spec"; row: any } | null>(null);

  if (q.isLoading) return <div className="p-6 text-white/60">Chargement…</div>;
  const families: Family[] = (q.data as any)?.families ?? [];
  const specialties: Specialty[] = (q.data as any)?.specialties ?? [];
  const pending: Pending[] = (q.data as any)?.pending ?? [];

  const activeFam = activeFamId ? families.find((f) => f.id === activeFamId) : families[0];
  const famId = activeFam?.id;
  const specs = famId ? specialties.filter((s) => s.family_id === famId) : [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-taxonomy"] });

  const saveF = async (f: Family) => {
    try { await fetchSaveF({ data: f }); toast.success("Famille enregistrée"); setEditing(null); invalidate(); }
    catch (e: any) { toast.error(e.message || "Erreur"); }
  };
  const saveS = async (s: Specialty) => {
    try {
      await fetchSaveS({ data: { ...s, aliases: Array.isArray(s.aliases) ? s.aliases : [] } });
      toast.success("Spécialité enregistrée"); setEditing(null); invalidate();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
  };
  const delS = async (id: string) => {
    if (!confirm("Supprimer cette spécialité ?")) return;
    try { await fetchDelS({ data: { id } }); toast.success("Supprimée"); invalidate(); }
    catch (e: any) { toast.error(e.message || "Erreur"); }
  };

  return (
    <div style={{ color: "#fff" }}>
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}>
        {/* Families rail */}
        <div style={{ borderRight: "1px solid rgba(184,110,249,0.15)", paddingRight: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", color: "#b86ef9", letterSpacing: 1 }}>Familles</div>
            <button
              onClick={() => setEditing({ kind: "family", row: emptyFamily(families.length) })}
              className="adm-btn adm-btn-secondary" style={{ padding: "4px 8px" }}
            ><Plus size={12} /></button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {families.map((f) => (
              <button key={f.id} onClick={() => setActiveFamId(f.id)}
                style={{
                  textAlign: "left", padding: "8px 10px", borderRadius: 8,
                  background: famId === f.id ? "rgba(184,110,249,0.15)" : "transparent",
                  border: famId === f.id ? "1px solid #b86ef9" : "1px solid transparent",
                  color: "#fff", cursor: "pointer", fontSize: 13,
                }}>
                <div style={{ fontWeight: 600 }}>{f.name_fr}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{f.slug}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div>
          {activeFam && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{activeFam.name_fr}</h3>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "2px 0 0" }}>
                  {specs.length} spécialité{specs.length > 1 ? "s" : ""}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="adm-btn adm-btn-secondary" onClick={() => setEditing({ kind: "family", row: activeFam })}>
                  Éditer famille
                </button>
                <button className="adm-btn adm-btn-primary" onClick={() => setEditing({ kind: "spec", row: emptySpecialty(activeFam.id, specs.length) })}>
                  <Plus size={12} /> Ajouter spécialité
                </button>
              </div>
            </div>
          )}

          {/* Specialty list */}
          <div style={{ display: "grid", gap: 8 }}>
            {specs.map((s) => (
              <div key={s.id} className="adm-card" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{s.name_fr}</span>
                    {!s.is_active && <span className="adm-badge pending">inactive</span>}
                    {s.is_featured && <span className="adm-badge">★</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                    {s.slug} · {s.aliases?.length ?? 0} alias
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="adm-btn adm-btn-secondary" onClick={() => setEditing({ kind: "spec", row: s })}>Éditer</button>
                  <button className="adm-btn adm-btn-secondary" onClick={() => delS(s.id)} style={{ color: "#ef4444" }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
            {specs.length === 0 && (
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, padding: 20, textAlign: "center" }}>
                Aucune spécialité dans cette famille.
              </div>
            )}
          </div>

          {/* Pending imports */}
          {pending.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f59e0b", marginBottom: 10 }}>
                Libellés en attente de reclassement ({pending.length})
              </h3>
              <div style={{ display: "grid", gap: 8 }}>
                {pending.map((p) => (
                  <PendingRow key={p.id} pending={p} specialties={specialties} families={families}
                    onResolve={async (specialty_id: string) => {
                      try { await fetchResolve({ data: { pending_id: p.id, specialty_id } }); toast.success("Rattaché"); invalidate(); }
                      catch (e: any) { toast.error(e.message || "Erreur"); }
                    }}
                    onDismiss={async () => {
                      try { await fetchDismiss({ data: { pending_id: p.id } }); toast.success("Ignoré"); invalidate(); }
                      catch (e: any) { toast.error(e.message || "Erreur"); }
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {editing && editing.kind === "family" && (
        <EditFamilyDialog row={editing.row} onClose={() => setEditing(null)} onSave={saveF} />
      )}
      {editing && editing.kind === "spec" && (
        <EditSpecialtyDialog row={editing.row} families={families} onClose={() => setEditing(null)} onSave={saveS} />
      )}
    </div>
  );
}

function PendingRow({ pending, specialties, families, onResolve, onDismiss }: any) {
  const [selected, setSelected] = useState<string>("");
  return (
    <div className="adm-card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 600 }}>{pending.raw_label}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{pending.therapist_name}</div>
      </div>
      <select value={selected} onChange={(e) => setSelected(e.target.value)} className="adm-input" style={{ maxWidth: 260 }}>
        <option value="">Rattacher à…</option>
        {families.map((f: any) => (
          <optgroup key={f.id} label={f.name_fr}>
            {specialties.filter((s: any) => s.family_id === f.id).map((s: any) => (
              <option key={s.id} value={s.id}>{s.name_fr}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <button className="adm-btn adm-btn-primary" disabled={!selected} onClick={() => onResolve(selected)}>
        <Check size={12} /> Rattacher
      </button>
      <button className="adm-btn adm-btn-secondary" onClick={onDismiss}>
        <X size={12} /> Ignorer
      </button>
    </div>
  );
}

function TextField({ label, value, onChange, textarea }: any) {
  return (
    <div className="adm-field">
      <label className="adm-label">{label}</label>
      {textarea
        ? <textarea className="adm-input" rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} />
        : <input className="adm-input" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} />}
    </div>
  );
}

function EditFamilyDialog({ row, onClose, onSave }: any) {
  const [f, setF] = useState<any>({ ...row });
  const upd = (patch: any) => setF((prev: any) => ({ ...prev, ...patch }));
  return (
    <Backdrop onClose={onClose}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{row.id ? "Éditer la famille" : "Nouvelle famille"}</h3>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <TextField label="Slug" value={f.slug} onChange={(v: any) => upd({ slug: v ?? "" })} />
          <TextField label="Icon (brain/leaf/hand/sparkles)" value={f.icon} onChange={(v: any) => upd({ icon: v })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <TextField label="Nom FR" value={f.name_fr} onChange={(v: any) => upd({ name_fr: v ?? "" })} />
          <TextField label="Nom DE" value={f.name_de} onChange={(v: any) => upd({ name_de: v })} />
          <TextField label="Nom IT" value={f.name_it} onChange={(v: any) => upd({ name_it: v })} />
          <TextField label="Nom EN" value={f.name_en} onChange={(v: any) => upd({ name_en: v })} />
        </div>
        <TextField label="Description FR" value={f.description_fr} onChange={(v: any) => upd({ description_fr: v })} textarea />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="adm-field">
            <label className="adm-label">Ordre</label>
            <input className="adm-input" type="number" value={f.sort_order} onChange={(e) => upd({ sort_order: Number(e.target.value) })} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20 }}>
            <input type="checkbox" checked={!!f.is_featured} onChange={(e) => upd({ is_featured: e.target.checked })} />
            Mise en avant
          </label>
        </div>
      </div>
      <DialogFooter onClose={onClose} onSave={() => onSave(f)} />
    </Backdrop>
  );
}

function EditSpecialtyDialog({ row, families, onClose, onSave }: any) {
  const [s, setS] = useState<any>({ ...row, aliases: Array.isArray(row.aliases) ? row.aliases : [] });
  const [aliasInput, setAliasInput] = useState("");
  const upd = (patch: any) => setS((prev: any) => ({ ...prev, ...patch }));
  return (
    <Backdrop onClose={onClose}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{row.id ? "Éditer la spécialité" : "Nouvelle spécialité"}</h3>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="adm-field">
            <label className="adm-label">Famille</label>
            <select className="adm-input" value={s.family_id} onChange={(e) => upd({ family_id: e.target.value })}>
              {families.map((f: any) => <option key={f.id} value={f.id}>{f.name_fr}</option>)}
            </select>
          </div>
          <TextField label="Slug" value={s.slug} onChange={(v: any) => upd({ slug: v ?? "" })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <TextField label="Nom FR" value={s.name_fr} onChange={(v: any) => upd({ name_fr: v ?? "" })} />
          <TextField label="Nom DE" value={s.name_de} onChange={(v: any) => upd({ name_de: v })} />
          <TextField label="Nom IT" value={s.name_it} onChange={(v: any) => upd({ name_it: v })} />
          <TextField label="Nom EN" value={s.name_en} onChange={(v: any) => upd({ name_en: v })} />
        </div>
        <TextField label="Description FR" value={s.description_fr} onChange={(v: any) => upd({ description_fr: v })} textarea />

        <div className="adm-field">
          <label className="adm-label">Alias (synonymes de recherche)</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {s.aliases.map((a: string, i: number) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 999, background: "rgba(184,110,249,0.15)", fontSize: 12 }}>
                {a}
                <button onClick={() => upd({ aliases: s.aliases.filter((_: any, idx: number) => idx !== i) })} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input className="adm-input" value={aliasInput} onChange={(e) => setAliasInput(e.target.value)}
              placeholder="ajouter un alias…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && aliasInput.trim()) {
                  upd({ aliases: [...s.aliases, aliasInput.trim().toLowerCase()] });
                  setAliasInput("");
                }
              }}
            />
            <button className="adm-btn adm-btn-secondary" onClick={() => { if (aliasInput.trim()) { upd({ aliases: [...s.aliases, aliasInput.trim().toLowerCase()] }); setAliasInput(""); } }}>Ajouter</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div className="adm-field">
            <label className="adm-label">Ordre</label>
            <input className="adm-input" type="number" value={s.sort_order} onChange={(e) => upd({ sort_order: Number(e.target.value) })} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20 }}>
            <input type="checkbox" checked={!!s.is_active} onChange={(e) => upd({ is_active: e.target.checked })} />
            Active
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20 }}>
            <input type="checkbox" checked={!!s.is_featured} onChange={(e) => upd({ is_featured: e.target.checked })} />
            Mise en avant
          </label>
        </div>
      </div>
      <DialogFooter onClose={onClose} onSave={() => onSave(s)} />
    </Backdrop>
  );
}

function Backdrop({ children, onClose }: any) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        maxWidth: 720, width: "100%", maxHeight: "90vh", overflow: "auto",
        background: "#0f0a1e", border: "1px solid rgba(184,110,249,0.3)", borderRadius: 16, padding: 24,
      }}>
        {children}
      </div>
    </div>
  );
}

function DialogFooter({ onClose, onSave }: any) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
      <button className="adm-btn adm-btn-secondary" onClick={onClose}>Annuler</button>
      <button className="adm-btn adm-btn-primary" onClick={onSave}><Save size={12} /> Enregistrer</button>
    </div>
  );
}