import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronUp, ChevronDown, Trash2, Plus, Pencil, X, Check } from "lucide-react";
import {
  listMyFaqs, upsertFaq, deleteFaq, reorderFaqs, setFaqEnabled,
  type TherapistFaq,
} from "@/lib/therapist-faq.functions";

const QUESTION_MAX = 200;
const ANSWER_MAX = 2000;

/**
 * Éditeur de la FAQ publique du thérapeute.
 *
 * Réordonnancement par flèches et non par glisser-déposer : le drag-and-drop est
 * inutilisable au clavier et fragile au doigt sur mobile, pour un gain nul sur
 * une liste de cinq à dix entrées.
 */
export default function FaqEditor() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["my-faqs"], queryFn: () => listMyFaqs() });
  const faqs = q.data?.faqs ?? [];
  const enabled = q.data?.enabled ?? false;

  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draftQ, setDraftQ] = useState("");
  const [draftA, setDraftA] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["my-faqs"] });

  const save = useMutation({
    mutationFn: (v: { id?: string; question: string; answer: string }) => upsertFaq({ data: v }),
    onSuccess: () => {
      toast.success("Question enregistrée");
      setEditing(null); setDraftQ(""); setDraftA("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFaq({ data: { id } }),
    onSuccess: () => { toast.success("Question supprimée"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (f: TherapistFaq) =>
      upsertFaq({ data: { id: f.id, question: f.question, answer: f.answer, is_active: !f.is_active } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: (ids: string[]) => reorderFaqs({ data: { ids } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleGlobal = useMutation({
    mutationFn: (v: boolean) => setFaqEnabled({ data: { enabled: v } }),
    onSuccess: (r) => {
      toast.success(r.enabled ? "FAQ visible sur votre fiche" : "FAQ masquée");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function shift(index: number, dir: -1 | 1) {
    const next = [...faqs];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    move.mutate(next.map((f) => f.id));
  }

  function startEdit(f: TherapistFaq) {
    setEditing(f.id); setDraftQ(f.question); setDraftA(f.answer);
  }
  function startNew() {
    setEditing("new"); setDraftQ(""); setDraftA("");
  }
  function submit() {
    const question = draftQ.trim(), answer = draftA.trim();
    if (question.length < 3) return toast.error("La question est trop courte.");
    if (answer.length < 3) return toast.error("La réponse est trop courte.");
    save.mutate(editing === "new" ? { question, answer } : { id: editing!, question, answer });
  }

  const activeCount = faqs.filter((f) => f.is_active).length;
  const live = enabled && activeCount > 0;

  return (
    <section aria-labelledby="faq-editor-title" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="faq-editor-title" className="text-lg font-semibold text-white">
            Questions fréquentes
          </h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Répondez aux questions qu'on vous pose avant un premier rendez-vous. Elles
            s'affichent sur votre fiche publique, entre vos prestations et vos avis.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Switch
            id="faq-enabled"
            checked={enabled}
            disabled={toggleGlobal.isPending || q.isLoading}
            onCheckedChange={(v) => toggleGlobal.mutate(v)}
            aria-describedby="faq-enabled-hint"
          />
          <Label htmlFor="faq-enabled" className="cursor-pointer text-sm">
            Afficher sur mon profil
          </Label>
        </div>
      </div>

      {/* L'état réel, dit sans détour : activé ne suffit pas, il faut du contenu. */}
      <p id="faq-enabled-hint" className="text-xs text-[var(--muted-foreground)]" role="status">
        {live
          ? `Visible sur votre fiche — ${activeCount} question${activeCount > 1 ? "s" : ""} publiée${activeCount > 1 ? "s" : ""}.`
          : enabled
            ? "Activée, mais rien n'est encore publié : la section reste masquée tant qu'aucune question n'est active."
            : "Masquée. Activez l'affichage pour la publier sur votre fiche."}
      </p>

      <ul className="space-y-2.5">
        {faqs.map((f, i) => (
          <li
            key={f.id}
            className={`rounded-xl border p-3 transition-colors ${
              f.is_active
                ? "border-[rgba(168,85,247,0.25)] bg-[rgba(45,27,78,0.6)]"
                : "border-white/10 bg-white/[0.03] opacity-70"
            }`}
          >
            {editing === f.id ? (
              <EditForm
                q={draftQ} a={draftA} setQ={setDraftQ} setA={setDraftA}
                onCancel={() => setEditing(null)} onSave={submit} busy={save.isPending}
              />
            ) : (
              <div className="flex items-start gap-3">
                <div className="flex flex-col gap-0.5 pt-0.5">
                  <button
                    type="button" onClick={() => shift(i, -1)} disabled={i === 0 || move.isPending}
                    aria-label={`Monter « ${f.question} »`}
                    className="rounded p-1 text-white/50 transition-colors hover:text-white disabled:opacity-25"
                  ><ChevronUp className="h-4 w-4" /></button>
                  <button
                    type="button" onClick={() => shift(i, 1)} disabled={i === faqs.length - 1 || move.isPending}
                    aria-label={`Descendre « ${f.question} »`}
                    className="rounded p-1 text-white/50 transition-colors hover:text-white disabled:opacity-25"
                  ><ChevronDown className="h-4 w-4" /></button>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{f.question}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--muted-foreground)]">{f.answer}</p>
                </div>

                <div className="flex flex-none items-center gap-1">
                  <Switch
                    checked={f.is_active}
                    onCheckedChange={() => toggleActive.mutate(f)}
                    aria-label={f.is_active ? `Masquer « ${f.question} »` : `Publier « ${f.question} »`}
                  />
                  <Button variant="ghost" size="icon" onClick={() => startEdit(f)}
                    aria-label={`Modifier « ${f.question} »`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(f.id)}
                    disabled={remove.isPending} aria-label={`Supprimer « ${f.question} »`}>
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {editing === "new" ? (
        <div className="rounded-xl border border-[rgba(168,85,247,0.25)] bg-[rgba(45,27,78,0.6)] p-3">
          <EditForm
            q={draftQ} a={draftA} setQ={setDraftQ} setA={setDraftA}
            onCancel={() => setEditing(null)} onSave={submit} busy={save.isPending}
          />
        </div>
      ) : (
        <Button variant="outline" onClick={startNew} disabled={q.isLoading}>
          <Plus className="mr-1.5 h-4 w-4" /> Ajouter une question
        </Button>
      )}

      {!q.isLoading && faqs.length === 0 && editing !== "new" && (
        <p className="text-sm text-[var(--muted-foreground)]">
          Aucune question pour l'instant. Les plus utiles portent en général sur le
          déroulement d'une séance, les tarifs et le remboursement.
        </p>
      )}
    </section>
  );
}

function EditForm({
  q, a, setQ, setA, onCancel, onSave, busy,
}: {
  q: string; a: string;
  setQ: (v: string) => void; setA: (v: string) => void;
  onCancel: () => void; onSave: () => void; busy: boolean;
}) {
  return (
    <div className="space-y-2.5">
      <div>
        <Label htmlFor="faq-q" className="text-xs">Question</Label>
        <Input
          id="faq-q" value={q} maxLength={QUESTION_MAX} autoFocus
          onChange={(e) => setQ(e.target.value)}
          placeholder="Comment se déroule une première séance ?"
        />
        <p className="mt-1 text-right text-[11px] text-white/35">{q.length} / {QUESTION_MAX}</p>
      </div>
      <div>
        <Label htmlFor="faq-a" className="text-xs">Réponse</Label>
        <Textarea
          id="faq-a" value={a} maxLength={ANSWER_MAX} rows={4}
          onChange={(e) => setA(e.target.value)}
          placeholder="La première rencontre dure environ 75 minutes…"
        />
        <p className="mt-1 text-right text-[11px] text-white/35">{a.length} / {ANSWER_MAX}</p>
      </div>
      <div className="flex gap-2">
        <Button onClick={onSave} disabled={busy}>
          <Check className="mr-1.5 h-4 w-4" /> Enregistrer
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          <X className="mr-1.5 h-4 w-4" /> Annuler
        </Button>
      </div>
    </div>
  );
}
