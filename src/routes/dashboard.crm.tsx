import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Crown, Search, Plus, LayoutGrid, List as ListIcon, X, Tag as TagIcon,
  Phone, Mail, Calendar, BellPlus, Trash2, Send,
} from "lucide-react";
import {
  checkElitePro, listMyContacts, upsertContact, deleteContact,
  addContactNote, getContactDetail, createContactReminder,
  type ClientContact,
} from "@/lib/crm-therapist.functions";

export const Route = createFileRoute("/dashboard/crm")({
  component: TherapistCrmPage,
});

const RELATION_STATUSES = [
  { id: "prospect",  label: "Prospect",       color: "#5cc8fa" },
  { id: "new",       label: "Nouveau client", color: "#a78bfa" },
  { id: "active",    label: "Client actif",   color: "#34d399" },
  { id: "followup",  label: "À relancer",     color: "#fb923c" },
  { id: "inactive",  label: "Inactif",        color: "#94a3b8" },
] as const;
const TAG_PRESETS = ["stress", "sommeil", "énergétique", "fidélisation", "VIP"];

function TherapistCrmPage() {
  const checkFn = useServerFn(checkElitePro);
  const eliteQ = useQuery({ queryKey: ["crm-th","elite"], queryFn: () => checkFn() });

  if (eliteQ.isLoading) {
    return <div style={{ padding: 48, color: "var(--muted-foreground)" }}>Chargement…</div>;
  }
  if (!eliteQ.data?.isElitePro) {
    return <ElitePropTeaser />;
  }
  return <ElitePropCrm />;
}

function ElitePropTeaser() {
  return (
    <div style={{ padding: "48px 24px", maxWidth: 720, margin: "0 auto" }}>
      <div
        style={{
          background: "linear-gradient(140deg, rgba(124,58,237,0.18), rgba(92,200,250,0.14))",
          border: "1px solid rgba(124,58,237,0.35)",
          borderRadius: 24,
          padding: 36,
          textAlign: "center",
          backdropFilter: "blur(10px)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "linear-gradient(135deg, #b86ef9, #f59e0b)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 18px",
          boxShadow: "0 8px 30px rgba(245,158,11,0.35)",
        }}>
          <Crown size={32} color="white" aria-hidden />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>CRM Elite Pro</h1>
        <p style={{ marginTop: 12, fontSize: 15, color: "var(--muted-foreground)", lineHeight: 1.6, maxWidth: 480, marginInline: "auto" }}>
          Passez à <strong>Elite Pro</strong> pour gérer vos contacts, vos clients et vos relances
          depuis un espace CRM dédié, intégré à votre agenda Holiswiss.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: "20px auto 24px", maxWidth: 380, textAlign: "left", color: "var(--muted-foreground)", fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
          <li>✓ Fiches clients enrichies (notes privées, tags, statut relation)</li>
          <li>✓ Timeline complète : réservations, messages, avis</li>
          <li>✓ Rappels personnalisés et relances automatiques</li>
          <li>✓ Vue tableau et vue cartes</li>
        </ul>
        <Link
          to="/dashboard/abonnement"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "12px 24px", minHeight: 44, borderRadius: 12,
            background: "linear-gradient(135deg, #b86ef9, #f59e0b)",
            color: "white", fontWeight: 600, textDecoration: "none", fontSize: 14,
            boxShadow: "0 6px 24px rgba(184,110,249,0.35)",
          }}
        >
          <Crown size={16} aria-hidden /> Passer à Elite Pro
        </Link>
      </div>
    </div>
  );
}

function ElitePropCrm() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyContacts);
  const upsertFn = useServerFn(upsertContact);
  const deleteFn = useServerFn(deleteContact);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  const [statusFilter, setStatusFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [editing, setEditing] = useState<ClientContact | null>(null);
  const [creating, setCreating] = useState(false);
  const [openContactId, setOpenContactId] = useState<string | null>(null);

  const contactsQ = useQuery({
    queryKey: ["crm-th","contacts", debounced, statusFilter, tagFilter],
    queryFn: () => listFn({ data: { search: debounced, status: statusFilter || undefined, tag: tagFilter || undefined } }),
  });

  const allTags = useMemo(() => {
    const set = new Set<string>(TAG_PRESETS);
    (contactsQ.data ?? []).forEach((c) => c.tags?.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [contactsQ.data]);

  const removeMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-th","contacts"] }); toast.success("Contact supprimé"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1400, margin: "0 auto" }}>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: "inline-flex", alignItems: "center", gap: 8, color: "var(--foreground)" }}>
            <Crown size={20} style={{ color: "#f59e0b" }} aria-hidden /> CRM Elite Pro
          </h1>
          <p style={{ color: "var(--muted-foreground)", fontSize: 13, marginTop: 4 }}>
            Vos contacts, leur historique et vos relances.
          </p>
        </div>
        <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "var(--muted)", borderRadius: 10 }}>
          <button onClick={() => setView("cards")} aria-pressed={view === "cards"} aria-label="Vue cartes"
            style={{ padding: "8px 12px", minHeight: 36, borderRadius: 8, border: "none", background: view === "cards" ? "var(--primary)" : "transparent", color: view === "cards" ? "white" : "var(--foreground)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <LayoutGrid size={14} aria-hidden /> Cartes
          </button>
          <button onClick={() => setView("table")} aria-pressed={view === "table"} aria-label="Vue tableau"
            style={{ padding: "8px 12px", minHeight: 36, borderRadius: 8, border: "none", background: view === "table" ? "var(--primary)" : "transparent", color: view === "table" ? "white" : "var(--foreground)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <ListIcon size={14} aria-hidden /> Tableau
          </button>
        </div>
        <button
          onClick={() => { setEditing(null); setCreating(true); }}
          aria-label="Nouveau contact"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", minHeight: 44, borderRadius: 12,
            background: "var(--primary)", border: "none", color: "white", fontWeight: 600, cursor: "pointer", fontSize: 14,
          }}
        >
          <Plus size={16} aria-hidden /> Nouveau contact
        </button>
      </header>

      {/* Filtres */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 360 }}>
          <Search size={16} aria-hidden style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }} />
          <input
            type="search"
            placeholder="Rechercher un contact…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher un contact"
            style={{ width: "100%", padding: "10px 12px 10px 36px", minHeight: 44, borderRadius: 12, background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 14 }}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrer par statut"
          style={{ minHeight: 44, padding: "10px 12px", borderRadius: 12, background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 14 }}>
          <option value="">Tous les statuts</option>
          {RELATION_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} aria-label="Filtrer par tag"
          style={{ minHeight: 44, padding: "10px 12px", borderRadius: 12, background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 14 }}>
          <option value="">Tous les tags</option>
          {allTags.map((t) => <option key={t} value={t}>#{t}</option>)}
        </select>
      </div>

      {/* Vue */}
      {contactsQ.isLoading ? (
        <div style={{ color: "var(--muted-foreground)", padding: 24 }}>Chargement…</div>
      ) : (contactsQ.data ?? []).length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--muted-foreground)", border: "1px dashed var(--border)", borderRadius: 16 }}>
          Aucun contact pour l'instant. Créez votre premier contact ci-dessus.
        </div>
      ) : view === "cards" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {(contactsQ.data ?? []).map((c, idx) => <ContactCard key={c.id} contact={c} index={idx} onOpen={() => setOpenContactId(c.id)} onEdit={() => setEditing(c)} onDelete={() => { if (confirm("Supprimer ce contact ?")) removeMut.mutate(c.id); }} />)}
        </div>
      ) : (
        <ContactsTable contacts={contactsQ.data ?? []} onOpen={(c) => setOpenContactId(c.id)} onEdit={(c) => setEditing(c)} />
      )}

      {/* Drawer fiche */}
      <AnimatePresence>
        {openContactId && (
          <ContactDrawer id={openContactId} onClose={() => setOpenContactId(null)} />
        )}
      </AnimatePresence>

      {/* Modal édition/création */}
      <AnimatePresence>
        {(creating || editing) && (
          <ContactForm
            contact={editing}
            onClose={() => { setCreating(false); setEditing(null); }}
            onSubmit={async (payload) => {
              await upsertFn({ data: payload });
              qc.invalidateQueries({ queryKey: ["crm-th","contacts"] });
              toast.success(editing ? "Contact mis à jour" : "Contact créé");
              setCreating(false);
              setEditing(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function statusMeta(id: string) {
  return RELATION_STATUSES.find((s) => s.id === id) ?? RELATION_STATUSES[0];
}

function ContactCard({ contact, index, onOpen, onEdit, onDelete }: { contact: ClientContact; index: number; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
  const initials = `${contact.first_name?.[0] ?? ""}${contact.last_name?.[0] ?? ""}`.toUpperCase();
  const s = statusMeta(contact.relation_status);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index, 8) * 0.04 } }}
      style={{
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 14,
        display: "flex", flexDirection: "column", gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--primary-xlight, rgba(124,58,237,0.15))", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>
          {initials || "?"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{contact.first_name} {contact.last_name}</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {contact.email ?? contact.phone ?? "—"}
          </div>
        </div>
        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: `${s.color}22`, color: s.color, whiteSpace: "nowrap" }}>{s.label}</span>
      </div>
      {contact.tags?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {contact.tags.slice(0, 4).map((t) => (
            <span key={t} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--muted)", color: "var(--muted-foreground)" }}>#{t}</span>
          ))}
        </div>
      )}
      {(contact.last_booking_at || contact.next_booking_at) && (
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 4 }}>
          <Calendar size={11} aria-hidden /> {contact.next_booking_at ? `Prochain : ${new Date(contact.next_booking_at).toLocaleDateString("fr-CH")}` : `Dernier : ${new Date(contact.last_booking_at!).toLocaleDateString("fr-CH")}`}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button onClick={onOpen} aria-label="Ouvrir la fiche"
          style={{ flex: 1, padding: "8px 10px", minHeight: 36, borderRadius: 8, background: "var(--primary)", border: "none", color: "white", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Ouvrir</button>
        <button onClick={onEdit} aria-label="Modifier" style={{ padding: "8px 10px", minHeight: 36, borderRadius: 8, background: "transparent", border: "1px solid var(--border)", color: "var(--foreground)", cursor: "pointer", fontSize: 12 }}>Modifier</button>
        <button onClick={onDelete} aria-label="Supprimer" style={{ padding: "8px 10px", minHeight: 36, borderRadius: 8, background: "transparent", border: "1px solid var(--border)", color: "#ef4444", cursor: "pointer" }}>
          <Trash2 size={14} aria-hidden />
        </button>
      </div>
    </motion.div>
  );
}

function ContactsTable({ contacts, onOpen, onEdit }: { contacts: ClientContact[]; onOpen: (c: ClientContact) => void; onEdit: (c: ClientContact) => void }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", background: "var(--card)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead style={{ background: "var(--muted)" }}>
          <tr>
            {["Nom","Contact","Statut","Tags","Prochaine séance",""].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => {
            const s = statusMeta(c.relation_status);
            return (
              <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 12px", color: "var(--foreground)", fontWeight: 500 }}>{c.first_name} {c.last_name}</td>
                <td style={{ padding: "10px 12px", color: "var(--muted-foreground)" }}>{c.email ?? c.phone ?? "—"}</td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: `${s.color}22`, color: s.color }}>{s.label}</span>
                </td>
                <td style={{ padding: "10px 12px", color: "var(--muted-foreground)" }}>{(c.tags ?? []).slice(0, 3).map((t) => `#${t}`).join(" ")}</td>
                <td style={{ padding: "10px 12px", color: "var(--muted-foreground)" }}>{c.next_booking_at ? new Date(c.next_booking_at).toLocaleDateString("fr-CH") : "—"}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>
                  <button onClick={() => onOpen(c)} style={{ padding: "6px 12px", minHeight: 32, borderRadius: 8, background: "var(--primary)", border: "none", color: "white", fontSize: 12, cursor: "pointer", marginRight: 4 }}>Ouvrir</button>
                  <button onClick={() => onEdit(c)} style={{ padding: "6px 12px", minHeight: 32, borderRadius: 8, background: "transparent", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 12, cursor: "pointer" }}>Modifier</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ContactDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const detailFn = useServerFn(getContactDetail);
  const noteFn = useServerFn(addContactNote);
  const reminderFn = useServerFn(createContactReminder);

  const detailQ = useQuery({ queryKey: ["crm-th","contact", id], queryFn: () => detailFn({ data: { id } }) });
  const [note, setNote] = useState("");

  const addReminder = async (days: number, title: string) => {
    await reminderFn({ data: { contactId: id, title, daysFromNow: days } });
    qc.invalidateQueries({ queryKey: ["crm-th","contact", id] });
    toast.success("Rappel créé");
  };

  const c = detailQ.data?.contact;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50 }}
    >
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 220 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-label="Fiche contact"
        style={{
          position: "absolute", top: 0, right: 0, bottom: 0, width: "min(560px, 100%)",
          background: "var(--background)", borderLeft: "1px solid var(--border)",
          padding: 22, overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--foreground)" }}>Fiche contact</h3>
          <button onClick={onClose} aria-label="Fermer" style={{ background: "transparent", border: "none", color: "var(--muted-foreground)", cursor: "pointer", padding: 4 }}><X size={18} aria-hidden /></button>
        </div>
        {detailQ.isLoading || !c ? (
          <p style={{ color: "var(--muted-foreground)" }}>Chargement…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)" }}>{c.first_name} {c.last_name}</div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                {c.email && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Mail size={11} aria-hidden /> {c.email}</span>}
                {c.phone && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Phone size={11} aria-hidden /> {c.phone}</span>}
                {c.session_type && <span>Type : {c.session_type}</span>}
              </div>
              {c.tags?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                  {c.tags.map((t) => (
                    <span key={t} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "var(--muted)", color: "var(--muted-foreground)", display: "inline-flex", alignItems: "center", gap: 4 }}><TagIcon size={10} aria-hidden /> {t}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Rappels rapides */}
            <div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Rappels rapides</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <button onClick={() => addReminder(7, "Relancer ce contact")}
                  style={{ padding: "8px 12px", minHeight: 40, borderRadius: 10, background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)", cursor: "pointer", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <BellPlus size={12} aria-hidden /> Relancer dans 7j
                </button>
                <button onClick={() => addReminder(14, "Reprendre contact")}
                  style={{ padding: "8px 12px", minHeight: 40, borderRadius: 10, background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)", cursor: "pointer", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <BellPlus size={12} aria-hidden /> Reprendre contact (14j)
                </button>
                <button onClick={() => addReminder(30, "Proposer une nouvelle séance")}
                  style={{ padding: "8px 12px", minHeight: 40, borderRadius: 10, background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)", cursor: "pointer", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <BellPlus size={12} aria-hidden /> Nouvelle séance (30j)
                </button>
              </div>
            </div>

            {/* Ajout note */}
            <div>
              <label htmlFor="contact-note" style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Ajouter une note privée</label>
              <textarea id="contact-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                style={{ width: "100%", padding: 10, borderRadius: 10, background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 13, resize: "vertical" }} />
              <button disabled={!note.trim()}
                onClick={async () => { await noteFn({ data: { id, body: note.trim() } }); setNote(""); qc.invalidateQueries({ queryKey: ["crm-th","contact", id] }); toast.success("Note ajoutée"); }}
                style={{ marginTop: 8, padding: "8px 14px", minHeight: 40, borderRadius: 10, background: "var(--primary)", border: "none", color: "white", fontSize: 13, cursor: note.trim() ? "pointer" : "not-allowed", opacity: note.trim() ? 1 : 0.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Send size={12} aria-hidden /> Enregistrer
              </button>
              {c.private_notes && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "var(--muted)", fontSize: 12, color: "var(--foreground)", whiteSpace: "pre-wrap" }}>
                  <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 4, textTransform: "uppercase" }}>Notes privées</div>
                  {c.private_notes}
                </div>
              )}
            </div>

            {/* Timeline */}
            <div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Timeline</div>
              {detailQ.data!.activities.length === 0 ? (
                <p style={{ color: "var(--muted-foreground)", fontSize: 12 }}>Aucune activité.</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {detailQ.data!.activities.map((a) => (
                    <li key={a.id} style={{ borderLeft: "2px solid var(--primary)", paddingLeft: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{a.title}</div>
                      {a.body && <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, whiteSpace: "pre-wrap" }}>{a.body}</div>}
                      <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>{new Date(a.occurred_at).toLocaleString("fr-CH")}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Tâches */}
            <div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Rappels programmés</div>
              {detailQ.data!.tasks.length === 0 ? (
                <p style={{ color: "var(--muted-foreground)", fontSize: 12 }}>Aucun rappel.</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  {detailQ.data!.tasks.map((t) => (
                    <li key={t.id} style={{ padding: 10, borderRadius: 10, background: "var(--muted)", fontSize: 12, color: "var(--foreground)", display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span>{t.title}</span>
                      <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>{t.due_at ? new Date(t.due_at).toLocaleDateString("fr-CH") : "—"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function ContactForm({ contact, onClose, onSubmit }: { contact: ClientContact | null; onClose: () => void; onSubmit: (p: any) => Promise<void> }) {
  const [form, setForm] = useState({
    first_name: contact?.first_name ?? "",
    last_name: contact?.last_name ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    session_type: contact?.session_type ?? "",
    relation_status: contact?.relation_status ?? "prospect",
    tags: contact?.tags ?? [],
    private_notes: contact?.private_notes ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const toggleTag = (t: string) => set("tags", form.tags.includes(t) ? form.tags.filter((x: string) => x !== t) : [...form.tags, t]);
  const valid = form.first_name.trim() && form.last_name.trim();

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <motion.form
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid || submitting) return;
          setSubmitting(true);
          try {
            const payload: any = { ...form };
            if (contact) payload.id = contact.id;
            await onSubmit(payload);
          } finally { setSubmitting(false); }
        }}
        role="dialog" aria-label={contact ? "Modifier le contact" : "Nouveau contact"}
        style={{ width: "min(560px, 100%)", maxHeight: "90vh", overflowY: "auto", background: "var(--background)", border: "1px solid var(--border)", borderRadius: 16, padding: 22, display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--foreground)" }}>{contact ? "Modifier le contact" : "Nouveau contact"}</h3>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{ background: "transparent", border: "none", color: "var(--muted-foreground)", cursor: "pointer", padding: 4 }}><X size={18} aria-hidden /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <TField label="Prénom *" value={form.first_name} onChange={(v) => set("first_name", v)} required />
          <TField label="Nom *" value={form.last_name} onChange={(v) => set("last_name", v)} required />
          <TField label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
          <TField label="Téléphone" value={form.phone} onChange={(v) => set("phone", v)} />
          <TField label="Type de séance" value={form.session_type} onChange={(v) => set("session_type", v)} />
          <div>
            <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Statut relation</label>
            <select value={form.relation_status} onChange={(e) => set("relation_status", e.target.value)}
              style={{ width: "100%", minHeight: 40, padding: "8px 10px", borderRadius: 8, background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 13 }}>
              {RELATION_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Tags</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
            {TAG_PRESETS.map((t) => {
              const on = form.tags.includes(t);
              return (
                <button type="button" key={t} onClick={() => toggleTag(t)} aria-pressed={on}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: on ? "var(--primary)" : "transparent", color: on ? "white" : "var(--foreground)", fontSize: 12, cursor: "pointer" }}>
                  #{t}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Ajouter un tag personnalisé"
              style={{ flex: 1, minHeight: 36, padding: "6px 10px", borderRadius: 8, background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 12 }} />
            <button type="button" onClick={() => { if (tagInput.trim()) { toggleTag(tagInput.trim()); setTagInput(""); } }}
              style={{ padding: "6px 12px", minHeight: 36, borderRadius: 8, background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)", cursor: "pointer", fontSize: 12 }}>Ajouter</button>
          </div>
          {form.tags.filter((t: string) => !TAG_PRESETS.includes(t)).length > 0 && (
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {form.tags.filter((t: string) => !TAG_PRESETS.includes(t)).map((t: string) => (
                <span key={t} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "var(--primary)", color: "white", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  #{t}
                  <button type="button" onClick={() => toggleTag(t)} aria-label={`Retirer ${t}`} style={{ background: "transparent", border: "none", color: "white", cursor: "pointer", padding: 0, display: "inline-flex" }}><X size={10} aria-hidden /></button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Notes privées</label>
          <textarea value={form.private_notes} onChange={(e) => set("private_notes", e.target.value)} rows={3}
            style={{ width: "100%", padding: 10, borderRadius: 8, background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 13, resize: "vertical" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
          <button type="button" onClick={onClose} style={{ padding: "10px 16px", minHeight: 44, borderRadius: 10, background: "transparent", border: "1px solid var(--border)", color: "var(--foreground)", cursor: "pointer", fontSize: 13 }}>Annuler</button>
          <button type="submit" disabled={!valid || submitting} style={{ padding: "10px 16px", minHeight: 44, borderRadius: 10, background: "var(--primary)", border: "none", color: "white", fontWeight: 600, cursor: valid && !submitting ? "pointer" : "not-allowed", opacity: valid && !submitting ? 1 : 0.5, fontSize: 13 }}>
            {contact ? "Mettre à jour" : "Créer"}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

function TField({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>{label}</label>
      <input type={type} value={value} required={required} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", minHeight: 40, padding: "8px 10px", borderRadius: 8, background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 13 }} />
    </div>
  );
}