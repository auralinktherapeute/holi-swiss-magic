import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Mail, Send, Save, RotateCcw, Eye, Pencil, Loader2, CheckCircle2, XCircle, History,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import lotusAsset from "@/assets/lotus-transparent.png.asset.json";
import {
  getEmailTemplates, saveEmailTemplate, resetEmailTemplate,
  previewEmailTemplate, sendEmailTemplateTest, listRecentEmailLogs,
} from "@/lib/email-templates.functions";

export const Route = createFileRoute("/admin/emails")({ component: Page });

type TemplateRow = {
  id: string;
  label: string;
  content: { subject: string; body: string; cta_label: string };
  defaults: { subject: string; body: string; cta_label: string };
  modified: boolean;
};

type LogRow = {
  id: string;
  recipient_email: string;
  template_id: string;
  subject: string | null;
  status: string;
  sent_at: string;
  error_message: string | null;
};

function Page() {
  const fetchTemplates = useServerFn(getEmailTemplates);
  const save = useServerFn(saveEmailTemplate);
  const reset = useServerFn(resetEmailTemplate);
  const preview = useServerFn(previewEmailTemplate);
  const sendTest = useServerFn(sendEmailTemplateTest);
  const fetchLogs = useServerFn(listRecentEmailLogs);

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [activeId, setActiveId] = useState<string>("invitation");
  const [draft, setDraft] = useState<{ subject: string; body: string; cta_label: string } | null>(null);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [previewHtml, setPreviewHtml] = useState("");
  const [testTo, setTestTo] = useState("contact@holiswiss.ch");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const active = useMemo(() => templates.find((t) => t.id === activeId) ?? null, [templates, activeId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tpls, lg] = await Promise.all([fetchTemplates(), fetchLogs()]);
      setTemplates(tpls as TemplateRow[]);
      setLogs((lg as { rows: LogRow[] }).rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [fetchTemplates, fetchLogs]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (active) {
      setDraft({ ...active.content });
      setView("edit");
    }
  }, [activeId, active]);

  const isDirty = active && draft
    ? draft.subject !== active.content.subject ||
      draft.body !== active.content.body ||
      draft.cta_label !== active.content.cta_label
    : false;

  const doPreview = async () => {
    if (!active || !draft) return;
    setBusy(true);
    try {
      const r = await preview({ data: { template_id: active.id as never, draft } });
      setPreviewHtml((r as { html: string }).html);
      setView("preview");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview impossible");
    } finally {
      setBusy(false);
    }
  };

  const doSave = async () => {
    if (!active || !draft) return;
    setBusy(true);
    try {
      await save({ data: { template_id: active.id as never, content: draft } });
      toast.success("Template enregistré — utilisé pour tous les prochains envois");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  };

  const doReset = async () => {
    if (!active) return;
    if (!confirm("Revenir au template par défaut HoliSwiss ?")) return;
    setBusy(true);
    try {
      const r = await reset({ data: { template_id: active.id as never } });
      setDraft({ ...(r as { defaults: TemplateRow["defaults"] }).defaults });
      toast.success("Template réinitialisé");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Réinitialisation impossible");
    } finally {
      setBusy(false);
    }
  };

  const doTest = async () => {
    if (!active || !draft) return;
    setBusy(true);
    try {
      const r = await sendTest({ data: { template_id: active.id as never, to: testTo, draft } });
      toast.success(`Email de test envoyé à ${(r as { to: string }).to}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi de test impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <img src={lotusAsset.url} alt="" width={36} height={36} style={{ width: 36, height: 36 }} />
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-violet-400" /> Templates emails
          </h1>
          <p className="text-sm text-muted-foreground">
            Modèles transactionnels HoliSwiss (Resend) — édition, aperçu fidèle et envoi de test.
            L'envoi individuel se fait depuis la Liste d'attente.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6">
        <div className="rounded-lg border bg-card p-3 space-y-1 self-start">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-1">
            Templates
          </div>
          {loading && <p className="text-sm text-muted-foreground px-2 py-3">Chargement…</p>}
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveId(t.id)}
              className={`w-full text-left rounded-lg p-3 transition-colors border ${
                activeId === t.id ? "bg-primary/15 border-primary/30" : "hover:bg-muted/40 border-transparent"
              }`}
            >
              <div className="font-medium text-sm flex items-center justify-between gap-2">
                <span className="truncate">{t.label}</span>
                {t.modified && (
                  <span className="rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-semibold shrink-0">
                    modifié
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">{t.content.subject}</div>
            </button>
          ))}
        </div>

        <div className="rounded-lg border bg-card">
          {!active || !draft ? (
            <p className="p-6 text-sm text-muted-foreground">Sélectionne un template.</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap border-b p-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setView("edit")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                      view === "edit" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Éditer
                  </button>
                  <button
                    onClick={doPreview}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                      view === "preview" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" /> Aperçu
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={doReset} disabled={busy || (!active.modified && !isDirty)}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Défaut
                  </Button>
                  <Button size="sm" onClick={doSave} disabled={busy || !isDirty}>
                    {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                    Enregistrer
                  </Button>
                </div>
              </div>

              {view === "edit" ? (
                <div className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject">Objet</Label>
                    <Input
                      id="subject"
                      value={draft.subject}
                      onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="body">Corps (markdown : **gras**, listes «&nbsp;-&nbsp;», [lien](https://…))</Label>
                    <Textarea
                      id="body"
                      rows={14}
                      value={draft.body}
                      onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Variables : <code className="text-primary">{"{{PRENOM}}"}</code>{" "}
                      <code className="text-primary">{"{{NOM}}"}</code>{" "}
                      <code className="text-primary">{"{{SPECIALITE}}"}</code>{" "}
                      <code className="text-primary">{"{{EMAIL}}"}</code>{" "}
                      <code className="text-primary">{"{{DATE_INSCRIPTION}}"}</code>
                      {" "}· L'en-tête (logo), le bouton et le pied de page HoliSwiss sont ajoutés automatiquement.
                    </p>
                  </div>
                  {active.id !== "custom" && (
                    <div className="space-y-2">
                      <Label htmlFor="cta">Libellé du bouton</Label>
                      <Input
                        id="cta"
                        value={draft.cta_label}
                        onChange={(e) => setDraft({ ...draft, cta_label: e.target.value })}
                        className="max-w-sm"
                      />
                    </div>
                  )}
                  <div className="flex items-end gap-2 flex-wrap border-t pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="testto">Envoyer un test à</Label>
                      <Input
                        id="testto"
                        type="email"
                        value={testTo}
                        onChange={(e) => setTestTo(e.target.value)}
                        className="w-64"
                      />
                    </div>
                    <Button variant="secondary" onClick={doTest} disabled={busy || !testTo}>
                      <Send className="h-3.5 w-3.5 mr-1" /> Envoyer le test
                    </Button>
                    <p className="text-xs text-muted-foreground w-full">
                      Le test part avec des données d'exemple (Marie Dupont, naturopathie) et l'objet préfixé [TEST].
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <iframe
                    title="Aperçu email"
                    srcDoc={previewHtml}
                    className="w-full rounded-lg border bg-white"
                    style={{ height: 640 }}
                    sandbox=""
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b p-4">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Derniers envois</h2>
        </div>
        {logs.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Aucun envoi enregistré pour l'instant.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {logs.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-4 py-2 text-sm flex-wrap">
                {l.status === "sent" ? (
                  <CheckCircle2 className="h-4 w-4 text-cyan-300 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                )}
                <span className="font-mono text-xs text-muted-foreground w-40 truncate">{l.recipient_email}</span>
                <span className="flex-1 truncate">{l.subject ?? l.template_id}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(l.sent_at).toLocaleString("fr-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
                {l.error_message && <span className="text-xs text-red-400">{l.error_message}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
