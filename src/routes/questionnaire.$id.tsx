import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ClipboardList, CheckCircle2 } from "lucide-react";
import {
  getPublicQuestionnaire, submitPublicQuestionnaire,
} from "@/lib/questionnaires.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  RadioGroup, RadioGroupItem,
} from "@/components/ui/radio-group";

export const Route = createFileRoute("/questionnaire/$id")({
  component: Page,
  head: () => ({ meta: [
    { title: "Questionnaire — Holiswiss" },
    { name: "description", content: "Répondez au questionnaire envoyé par votre thérapeute." },
    { name: "robots", content: "noindex,nofollow" },
  ]}),
});

type Q = {
  id: string; ordre: number; obligatoire: boolean;
  type_reponse: "texte"|"textarea"|"choix_unique"|"choix_multiple"|"echelle"|"oui_non"|"date";
  question: string; options: any;
};

function Page() {
  const { id } = Route.useParams();
  const loadFn = useServerFn(getPublicQuestionnaire);
  const submitFn = useServerFn(submitPublicQuestionnaire);

  const [q, setQ] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try { setQ(await loadFn({ data: { id } })); }
      catch (e: any) { setError(e.message ?? "Erreur"); }
    })();
  }, [id]);

  function setAnswer(k: string, v: any) { setAnswers((s) => ({ ...s, [k]: v })); }

  async function submit() {
    if (!name.trim()) { toast.error("Nom requis"); return; }
    const questions = (q?.questionnaire_questions ?? []) as Q[];
    for (const qq of questions) {
      if (qq.obligatoire) {
        const v = answers[qq.question];
        const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
        if (empty) { toast.error(`Question obligatoire: ${qq.question}`); return; }
      }
    }
    setSubmitting(true);
    try {
      await submitFn({ data: {
        questionnaire_id: q.id,
        therapist_id: q.therapist_id,
        patient_name: name.trim(),
        patient_email: email.trim() || null,
        reponses: answers,
      } });
      setDone(true);
    } catch (e: any) { toast.error(e.message ?? "Erreur"); }
    finally { setSubmitting(false); }
  }

  if (error) return (
    <main className="max-w-xl mx-auto p-6">
      <div className="border rounded-lg p-6 text-center">
        <h1 className="text-lg font-semibold">Questionnaire indisponible</h1>
        <p className="text-sm text-muted-foreground mt-2">{error}</p>
      </div>
    </main>
  );
  if (!q) return <main className="max-w-xl mx-auto p-6 text-sm text-muted-foreground">Chargement…</main>;

  if (done) return (
    <main className="max-w-xl mx-auto p-6">
      <div className="border rounded-lg p-8 text-center bg-surface">
        <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 mb-3" />
        <h1 className="text-xl font-semibold">Merci !</h1>
        <p className="text-sm text-muted-foreground mt-2">Vos réponses ont bien été transmises à votre thérapeute.</p>
      </div>
    </main>
  );

  const questions = (q.questionnaire_questions ?? []) as Q[];

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" /> {q.titre}
        </h1>
        {q.description && <p className="text-sm text-muted-foreground mt-2">{q.description}</p>}
      </header>

      <section className="grid gap-3 sm:grid-cols-2 border rounded-lg p-4 bg-surface">
        <div><Label>Nom complet *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label>Email (optionnel)</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      </section>

      <section className="space-y-5">
        {questions.map((qq) => (
          <div key={qq.id} className="border rounded-lg p-4 bg-white">
            <Label className="font-medium">
              {qq.question}{qq.obligatoire && <span className="text-red-500"> *</span>}
            </Label>
            <div className="mt-3">
              <QuestionInput qq={qq} value={answers[qq.question]} onChange={(v) => setAnswer(qq.question, v)} />
            </div>
          </div>
        ))}
      </section>

      <Button className="w-full" onClick={submit} disabled={submitting}>
        {submitting ? "Envoi…" : "Envoyer mes réponses"}
      </Button>
    </main>
  );
}

function QuestionInput({ qq, value, onChange }: { qq: Q; value: any; onChange: (v: any) => void }) {
  switch (qq.type_reponse) {
    case "texte":
      return <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "textarea":
      return <Textarea rows={4} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "date":
      return <Input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "oui_non":
      return (
        <RadioGroup value={value ?? ""} onValueChange={onChange} className="flex gap-4">
          <div className="flex items-center gap-2"><RadioGroupItem value="oui" id={`${qq.id}-o`} /><Label htmlFor={`${qq.id}-o`}>Oui</Label></div>
          <div className="flex items-center gap-2"><RadioGroupItem value="non" id={`${qq.id}-n`} /><Label htmlFor={`${qq.id}-n`}>Non</Label></div>
        </RadioGroup>
      );
    case "echelle":
      return (
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button"
              onClick={() => onChange(n)}
              className={`h-10 w-10 rounded border text-sm font-medium ${value === n ? "bg-primary text-white border-primary" : "hover:bg-muted"}`}>
              {n}
            </button>
          ))}
        </div>
      );
    case "choix_unique": {
      const opts: string[] = Array.isArray(qq.options) ? qq.options : [];
      return (
        <RadioGroup value={value ?? ""} onValueChange={onChange} className="space-y-2">
          {opts.map((o) => (
            <div key={o} className="flex items-center gap-2">
              <RadioGroupItem value={o} id={`${qq.id}-${o}`} />
              <Label htmlFor={`${qq.id}-${o}`}>{o}</Label>
            </div>
          ))}
        </RadioGroup>
      );
    }
    case "choix_multiple": {
      const opts: string[] = Array.isArray(qq.options) ? qq.options : [];
      const arr: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {opts.map((o) => {
            const checked = arr.includes(o);
            return (
              <div key={o} className="flex items-center gap-2">
                <Checkbox id={`${qq.id}-${o}`} checked={checked}
                  onCheckedChange={(v) => {
                    if (v) onChange([...arr, o]);
                    else onChange(arr.filter((x) => x !== o));
                  }} />
                <Label htmlFor={`${qq.id}-${o}`}>{o}</Label>
              </div>
            );
          })}
        </div>
      );
    }
  }
}