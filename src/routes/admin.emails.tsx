import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Send, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { useSessionState } from "@/hooks/use-session-state";

export const Route = createFileRoute("/admin/emails")({ component: Page });

type Tpl = { id: string; name: string; subject: string; trigger: string; sent: number; body: string };

const TEMPLATES: Tpl[] = [
  { id: "welcome", name: "Bienvenue thérapeute", subject: "Bienvenue sur Holiswiss 🌿", trigger: "Inscription validée", sent: 142, body: "Bonjour {{firstname}},\n\nVotre compte Holiswiss vient d'être validé. Vous pouvez désormais compléter votre profil…" },
  { id: "booking", name: "Confirmation réservation", subject: "Votre réservation est confirmée", trigger: "Réservation acceptée", sent: 1284, body: "Bonjour {{patient}},\n\nVotre rendez-vous avec {{therapist}} est confirmé pour le {{date}}…" },
  { id: "reminder", name: "Rappel rendez-vous", subject: "Rappel : rendez-vous demain", trigger: "J-1 réservation", sent: 974, body: "Bonjour {{patient}},\n\nPetit rappel : votre rendez-vous avec {{therapist}} a lieu demain à {{time}}…" },
  { id: "review", name: "Demande d'avis", subject: "Comment s'est passée votre séance ?", trigger: "J+1 rendez-vous", sent: 612, body: "Bonjour {{patient}},\n\nNous espérons que votre séance s'est bien passée. Souhaitez-vous laisser un avis ?…" },
];

function Page() {
  const [activeId, setActiveId] = useSessionState("admin.emails.activeId", TEMPLATES[0].id);
  const [drafts, setDrafts] = useSessionState<Record<string, Pick<Tpl, "subject" | "trigger" | "body">>>("admin.emails.drafts", {});
  const active = TEMPLATES.find((tpl) => tpl.id === activeId) ?? TEMPLATES[0];
  const draft = drafts[active.id] ?? { subject: active.subject, trigger: active.trigger, body: active.body };
  const updateDraft = (patch: Partial<typeof draft>) => {
    setDrafts((prev) => ({ ...prev, [active.id]: { ...draft, ...patch } }));
  };

  return (
    <div className="p-6 md:p-10 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Mail className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Templates emails</h1>
            <p className="text-muted-foreground">Powered by Brevo · {TEMPLATES.reduce((s, t) => s + t.sent, 0)} emails envoyés (30j)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-yellow-500/15 text-yellow-300 border-yellow-500/30">⚠ Brevo non connecté (données démo)</Badge>
          <Button><Plus className="h-4 w-4 mr-1" />Nouveau</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6">
        <Card>
          <CardHeader><CardTitle>Templates</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => setActiveId(t.id)}
                className={`w-full text-left rounded-lg p-3 transition-colors ${active.id === t.id ? "bg-primary/15 border border-primary/30" : "hover:bg-muted/40 border border-transparent"}`}>
                <div className="font-medium text-sm">{t.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t.trigger}</div>
                <div className="text-xs text-primary mt-1">{t.sent} envoyés</div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Pencil className="h-5 w-5 text-primary" />{active.name}</CardTitle>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => toast("Email test envoyé")}><Send className="h-4 w-4 mr-1" />Test</Button>
              <Button size="sm" onClick={() => toast.success("Template sauvegardé")} className="bg-primary hover:bg-primary/90">Enregistrer</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label htmlFor="sub">Objet</Label><Input id="sub" value={draft.subject} onChange={(e) => updateDraft({ subject: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="trig">Déclencheur</Label><Input id="trig" value={draft.trigger} onChange={(e) => updateDraft({ trigger: e.target.value })} /></div>
            <div className="space-y-2">
              <Label htmlFor="body">Corps (HTML/Markdown)</Label>
              <Textarea id="body" rows={14} value={draft.body} onChange={(e) => updateDraft({ body: e.target.value })} className="font-mono text-sm" />
              <p className="text-xs text-muted-foreground">Variables : <code className="text-primary">{`{{firstname}}`}</code> <code className="text-primary">{`{{therapist}}`}</code> <code className="text-primary">{`{{patient}}`}</code> <code className="text-primary">{`{{date}}`}</code></p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
