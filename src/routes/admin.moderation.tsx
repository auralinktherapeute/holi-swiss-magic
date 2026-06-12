import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Check, X, Star, FileText, MessageSquare, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import "@/styles/admin-design-system.css";

export const Route = createFileRoute("/admin/moderation")({ component: Page });

type Item = { id: string; type: "review" | "article"; author: string; preview: string; flag: string; created: string; rating?: number; severity: "high" | "medium" | "low" };

const ITEMS: Item[] = [
  { id: "r1", type: "review", author: "Marie L.", preview: "Cette personne est incompétente, elle prétend pouvoir guérir n'importe quoi en une séance…", flag: "Termes médicaux interdits (LPMéd)", created: "il y a 2 h", rating: 1, severity: "high" },
  { id: "a1", type: "article", author: "Claire Dupont", preview: "Comment traiter l'anxiété en 5 séances — résultats garantis à 100%", flag: "Promesse de résultat + vocabulaire LPMéd", created: "il y a 5 h", severity: "high" },
  { id: "r2", type: "review", author: "Anonyme", preview: "Excellent accompagnement, je recommande chaleureusement à toute la famille !", flag: "Signalé par un utilisateur", created: "il y a 1 j", rating: 5, severity: "low" },
];

const SEV_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  high:   { bg: "rgba(248,113,113,0.12)", color: "#f87171", label: "Critique" },
  medium: { bg: "rgba(251,191,36,0.12)",  color: "#fbbf24", label: "Moyen" },
  low:    { bg: "rgba(255,255,255,0.06)",  color: "rgba(255,255,255,0.5)", label: "Faible" },
};

function Page() {
  const [tab, setTab] = useState<"all" | "review" | "article">("all");
  const [items, setItems] = useState(ITEMS);

  const list = tab === "all" ? items : items.filter((i) => i.type === tab);

  const approve = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success("Contenu approuvé");
  };
  const remove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast("Contenu supprimé", { icon: "🗑" });
  };

  return (
    <div className="adm-root" style={{ minHeight: "100vh", background: "#0f0a1e" }}>
      <div className="adm-page">

        <motion.div
          className="adm-page-header"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: "rgba(248,113,113,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#f87171", flexShrink: 0,
            }}>
              <ShieldAlert size={22} />
            </div>
            <div>
              <h1 className="adm-page-title">File de modération</h1>
              <p className="adm-page-subtitle">
                {items.length} élément{items.length > 1 ? "s" : ""} en attente · Conformité LPMéd Suisse
              </p>
            </div>
            {items.filter((i) => i.severity === "high").length > 0 && (
              <div style={{
                marginLeft: "auto",
                display: "flex", alignItems: "center", gap: 6,
                background: "rgba(248,113,113,0.12)",
                border: "1px solid rgba(248,113,113,0.25)",
                borderRadius: 10, padding: "6px 14px",
                color: "#f87171", fontSize: 13, fontWeight: 600,
              }}>
                <AlertTriangle size={14} />
                {items.filter((i) => i.severity === "high").length} critique{items.filter((i) => i.severity === "high").length > 1 ? "s" : ""}
              </div>
            )}
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="adm-tabs" style={{ marginBottom: 24, width: "fit-content" }}>
          {[
            { value: "all",     label: "Tout",     count: items.length },
            { value: "review",  label: "Avis",     count: items.filter((i) => i.type === "review").length },
            { value: "article", label: "Articles", count: items.filter((i) => i.type === "article").length },
          ].map((t) => (
            <button
              key={t.value}
              className={`adm-tab ${tab === t.value ? "active" : ""}`}
              onClick={() => setTab(t.value as any)}
            >
              {t.label}
              <span style={{
                marginLeft: 6, fontSize: 11, fontWeight: 600,
                background: "rgba(255,255,255,0.08)", padding: "0 6px",
                borderRadius: 999, color: "rgba(255,255,255,0.5)",
              }}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Items */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <AnimatePresence mode="popLayout">
            {list.map((item, i) => {
              const sev = SEV_STYLE[item.severity];
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
                  transition={{ delay: i * 0.05 }}
                  className="adm-card"
                >
                  <div style={{ padding: "18px 24px" }}>
                    {/* Header row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                      {/* Type */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6,
                        background: "rgba(255,255,255,0.06)", borderRadius: 999,
                        padding: "3px 10px", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                        {item.type === "review" ? <MessageSquare size={12} /> : <FileText size={12} />}
                        {item.type === "review" ? "Avis" : "Article"}
                      </div>

                      {/* Flag */}
                      <div style={{
                        display: "flex", alignItems: "center", gap: 5,
                        background: sev.bg, borderRadius: 999,
                        padding: "3px 10px", fontSize: 12, color: sev.color,
                        fontWeight: 500,
                      }}>
                        <AlertTriangle size={11} /> {item.flag}
                      </div>

                      {/* Severity */}
                      <span style={{
                        fontSize: 11, fontWeight: 600, textTransform: "uppercase",
                        letterSpacing: "0.06em", color: sev.color,
                      }}>
                        {sev.label}
                      </span>

                      {/* Time */}
                      <span style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                        {item.created}
                      </span>
                    </div>

                    {/* Author + stars */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>par {item.author}</span>
                      {item.rating !== undefined && (
                        <div style={{ display: "flex", gap: 2 }}>
                          {Array.from({ length: 5 }).map((_, j) => (
                            <Star
                              key={j}
                              size={12}
                              style={{ color: j < item.rating! ? "#fbbf24" : "rgba(255,255,255,0.15)" }}
                              fill={j < item.rating! ? "#fbbf24" : "none"}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Preview */}
                    <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 1.6, marginBottom: 16 }}>
                      "{item.preview}"
                    </p>

                    {/* Actions */}
                    <div style={{
                      display: "flex", justifyContent: "flex-end", gap: 8,
                      paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)",
                    }}>
                      <button className="adm-btn adm-btn-danger" onClick={() => remove(item.id)}>
                        <X size={14} /> Supprimer
                      </button>
                      <button className="adm-btn adm-btn-approve" onClick={() => approve(item.id)}>
                        <Check size={14} /> Approuver
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {list.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="adm-card">
                <div className="adm-empty">
                  <div className="adm-empty-icon" style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80" }}>
                    <ShieldAlert size={24} />
                  </div>
                  <div className="adm-empty-title">File de modération vide 🎉</div>
                  <div className="adm-empty-sub">Tous les contenus ont été traités. Aucun signalement en attente.</div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
