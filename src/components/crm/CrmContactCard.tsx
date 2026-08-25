import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Activity, Archive, BadgeCheck, CalendarDays, Copy, ExternalLink, FileText, Gauge,
  History, Mail, MessageSquare, Receipt, Star, Users, X,
} from "lucide-react";
import { getCrmContactCard, getCrmContactTab, updateCrmContact, previewCrmContactEmail, sendCrmContactEmail, archiveCrmContact } from "@/lib/crm-card.functions";
import { addCrmNote, createCrmTask } from "@/lib/crm.functions";
import { TEMPLATE_OPTIONS } from "@/lib/custom-email-templates.shared";
import { CRM_STATUS, crmBtn, crmBtnDanger, crmBtnGhost, crmCard, crmInput, crmLabel, fmtDate, fmtDateTime, healthColor } from "./crm-ui";

type TabId =
  | "overview" | "info" | "notes" | "emails" | "activities" | "events"
  | "articles" | "health" | "reviews" | "billing" | "bookings" | "history";

const TABS: { id: TabId; label: string; icon: typeof Users }[] = [
  { id: "overview", label: "Vue d'ensemble", icon: Gauge },
  { id: "info", label: "Informations", icon: Users },
  { id: "notes", label: "Notes", icon: MessageSquare },
  { id: "emails", label: "Emails", icon: Mail },
  { id: "activities", label: "Activités", icon: Activity },
  { id: "events", label: "Événements", icon: CalendarDays },
  { id: "articles", label: "Articles", icon: FileText },
  { id: "health", label: "Santé du profil", icon: BadgeCheck },
  { id: "reviews", label: "Avis", icon: Star },
  { id: "billing", label: "Abonnement", icon: Receipt },
  { id: "bookings", label: "Réservations", icon: CalendarDays },
  { id: "history", label: "Historique", icon: History },
];

const REMOTE_TABS = new Set<TabId>(["notes","emails","activities","events","articles","reviews","billing","bookings","history"]);

export function CrmContactCard({
  leadId,
  onClose,
  onShowDuplicates,
}: {
  leadId: string;
  onClose: () => void;
  onShowDuplicates: (leadId: string) => void;
}) {
  const qc = useQueryClient();
  const cardFn = useServerFn(getCrmContactCard);
  const tabFn = useServerFn(getCrmContactTab);
  const updateFn = useServerFn(updateCrmContact);
  const noteFn = useServerFn(addCrmNote);
  const taskFn = useServerFn(createCrmTask);
  const archiveFn = useServerFn(archiveCrmContact);
  const [tab, setTab] = useState<TabId>("overview");
  const [emailOpen, setEmailOpen] = useState(false);

  const card = useQuery({ queryKey: ["crm","card", leadId], queryFn: () => cardFn({ data: { leadId } }) });

  const tabQ = useQuery({
    queryKey: ["crm","card-tab", leadId, tab],
    queryFn: () => tabFn({ data: { leadId, tab: tab as any } }),
    enabled: REMOTE_TABS.has(tab),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["crm","card", leadId] });
    qc.invalidateQueries({ queryKey: ["crm","card-tab", leadId] });
    qc.invalidateQueries({ queryKey: ["crm","contacts"] });
  };

  const statusMut = useMutation({
    mutationFn: (status: string) => updateFn({ data: { leadId, patch: { status: status as any } } }),
    onSuccess: () => { refresh(); toast.success("Statut mis à jour"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (card.isLoading) return <div style={{ ...crmCard, color: "#94a3b8" }}>Chargement de la fiche…</div>;
  if (card.isError) return <div style={{ ...crmCard, color: "#fecaca" }}>Erreur : {(card.error as Error).message}</div>;

  const lead = card.data!.lead as any;
  const th = card.data!.therapist as any;
  const health = card.data!.health as any;
  const counts = card.data!.counts;
  const s = CRM_STATUS[lead.status] ?? CRM_STATUS.new;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* EN-TÊTE */}
      <div style={{ ...crmCard, padding: 18 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
          {th?.photo_url ? (
            <img src={th.photo_url} alt="" width={64} height={64} style={{ width: 64, height: 64, borderRadius: 16, objectFit: "cover" }} />
          ) : (
            <span aria-hidden style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(124,58,237,0.3)", display: "grid", placeItems: "center", fontSize: 22, fontWeight: 700, color: "white" }}>
              {(lead.first_name?.[0] ?? "?").toUpperCase()}
            </span>
          )}
          <div style={{ flex: "1 1 260px", minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "white" }}>{lead.first_name} {lead.last_name}</h2>
            <div style={{ color: "#cbd5e1", fontSize: 13, marginTop: 3 }}>
              {th?.title ?? lead.specialty ?? "Profession non renseignée"}
              {(th?.city || lead.canton) && <> · {[th?.city, lead.canton ?? th?.canton].filter(Boolean).join(", ")}</>}
            </div>
            <div style={{ color: "#94a3b8", fontSize: 12.5, marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {lead.email && <span><Mail size={11} aria-hidden /> {lead.email}</span>}
              {lead.phone && <span>{lead.phone}</span>}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              <Chip label={s.label} color={s.color} />
              {th && <Chip label={`Profil ${th.status}`} color={th.status === "active" ? "#34d399" : "#facc15"} />}
              {th?.verified && <Chip label="Vérifié" color="#5cc8fa" />}
              {th?.subscription_plan && <Chip label={th.subscription_plan} color="#f472b6" />}
              {health?.score_total != null && <Chip label={`Santé ${health.score_total}`} color={healthColor(health.score_total)} />}
              {lead.archived_at && <Chip label="Archivée" color="#94a3b8" />}
            </div>
            <div style={{ ...crmLabel, marginTop: 10, display: "flex", gap: 14, flexWrap: "wrap" }}>
              <span>Source : {lead.source}</span>
              <span>Inscrit le {fmtDate(lead.created_at)}</span>
              <span>Dernière activité {fmtDate(lead.updated_at)}</span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer la fiche" style={{ ...crmBtnGhost, minHeight: 40, padding: "8px 10px" }}><X size={16} aria-hidden /></button>
        </div>

        {/* ACTIONS */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <select
            aria-label="Statut CRM"
            value={lead.status}
            onChange={(e) => statusMut.mutate(e.target.value)}
            style={crmInput}
          >
            {Object.entries(CRM_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button style={crmBtn} onClick={() => setEmailOpen(true)} disabled={!lead.email}>Envoyer un email</button>
          <button
            style={crmBtnGhost}
            onClick={async () => {
              const body = window.prompt("Note interne (non visible publiquement)");
              if (!body?.trim()) return;
              await noteFn({ data: { entityType: "lead", entityId: leadId, body } });
              refresh();
              toast.success("Note ajoutée");
            }}
          >
            Ajouter une note
          </button>
          <button
            style={crmBtnGhost}
            onClick={async () => {
              const title = window.prompt("Intitulé de l'activité / tâche (appel, rappel, relance…)");
              if (!title?.trim()) return;
              await taskFn({ data: { entityType: "lead", entityId: leadId, title } });
              refresh();
              toast.success("Activité créée");
            }}
          >
            Créer une activité
          </button>
          {th?.slug && (
            <a href={`/fr/therapeutes/${th.slug}`} target="_blank" rel="noreferrer" style={{ ...crmBtnGhost, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ExternalLink size={13} aria-hidden /> Profil public
            </a>
          )}
          <button style={crmBtnGhost} onClick={() => onShowDuplicates(leadId)}>
            <Copy size={13} aria-hidden style={{ verticalAlign: -2, marginRight: 6 }} /> Voir les doublons
          </button>
          <button
            style={crmBtnDanger}
            onClick={async () => {
              const archived = !lead.archived_at;
              if (!window.confirm(archived ? "Archiver cette fiche ? Elle reste consultable et restaurable." : "Réactiver cette fiche ?")) return;
              await archiveFn({ data: { leadId, archived } });
              refresh();
              toast.success(archived ? "Fiche archivée" : "Fiche réactivée");
            }}
          >
            <Archive size={13} aria-hidden style={{ verticalAlign: -2, marginRight: 6 }} />
            {lead.archived_at ? "Réactiver" : "Archiver"}
          </button>
        </div>
      </div>

      {/* ONGLETS */}
      <div role="tablist" aria-label="Sections de la fiche" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              style={{
                ...crmBtnGhost,
                minHeight: 40,
                padding: "8px 12px",
                background: active ? "rgba(124,58,237,0.28)" : "transparent",
                borderColor: active ? "rgba(124,58,237,0.55)" : "rgba(255,255,255,0.14)",
                fontSize: 12.5,
              }}
            >
              <t.icon size={13} aria-hidden style={{ verticalAlign: -2, marginRight: 6 }} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={crmCard}>
        {tab === "overview" && <Overview lead={lead} th={th} health={health} counts={counts} merged={card.data!.mergedFiches} />}
        {tab === "info" && <Info lead={lead} th={th} />}
        {tab === "health" && <Health health={health} />}
        {REMOTE_TABS.has(tab) && (
          tabQ.isLoading ? <div style={{ color: "#94a3b8" }}>Chargement…</div>
          : tabQ.isError ? <div style={{ color: "#fecaca" }}>Erreur : {(tabQ.error as Error).message}</div>
          : <RemoteTab data={tabQ.data as any} />
        )}
      </div>

      {emailOpen && <EmailComposer leadId={leadId} onClose={() => { setEmailOpen(false); refresh(); }} />}
    </motion.div>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: `${color}22`, color, fontWeight: 600 }}>{label}</span>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ ...crmLabel, flex: "0 0 190px" }}>{label}</span>
      <span style={{ color: "#e2e8f0", fontSize: 13, minWidth: 0, wordBreak: "break-word" }}>{value ?? "—"}</span>
    </div>
  );
}

function Overview({ lead, th, health, counts, merged }: any) {
  const nextAction =
    !th ? "Aucun profil rattaché — relancer pour finaliser l'inscription."
    : th.status === "pending" ? "Profil en attente de validation — vérifier et activer."
    : health?.score_total != null && health.score_total < 50 ? "Santé de profil faible — envoyer le récapitulatif d'amélioration."
    : !lead.last_contact_at ? "Jamais contacté — planifier une première prise de contact."
    : "Aucune action urgente.";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        {[
          ["Activités", counts.activities], ["Emails", counts.emails], ["Événements", counts.events],
          ["Articles", counts.articles], ["Avis", counts.reviews], ["Réservations", counts.bookings],
        ].map(([l, v]) => (
          <div key={String(l)} style={{ ...crmCard, padding: 12 }}>
            <div style={crmLabel}>{l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "white" }}>{v as number}</div>
          </div>
        ))}
      </div>
      <div style={{ ...crmCard, padding: 14, borderLeft: "3px solid #7c3aed" }}>
        <div style={crmLabel}>Prochaine action recommandée</div>
        <div style={{ color: "white", fontSize: 13.5, marginTop: 4 }}>{nextAction}</div>
      </div>
      <div>
        <Row label="Dernière interaction" value={fmtDateTime(lead.last_contact_at)} />
        <Row label="Responsable interne" value={lead.assigned_to ?? "Non attribué"} />
        <Row label="Score de complétude" value={health?.score_completude != null ? `${health.score_completude}/100` : "—"} />
        <Row label="Fiches fusionnées dans celle-ci" value={merged.length ? `${merged.length} (${merged.map((m: any) => m.source).join(", ")})` : "Aucune"} />
      </div>
    </div>
  );
}

function Info({ lead, th }: any) {
  return (
    <div>
      <Row label="Email" value={lead.email} />
      <Row label="Téléphone" value={lead.phone} />
      <Row label="Profession" value={th?.title ?? lead.specialty} />
      <Row label="Spécialités" value={th?.specialties?.join(", ")} />
      <Row label="Approches" value={th?.approaches?.join(", ")} />
      <Row label="Langues" value={th?.languages?.join(", ")} />
      <Row label="Adresse" value={[th?.address, th?.postal_code, th?.city, th?.canton].filter(Boolean).join(", ")} />
      <Row label="Modes de consultation" value={th?.consultation_modes?.join(", ")} />
      <Row label="Tarifs" value={th?.price_min ? `${th.price_min}–${th.price_max ?? "?"} ${th.currency ?? "CHF"}` : null} />
      <Row label="Réservation" value={th?.booking_note} />
      <Row label="Site web" value={th?.website ? <a href={th.website} target="_blank" rel="noreferrer" style={{ color: "#a78bfa" }}>{th.website}</a> : null} />
      <Row label="Années d'expérience" value={th?.years_experience} />
      <Row label="Newsletter" value={th ? (th.newsletter_opt_in ? "Consentement donné" : "Pas de consentement") : null} />
      <Row label="Source d'acquisition" value={lead.source} />
      <Row label="Priorité CRM" value={lead.priority} />
      <Row label="Identifiant thérapeute" value={lead.converted_therapist_id} />
    </div>
  );
}

function Health({ health }: any) {
  if (!health) return <div style={{ color: "#94a3b8" }}>Aucun score de santé calculé pour ce profil.</div>;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontSize: 34, fontWeight: 800, color: healthColor(health.score_total) }}>{health.score_total}</span>
        <span style={{ color: "#94a3b8", fontSize: 13 }}>/100 · note {health.grade ?? "—"} · calculé le {fmtDate(health.computed_at)}</span>
      </div>
      <div style={{ marginTop: 12 }}>
        <Row label="Complétude" value={health.score_completude} />
        <Row label="Contenu" value={health.score_contenu} />
        <Row label="Activité" value={health.score_activite} />
        <Row label="Visibilité" value={health.score_visibilite} />
        <Row label="Score précédent" value={health.score_previous ?? "—"} />
        <Row label="Points forts" value={(health.strengths ?? []).join(" · ") || "—"} />
        <Row label="Points à corriger" value={(health.gaps ?? []).join(" · ") || "—"} />
      </div>
    </div>
  );
}

function RemoteTab({ data }: { data: any }) {
  if (!data) return null;
  const empty = (msg: string) => <div style={{ color: "#94a3b8", fontSize: 13 }}>{msg}</div>;

  switch (data.tab) {
    case "notes":
      return data.rows.length === 0 ? empty("Aucune note interne.") : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
          {data.rows.map((n: any) => (
            <li key={n.id} style={{ ...crmCard, padding: 12 }}>
              <div style={{ ...crmLabel }}>{fmtDateTime(n.occurred_at)} · interne</div>
              <div style={{ color: "white", fontSize: 13, marginTop: 4, whiteSpace: "pre-wrap" }}>{n.body}</div>
            </li>
          ))}
        </ul>
      );
    case "emails":
      return data.rows.length === 0 ? empty("Aucun email envoyé à ce contact.") : (
        <SimpleTable
          head={["Date","Sujet","Template","Statut","Erreur"]}
          rows={data.rows.map((e: any) => [fmtDateTime(e.sent_at), e.subject, e.template_id, e.status, e.error_message ?? "—"])}
        />
      );
    case "activities":
      return data.rows.length === 0 ? empty("Aucune activité.") : (
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {data.rows.map((a: any) => (
            <li key={a.id} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ ...crmLabel, flex: "0 0 130px" }}>{fmtDateTime(a.occurred_at)}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ color: "white", fontSize: 13 }}>{a.title}</span>
                <span style={{ color: "#64748b", fontSize: 11, marginLeft: 8 }}>{a.type}</span>
                {a.body && <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 3, whiteSpace: "pre-wrap" }}>{a.body}</div>}
              </span>
            </li>
          ))}
        </ol>
      );
    case "events":
      return data.rows.length === 0 ? empty("Aucun événement.") : (
        <SimpleTable
          head={["Date","Titre","Format","Lieu","Places","Statut"]}
          rows={data.rows.map((e: any) => [fmtDate(e.event_date), e.title, e.format ?? "—", e.location ?? "—", e.seats ?? "—", e.status])}
        />
      );
    case "articles":
      return data.rows.length === 0 ? empty("Aucun article.") : (
        <SimpleTable
          head={["Titre","Statut","Soumis","Publié","Lien"]}
          rows={data.rows.map((a: any) => [
            a.titre, a.statut, fmtDate(a.date_soumission), fmtDate(a.date_publication),
            a.slug ? <a key={a.id} href={`/fr/paroles/${a.slug}`} target="_blank" rel="noreferrer" style={{ color: "#a78bfa" }}>Consulter</a> : "—",
          ])}
        />
      );
    case "reviews":
      return data.rows.length === 0 ? empty("Aucun avis.") : (
        <>
          <div style={{ ...crmLabel, marginBottom: 8 }}>Note moyenne (avis approuvés) : {data.average ?? "—"}</div>
          <SimpleTable
            head={["Date","Note","Auteur","Statut","Réponse"]}
            rows={data.rows.map((r: any) => [fmtDate(r.created_at), `${r.rating}/5`, r.author_name ?? "—", r.status, r.therapist_reply ? r.therapist_reply_status : "—"])}
          />
        </>
      );
    case "billing":
      return (
        <>
          <div style={{ ...crmLabel, marginBottom: 8 }}>Formule actuelle : {data.plan ?? "—"}</div>
          {data.rows.length === 0 ? empty("Aucune facture d'abonnement.") : (
            <SimpleTable
              head={["Date","N°","Montant","Statut","Période","Facture"]}
              rows={data.rows.map((f: any) => [
                fmtDate(f.invoice_date), f.invoice_number ?? "—",
                `${(f.amount_total ?? 0) / 100} ${(f.currency ?? "chf").toUpperCase()}`,
                f.status, `${fmtDate(f.period_start)} → ${fmtDate(f.period_end)}`,
                f.hosted_invoice_url ? <a key={f.id} href={f.hosted_invoice_url} target="_blank" rel="noreferrer" style={{ color: "#a78bfa" }}>Ouvrir</a> : "—",
              ])}
            />
          )}
        </>
      );
    case "bookings":
      return !data.stats ? empty("Aucune réservation.") : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10, marginBottom: 12 }}>
            {Object.entries(data.stats).map(([k, v]) => (
              <div key={k} style={{ ...crmCard, padding: 12 }}>
                <div style={crmLabel}>{k}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "white" }}>{v as number}</div>
              </div>
            ))}
          </div>
          <div style={{ ...crmLabel, marginBottom: 6 }}>Dernières réservations (aucune donnée client affichée)</div>
          <SimpleTable head={["Créée le","Séance","Prestation","Statut"]} rows={data.recent.map((a: any) => [fmtDate(a.created_at), fmtDateTime(a.start_time), a.service_name ?? "—", a.status])} />
        </>
      );
    case "history":
      return (
        <>
          {data.merges.length > 0 && (
            <div style={{ ...crmCard, padding: 12, marginBottom: 12 }}>
              <div style={crmLabel}>Fusions</div>
              {data.merges.map((m: any) => (
                <div key={m.id} style={{ color: "#e2e8f0", fontSize: 12.5, marginTop: 4 }}>
                  {fmtDateTime(m.created_at)} — {m.merged_lead_ids.length} fiche(s) fusionnée(s){m.reverted_at ? " · annulée" : ""}
                </div>
              ))}
            </div>
          )}
          {data.rows.length === 0 ? empty("Aucune modification enregistrée.") : (
            <SimpleTable
              head={["Date","Champ","Ancienne valeur","Nouvelle valeur","Origine"]}
              rows={data.rows.map((h: any) => [fmtDateTime(h.created_at), h.field, h.old_value ?? "—", h.new_value ?? "—", h.origin])}
            />
          )}
        </>
      );
    default:
      return null;
  }
}

function SimpleTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, color: "#e2e8f0" }}>
        <thead>
          <tr>{head.map((h) => <th key={h} scope="col" style={{ textAlign: "left", padding: "8px 10px", ...crmLabel, fontSize: 10.5 }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              {r.map((c, j) => <td key={j} style={{ padding: "8px 10px" }}>{c as React.ReactNode}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- COMPOSITION D'EMAIL ---------------- */
function EmailComposer({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const previewFn = useServerFn(previewCrmContactEmail);
  const sendFn = useServerFn(sendCrmContactEmail);
  const [templateId, setTemplateId] = useState("welcome");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{ subject: string; html: string; recipient: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const p = await previewFn({ data: { leadId, templateId, customSubject: subject || undefined, customMessage: message || undefined } });
      setPreview(p);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Envoyer un email" style={{ position: "fixed", inset: 0, background: "rgba(6,4,16,0.75)", display: "grid", placeItems: "center", padding: 16, zIndex: 1000 }}>
      <div style={{ ...crmCard, width: "min(760px, 100%)", maxHeight: "88dvh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, color: "white", fontSize: 16 }}>Envoyer un email</h3>
          <button onClick={onClose} aria-label="Fermer" style={{ ...crmBtnGhost, minHeight: 36, padding: "6px 9px" }}><X size={15} aria-hidden /></button>
        </div>

        <label style={{ display: "block", marginBottom: 10 }}>
          <span style={crmLabel}>Template</span>
          <select value={templateId} onChange={(e) => { setTemplateId(e.target.value); setPreview(null); }} style={{ ...crmInput, width: "100%", marginTop: 4 }}>
            {TEMPLATE_OPTIONS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label style={{ display: "block", marginBottom: 10 }}>
          <span style={crmLabel}>Sujet personnalisé (optionnel)</span>
          <input value={subject} onChange={(e) => { setSubject(e.target.value); setPreview(null); }} style={{ ...crmInput, width: "100%", marginTop: 4 }} />
        </label>
        <label style={{ display: "block", marginBottom: 10 }}>
          <span style={crmLabel}>Message personnalisé (optionnel)</span>
          <textarea value={message} onChange={(e) => { setMessage(e.target.value); setPreview(null); }} rows={5} style={{ ...crmInput, width: "100%", marginTop: 4, resize: "vertical" }} />
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={crmBtnGhost} onClick={load} disabled={busy}>Prévisualiser</button>
          <button
            style={crmBtnGhost}
            disabled={busy}
            onClick={async () => {
              const to = window.prompt("Adresse de test");
              if (!to) return;
              setBusy(true);
              try {
                await sendFn({ data: { leadId, templateId, customSubject: subject || undefined, customMessage: message || undefined, testTo: to } });
                toast.success("Email de test envoyé");
              } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
            }}
          >
            Envoyer un test
          </button>
          <button
            style={crmBtn}
            disabled={busy || !preview}
            onClick={async () => {
              if (!preview) return;
              if (!window.confirm(`Envoyer « ${preview.subject} » à ${preview.recipient} ?`)) return;
              setBusy(true);
              try {
                await sendFn({ data: { leadId, templateId, customSubject: subject || undefined, customMessage: message || undefined } });
                toast.success("Email envoyé et journalisé");
                onClose();
              } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
            }}
          >
            Envoyer au contact
          </button>
        </div>

        {preview && (
          <div style={{ marginTop: 14 }}>
            <div style={crmLabel}>Aperçu — {preview.subject} → {preview.recipient}</div>
            <iframe title="Aperçu de l'email" srcDoc={preview.html} style={{ width: "100%", height: 380, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, marginTop: 6, background: "white" }} />
          </div>
        )}
      </div>
    </div>
  );
}
