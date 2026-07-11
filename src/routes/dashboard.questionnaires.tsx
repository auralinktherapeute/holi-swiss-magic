import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ClipboardList, Plus, Pencil, Trash2, Eye } from "lucide-react";
import {
  listMyQuestionnaires, upsertQuestionnaire, deleteQuestionnaire,
  listMyQuestionnaireResponses, deleteQuestionnaireResponse,
  type Questionnaire, type ClientQuestionnaireResponse,
} from "@/lib/questionnaires.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/dashboard/questionnaires")({ component: Page });

type QuestionDraft = {
  id?: string;
  ordre: number;
  type_reponse: "texte" | "textarea" | "choix_unique" | "choix_multiple" | "echelle" | "oui_non" | "date";
  question: string;
  options: string; // stored as comma-separated in the form
  obligatoire: boolean;
};

const TYPE_LABELS: Record<QuestionDraft["type_reponse"], string> = {
  texte: "Texte court",
  textarea: "Texte long",
  choix_unique: "Choix unique",
  choix_multiple: "Choix multiple",
  echelle: "Échelle 1–10",
  oui_non: "Oui / Non",
  date: "Date",
};

function Page() {
  const listFn = useServerFn(listMyQuestionnaires);
  const upsertFn = useServerFn(upsertQuestionnaire);
  const delFn = useServerFn(deleteQuestionnaire);
  const listRespFn = useServerFn(listMyQuestionnaireResponses);
  const delRespFn = useServerFn(deleteQuestionnaireResponse);

  const [items, setItems] = useState<Questionnaire[]>([]);
  const [responses, setResponses] = useState<ClientQuestionnaireResponse[]>([]);
  const [editing, setEditing] = useState<Questionnaire | null>(null);
  const [open, setOpen] = useState(false);
  const [viewResp, setViewResp] = useState<ClientQuestionnaireResponse | null>(null);

  async function refresh() {
    const [q, r] = await Promise.all([listFn(), listRespFn({ data: {} })]);
    setItems(q);
    setResponses(r);
  }
  useEffect(() => { refresh(); }, []);

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" /> Questionnaires clients
          </h1>
          <p className="text-sm text-muted-foreground">
            Créez des questionnaires d'anamnèse ou de bilan pour vos clients.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nouveau questionnaire
        </Button>
      </header>

      <section>
        <h2 className="text-lg font-semibold mb-3">Mes questionnaires ({items.length})</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun questionnaire pour le moment.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((q) => (
              <div key={q.id} className="border rounded-lg p-4 bg-surface">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{q.titre}</h3>
                    <p className="text-xs text-muted-foreground">
                      {(q.questionnaire_questions?.length ?? 0)} question(s) · {q.actif ? "actif" : "inactif"}
                    </p>
                    {q.description && <p className="text-sm mt-2">{q.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(q); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      onClick={async () => {
                        if (!confirm("Supprimer ce questionnaire ?")) return;
                        await delFn({ data: { id: q.id } });
                        toast.success("Supprimé");
                        refresh();
                      }}
                    ><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Réponses reçues ({responses.length})</h2>
        {responses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune réponse pour le moment.</p>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3">Questionnaire</th>
                  <th className="text-left p-3">Client</th>
                  <th className="text-left p-3">Date</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {responses.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3">{r.questionnaires?.titre ?? "-"}</td>
                    <td className="p-3">
                      {r.crm_client_contacts
                        ? `${r.crm_client_contacts.first_name} ${r.crm_client_contacts.last_name}`
                        : r.patient_name ?? r.patient_email ?? "Anonyme"}
                    </td>
                    <td className="p-3">{new Date(r.date_soumission).toLocaleString("fr-CH")}</td>
                    <td className="p-3 text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => setViewResp(r)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost"
                        onClick={async () => {
                          if (!confirm("Supprimer cette réponse ?")) return;
                          await delRespFn({ data: { id: r.id } });
                          toast.success("Supprimée");
                          refresh();
                        }}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <QuestionnaireDialog
        open={open} onOpenChange={setOpen}
        editing={editing}
        onSaved={async () => { setOpen(false); await refresh(); }}
        upsertFn={upsertFn}
      />

      <Dialog open={!!viewResp} onOpenChange={(o) => !o && setViewResp(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Réponse : {viewResp?.questionnaires?.titre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {viewResp && Object.entries((viewResp.reponses ?? {}) as Record<string, unknown>).map(([k, v]) => (
              <div key={k} className="border-b pb-2">
                <div className="font-medium text-xs text-muted-foreground">{k}</div>
                <div className="whitespace-pre-wrap">{Array.isArray(v) ? v.join(", ") : String(v ?? "")}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuestionnaireDialog({
  open, onOpenChange, editing, onSaved, upsertFn,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  editing: Questionnaire | null;
  onSaved: () => Promise<void>;
  upsertFn: (args: any) => Promise<any>;
}) {
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [actif, setActif] = useState(true);
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitre(editing.titre);
      setDescription(editing.description ?? "");
      setActif(editing.actif);
      setQuestions((editing.questionnaire_questions ?? []).map((q, i) => ({
        id: q.id, ordre: q.ordre ?? i,
        type_reponse: q.type_reponse,
        question: q.question,
        options: Array.isArray(q.options) ? q.options.join(", ") : "",
        obligatoire: q.obligatoire,
      })));
    } else {
      setTitre(""); setDescription(""); setActif(true); setQuestions([]);
    }
  }, [open, editing]);

  function addQuestion() {
    setQuestions((qs) => [...qs, {
      ordre: qs.length, type_reponse: "texte", question: "", options: "", obligatoire: false,
    }]);
  }
  function updateQ(i: number, patch: Partial<QuestionDraft>) {
    setQuestions((qs) => qs.map((q, idx) => idx === i ? { ...q, ...patch } : q));
  }
  function removeQ(i: number) {
    setQuestions((qs) => qs.filter((_, idx) => idx !== i).map((q, idx) => ({ ...q, ordre: idx })));
  }

  async function save() {
    if (!titre.trim()) { toast.error("Titre requis"); return; }
    setSaving(true);
    try {
      await upsertFn({ data: {
        id: editing?.id,
        titre: titre.trim(),
        description: description.trim() || null,
        actif,
        questions: questions.map((q, idx) => ({
          ordre: idx,
          type_reponse: q.type_reponse,
          question: q.question.trim(),
          options: (q.type_reponse === "choix_unique" || q.type_reponse === "choix_multiple")
            ? q.options.split(",").map((o) => o.trim()).filter(Boolean)
            : null,
          obligatoire: q.obligatoire,
        })),
      } });
      toast.success("Questionnaire enregistré");
      await onSaved();
    } catch (e: any) { toast.error(e.message ?? "Erreur"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier le questionnaire" : "Nouveau questionnaire"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Titre *</Label>
            <Input value={titre} onChange={(e) => setTitre(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={actif} onCheckedChange={setActif} id="actif" />
            <Label htmlFor="actif">Actif</Label>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Questions ({questions.length})</h3>
              <Button size="sm" onClick={addQuestion}><Plus className="h-3 w-3 mr-1" /> Ajouter</Button>
            </div>
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={i} className="border rounded p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-6">#{i + 1}</span>
                    <Input placeholder="Question" value={q.question}
                      onChange={(e) => updateQ(i, { question: e.target.value })} />
                    <Button size="icon" variant="ghost" onClick={() => removeQ(i)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={q.type_reponse} onValueChange={(v: any) => updateQ(i, { type_reponse: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Switch checked={q.obligatoire}
                        onCheckedChange={(v) => updateQ(i, { obligatoire: v })}
                        id={`ob-${i}`} />
                      <Label htmlFor={`ob-${i}`}>Obligatoire</Label>
                    </div>
                  </div>
                  {(q.type_reponse === "choix_unique" || q.type_reponse === "choix_multiple") && (
                    <Input placeholder="Options séparées par des virgules"
                      value={q.options}
                      onChange={(e) => updateQ(i, { options: e.target.value })} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}