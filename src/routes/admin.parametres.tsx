import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Save, RotateCcw, Globe, CreditCard, Shield, Bell, Tag } from "lucide-react";
import { toast } from "sonner";
import { useSessionState } from "@/hooks/use-session-state";
import { AdminSpecialtiesPanel } from "@/components/admin/AdminSpecialtiesPanel";
import "@/styles/admin-design-system.css";

export const Route = createFileRoute("/admin/parametres")({ component: Page });

type Settings = {
  siteName: string; contactEmail: string; prodUrl: string;
  priceFree: number; pricePro: number; pricePremium: number;
  maintenance: boolean; retentionMonths: number;
  emailNotifs: boolean; smsNotifs: boolean;
};

const DEFAULTS: Settings = {
  siteName: "Holiswiss", contactEmail: "contact@holiswiss.ch", prodUrl: "https://holiswiss.ch",
  priceFree: 0, pricePro: 29, pricePremium: 59,
  maintenance: false, retentionMonths: 36,
  emailNotifs: true, smsNotifs: false,
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 999,
        background: checked ? "#b86ef9" : "rgba(255,255,255,0.12)",
        border: "none", cursor: "pointer", position: "relative",
        transition: "background 200ms",
        flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: "50%",
        background: "#fff",
        transition: "left 200ms",
        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
      }} />
    </button>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="adm-card" style={{ marginBottom: 16 }}>
      <div className="adm-card-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "rgba(184,110,249,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#b86ef9",
          }}>
            <Icon size={16} />
          </div>
          <span className="adm-card-title">{title}</span>
        </div>
      </div>
      <div style={{ padding: "20px 24px" }}>{children}</div>
    </div>
  );
}

function Page() {
  const [s, setS] = useSessionState<Settings>("admin.settings.form", DEFAULTS);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useSessionState<"general" | "taxonomy">("admin.settings.tab", "general");

  const update = (patch: Partial<Settings>) => { setS((prev) => ({ ...prev, ...patch })); setDirty(true); };

  const save = () => {
    toast.success("Paramètres enregistrés");
    setDirty(false);
  };

  const reset = () => { setS(DEFAULTS); setDirty(false); };

  return (
    <div className="adm-root" style={{ minHeight: "100vh", background: "#0f0a1e" }}>
      <div className="adm-page" style={{ maxWidth: 820 }}>

        <motion.div
          className="adm-page-header"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 className="adm-page-title">Paramètres</h1>
              <p className="adm-page-subtitle">Configuration globale de la plateforme HoliSwiss</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {dirty && <span className="adm-badge pending">● Modifications non enregistrées</span>}
              <span className="adm-badge pending">⚠ Données locales (démo)</span>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid rgba(184,110,249,0.15)" }}>
          {[{ k: "general", label: "Général" }, { k: "taxonomy", label: "Taxonomie spécialités" }].map((t) => (
            <button key={t.k} onClick={() => setTab(t.k as any)}
              style={{
                padding: "10px 16px", background: "none", border: "none", cursor: "pointer",
                color: tab === t.k ? "#b86ef9" : "rgba(255,255,255,0.5)",
                borderBottom: tab === t.k ? "2px solid #b86ef9" : "2px solid transparent",
                fontSize: 14, fontWeight: 500,
              }}>{t.label}</button>
          ))}
        </div>

        {tab === "taxonomy" && (
          <div className="adm-card" style={{ padding: 20, marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <Tag size={16} style={{ color: "#b86ef9" }} />
              <span style={{ fontSize: 15, fontWeight: 600 }}>Familles, spécialités & imports en attente</span>
            </div>
            <AdminSpecialtiesPanel />
          </div>
        )}

        {tab === "general" && (<>
        {/* Site */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Section icon={Globe} title="Site">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="adm-field">
                <label className="adm-label">Nom du site</label>
                <input className="adm-input" value={s.siteName} onChange={(e) => update({ siteName: e.target.value })} />
              </div>
              <div className="adm-field">
                <label className="adm-label">Email de contact</label>
                <input className="adm-input" type="email" value={s.contactEmail} onChange={(e) => update({ contactEmail: e.target.value })} />
              </div>
              <div className="adm-field" style={{ gridColumn: "1 / -1" }}>
                <label className="adm-label">URL de production</label>
                <input className="adm-input" type="url" value={s.prodUrl} onChange={(e) => update({ prodUrl: e.target.value })} />
              </div>
            </div>
          </Section>
        </motion.div>

        {/* Tarifs */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Section icon={CreditCard} title="Plans tarifaires (CHF / mois)">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {[
                { key: "priceFree" as const, label: "Free", color: "rgba(255,255,255,0.3)" },
                { key: "pricePro" as const, label: "Pro", color: "#b86ef9" },
                { key: "pricePremium" as const, label: "Premium", color: "#5cc8fa" },
              ].map((plan) => (
                <div key={plan.key} className="adm-field">
                  <label className="adm-label" style={{ color: plan.color }}>{plan.label}</label>
                  <div style={{ position: "relative" }}>
                    <input
                      className="adm-input"
                      type="number" min={0}
                      value={s[plan.key]}
                      onChange={(e) => update({ [plan.key]: Number(e.target.value) })}
                      style={{ paddingRight: 40 }}
                    />
                    <span style={{
                      position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                      fontSize: 13, color: "rgba(255,255,255,0.35)", pointerEvents: "none",
                    }}>CHF</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </motion.div>

        {/* Maintenance */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Section icon={Shield} title="Maintenance & RGPD">
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#fff", marginBottom: 2 }}>Mode maintenance</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>Affiche une page de maintenance aux visiteurs du site</div>
                </div>
                <Toggle checked={s.maintenance} onChange={(v) => update({ maintenance: v })} />
              </div>
              <div className="adm-divider" />
              <div className="adm-field">
                <label className="adm-label">Durée de rétention des données (mois)</label>
                <input
                  className="adm-input"
                  type="number" min={1} max={120}
                  value={s.retentionMonths}
                  onChange={(e) => update({ retentionMonths: Number(e.target.value) })}
                  style={{ maxWidth: 160 }}
                />
              </div>
            </div>
          </Section>
        </motion.div>

        {/* Notifications */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Section icon={Bell} title="Notifications admin">
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {[
                { key: "emailNotifs" as const, label: "Notifications email", sub: "Recevoir un email à chaque nouvelle inscription" },
                { key: "smsNotifs" as const, label: "Notifications SMS", sub: "Recevoir un SMS pour les inscriptions premium" },
              ].map((notif) => (
                <div key={notif.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#fff", marginBottom: 2 }}>{notif.label}</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>{notif.sub}</div>
                  </div>
                  <Toggle checked={s[notif.key]} onChange={(v) => update({ [notif.key]: v })} />
                </div>
              ))}
            </div>
          </Section>
        </motion.div>

        {/* Footer actions */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingBottom: 40 }}
        >
          <button className="adm-btn adm-btn-secondary" onClick={reset}>
            <RotateCcw size={14} /> Réinitialiser
          </button>
          <button className="adm-btn adm-btn-primary" onClick={save}>
            <Save size={14} /> Enregistrer
          </button>
        </motion.div>
        </>)}

      </div>
    </div>
  );
}
