import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Download, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  listContactNotes, upsertSessionNote, deleteSessionNote, type ContactNote,
} from "@/lib/crm-therapist.functions";

type Form = {
  id?: string;
  session_date: string;
  title: string;
  template: "free" | "soap";
  content: string;
  soap_subjective: string;
  soap_objective: string;
  soap_assessment: string;
  soap_plan: string;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const empty = (): Form => ({
  session_date: todayISO(),
  title: "",
  template: "free",
  content: "",
  soap_subjective: "",
  soap_objective: "",
  soap_assessment: "",
  soap_plan: "",
});

const fromNote = (n: ContactNote): Form => ({
  id: n.id,
  session_date: n.session_date,
  title: n.title ?? "",
  template: n.template,
  content: n.content ?? "",
  soap_subjective: n.soap_subjective ?? "",
  soap_objective: n.soap_objective ?? "",
  soap_assessment: n.soap_assessment ?? "",
  soap_plan: n.soap_plan ?? "",
});

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString("fr-CH", { day: "2-digit", month: "long", year: "numeric" }); }
  catch { return d; }
}

function exportPdf(contactName: string, notes: ContactNote[]) {
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) { toast.error("Veuillez autoriser les pop-ups pour exporter"); return; }
  const esc = (s: string | null | undefined) =>
    (s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  const sections = notes.map((n) => `
    <article class="note">
      <header><h2>${esc(n.title || "Séance")}</h2><time>${fmtDate(n.session_date)}</time></header>
      ${n.template === "soap" ? `
        <section><h3>S — Subjectif</h3><p>${esc(n.soap_subjective)}</p></section>
        <section><h3>O — Objectif</h3><p>${esc(n.soap_objective)}</p></section>
        <section><h3>A — Évaluation</h3><p>${esc(n.soap_assessment)}</p></section>
        <section><h3>P — Plan</h3><p>${esc(n.soap_plan)}</p></section>
      ` : `<section><p>${esc(n.content)}</p></section>`}
    </article>`).join("\n");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Notes — ${esc(contactName)}</title>
    <style>
      body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#222;max-width:780px;margin:40px auto;padding:0 24px;line-height:1.5}
      h1{font-size:22px;margin:0 0 4px;border-bottom:2px solid #6B7B5E;padding-bottom:8px}
      .meta{color:#666;font-size:12px;margin-bottom:24px}
      .note{margin:0 0 28px;padding:16px 18px;border:1px solid #ddd;border-radius:8px;page-break-inside:avoid}
      .note header{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:10px}
      .note h2{font-size:15px;margin:0;color:#6B7B5E}
      .note time{font-size:12px;color:#666}
      .note h3{font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#6B7B5E;margin:10px 0 4px}
      .note p{margin:0 0 6px;white-space:pre-wrap;font-size:13px}
      @media print{body{margin:20px}}
    </style></head><body>
    <h1>Notes de séance — ${esc(contactName)}</h1>
    <div class="meta">Exporté le ${new Date().toLocaleDateString("fr-CH")} · ${notes.length} séance(s)</div>
    ${sections || "<p>Aucune note.</p>"}
    <script>window.onload=()=>setTimeout(()=>window.print(),200)</script>
    </body></html>`);
  w.document.close();
}

export default function SessionNotesPanel({ contactId, contactName }: { contactId: string; contactName: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listContactNotes);
  const upsertFn = useServerFn(upsertSessionNote);
  const delFn = useServerFn(deleteSessionNote);

  const q = useQuery({
    queryKey: ["session-notes", contactId],
    queryFn: () => listFn({ data: { contact_id: contactId } }),
  });

  const [editing, setEditing] = useState<Form | null>(null);

  const saveMut = useMutation({
    mutationFn: () => upsertFn({ data: { ...editing!, contact_id: contactId,
      title: editing!.title || null,
      content: editing!.content || null,
      soap_subjective: editing!.soap_subjective || null,
      soap_objective: editing!.soap_objective || null,
      soap_assessment: editing!.soap_assessment || null,
      soap_plan: editing!.soap_plan || null,
    } }),
    onSuccess: () => { toast.success("Note enregistrée"); setEditing(null); qc.invalidateQueries({ queryKey: ["session-notes", contactId] }); qc.invalidateQueries({ queryKey: ["crm-th","notes"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Note supprimée"); qc.invalidateQueries({ queryKey: ["session-notes", contactId] }); qc.invalidateQueries({ queryKey: ["crm-th","notes"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const notes = q.data ?? [];
  const set = (k: keyof Form, v: any) => setEditing((p) => p ? { ...p, [k]: v } : p);

  return (
    <div className="space-y-3 border-t border-border/40 pt-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Notes de séance</Label>
        <div className="flex gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={() => exportPdf(contactName, notes)} disabled={notes.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1" /> PDF
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(empty())}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nouvelle séance
          </Button>
        </div>
      </div>

      {editing && (
        <div className="rounded-lg border border-primary/40 bg-background p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary">{editing.id ? "Modifier la séance" : "Nouvelle séance"}</span>
            <button type="button" onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Date de séance</Label>
              <Input type="date" value={editing.session_date} onChange={(e) => set("session_date", e.target.value)} className="bg-surface border-border/60 h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Modèle</Label>
              <div className="flex gap-1">
                {(["free","soap"] as const).map(t => (
                  <button key={t} type="button" onClick={() => set("template", t)}
                    className={`flex-1 text-xs h-8 rounded-md border transition ${editing.template === t ? "bg-primary text-primary-foreground border-primary" : "bg-surface border-border/60 text-muted-foreground hover:text-foreground"}`}>
                    {t === "free" ? "Libre" : "SOAP"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Titre (optionnel)</Label>
            <Input value={editing.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex : Séance 3 — relaxation" className="bg-surface border-border/60 h-8" />
          </div>
          {editing.template === "free" ? (
            <div className="space-y-1">
              <Label className="text-xs">Contenu</Label>
              <Textarea value={editing.content} onChange={(e) => set("content", e.target.value)} rows={5} className="bg-surface border-border/60 resize-none" placeholder="Observations, ressenti, exercices…" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {([
                ["soap_subjective", "S — Subjectif", "Ce que le patient rapporte"],
                ["soap_objective", "O — Objectif", "Observations cliniques mesurables"],
                ["soap_assessment", "A — Évaluation", "Analyse, hypothèses"],
                ["soap_plan", "P — Plan", "Actions, prochaines étapes"],
              ] as const).map(([k, lab, ph]) => (
                <div key={k} className="space-y-1">
                  <Label className="text-xs">{lab}</Label>
                  <Textarea value={editing[k]} onChange={(e) => set(k, e.target.value)} rows={2} className="bg-surface border-border/60 resize-none text-sm" placeholder={ph} />
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Annuler</Button>
            <Button type="button" size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? "…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {q.isLoading && <p className="text-xs text-muted-foreground">Chargement…</p>}
        {!q.isLoading && notes.length === 0 && <p className="text-xs text-muted-foreground">Aucune séance pour ce client.</p>}
        {notes.map((n) => (
          <div key={n.id} className="text-sm bg-background rounded-lg p-2.5 border border-border/40">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-primary">{fmtDate(n.session_date)}</span>
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{n.template === "soap" ? "SOAP" : "Libre"}</span>
                  {n.title && <span className="text-xs text-foreground font-medium truncate">{n.title}</span>}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button type="button" onClick={() => setEditing(fromNote(n))} className="text-muted-foreground hover:text-foreground p-1"><Pencil className="h-3 w-3" /></button>
                <button type="button" onClick={() => { if (confirm("Supprimer cette note ?")) delMut.mutate(n.id); }} className="text-muted-foreground hover:text-red-400 p-1"><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
            {n.template === "soap" ? (
              <div className="space-y-1 text-xs text-foreground/90">
                {n.soap_subjective && <p><span className="text-muted-foreground font-semibold">S :</span> {n.soap_subjective}</p>}
                {n.soap_objective && <p><span className="text-muted-foreground font-semibold">O :</span> {n.soap_objective}</p>}
                {n.soap_assessment && <p><span className="text-muted-foreground font-semibold">A :</span> {n.soap_assessment}</p>}
                {n.soap_plan && <p><span className="text-muted-foreground font-semibold">P :</span> {n.soap_plan}</p>}
              </div>
            ) : (
              n.content && <p className="text-xs text-foreground/90 whitespace-pre-wrap">{n.content}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}