import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Mail, Send, Loader2, ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  previewCustomEmail, sendCustomEmail, listEmailLogs,
} from "@/lib/custom-email.functions";
import { TEMPLATE_OPTIONS, type TemplateId } from "@/lib/custom-email-templates.server";

type Entry = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

type LogRow = {
  id: string;
  template_id: string;
  subject: string | null;
  status: string;
  sent_at: string;
  error_message: string | null;
};

const TEMPLATE_LABEL: Record<string, string> = Object.fromEntries(
  TEMPLATE_OPTIONS.map((o) => [o.id, o.label]),
);

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-CH", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export function SendEmailDialog({
  open, onOpenChange, entry,
}: { open: boolean; onOpenChange: (v: boolean) => void; entry: Entry | null }) {
  const preview = useServerFn(previewCustomEmail);
  const send = useServerFn(sendCustomEmail);
  const fetchLogs = useServerFn(listEmailLogs);

  const [templateId, setTemplateId] = useState<TemplateId>("invitation");
  const [customSubject, setCustomSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [html, setHtml] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);

  const fullName = entry
    ? [entry.first_name, entry.last_name].filter(Boolean).join(" ") || entry.email
    : "";
  const needsCustom = templateId === "custom";

  const loadPreview = useCallback(async () => {
    if (!entry) return;
    setLoadingPreview(true);
    try {
      const res = await preview({
        data: {
          waitlist_id: entry.id,
          template_id: templateId,
          custom_subject: needsCustom ? customSubject : undefined,
          custom_message: needsCustom ? customMessage : undefined,
        },
      });
      setHtml(res.html);
      setSubject(res.subject);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aperçu indisponible");
    } finally {
      setLoadingPreview(false);
    }
  }, [entry, preview, templateId, needsCustom, customSubject, customMessage]);

  useEffect(() => {
    if (!open || !entry) return;
    const t = window.setTimeout(loadPreview, 300);
    return () => window.clearTimeout(t);
  }, [open, entry, loadPreview]);

  useEffect(() => {
    if (!open || !entry) return;
    setTemplateId("invitation");
    setCustomSubject("");
    setCustomMessage("");
    fetchLogs({ data: { waitlist_id: entry.id, limit: 5 } })
      .then((r) => setLogs((r.rows ?? []) as LogRow[]))
      .catch(() => setLogs([]));
  }, [open, entry, fetchLogs]);

  async function doSend() {
    if (!entry) return;
    setSending(true);
    try {
      await send({
        data: {
          waitlist_id: entry.id,
          template_id: templateId,
          custom_subject: needsCustom ? customSubject : undefined,
          custom_message: needsCustom ? customMessage : undefined,
        },
      });
      toast.success("Email envoyé ✓");
      const r = await fetchLogs({ data: { waitlist_id: entry.id, limit: 5 } });
      setLogs((r.rows ?? []) as LogRow[]);
      setConfirmOpen(false);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'envoi");
    } finally {
      setSending(false);
    }
  }

  const previewSrcDoc = useMemo(() => html || "<p style='padding:24px;font-family:sans-serif;color:#666'>Chargement de l'aperçu…</p>", [html]);
  const canSend = !sending && !!entry && (!needsCustom || customMessage.trim().length > 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto"
          style={{ background: "#0f0a1e", border: "1px solid rgba(184,110,249,0.25)", color: "#e9e6f5" }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Mail className="h-5 w-5" style={{ color: "#b86ef9" }} />
              Envoyer un email à {fullName}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Sélectionnez un template, prévisualisez puis envoyez.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs text-white/60">Destinataire</Label>
              <div className="mt-1 rounded-md px-3 py-2 text-sm text-white/85"
                   style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {entry?.email}
              </div>
            </div>

            <div>
              <Label className="text-xs text-white/60">Template</Label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value as TemplateId)}
                className="mt-1 w-full rounded-md px-3 py-2 text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                {TEMPLATE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id} style={{ background: "#1a1035" }}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {needsCustom && (
              <>
                <div>
                  <Label className="text-xs text-white/60">Objet</Label>
                  <Input
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="Objet de l'email"
                    className="mt-1"
                    style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.12)", color: "white" }}
                  />
                </div>
                <div>
                  <Label className="text-xs text-white/60">
                    Message (markdown simple : **gras**, listes -, [lien](url))
                  </Label>
                  <Textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={6}
                    placeholder="Votre message ici…"
                    className="mt-1"
                    style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.12)", color: "white" }}
                  />
                </div>
              </>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs text-white/60">Prévisualisation</Label>
                <span className="text-xs text-white/40 truncate max-w-[60%]">{subject}</span>
              </div>
              <div className="rounded-md overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.12)", background: "#ffffff" }}>
                {loadingPreview ? (
                  <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement…
                  </div>
                ) : (
                  <iframe
                    title="Aperçu email"
                    srcDoc={previewSrcDoc}
                    sandbox=""
                    style={{ width: "100%", height: 420, border: 0, background: "white" }}
                  />
                )}
              </div>
            </div>

            <div className="rounded-md" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-white/80"
              >
                <span>Historique des emails envoyés ({logs.length})</span>
                {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {historyOpen && (
                <div className="px-3 pb-3">
                  {logs.length === 0 ? (
                    <div className="text-xs text-white/50 py-2">Aucun email envoyé pour le moment.</div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-white/50 text-left">
                          <th className="py-1 font-medium">Template</th>
                          <th className="py-1 font-medium">Date d'envoi</th>
                          <th className="py-1 font-medium text-right">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((l) => (
                          <tr key={l.id} className="border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                            <td className="py-1.5 text-white/80">{TEMPLATE_LABEL[l.template_id] || l.template_id}</td>
                            <td className="py-1.5 text-white/60">{fmt(l.sent_at)}</td>
                            <td className="py-1.5 text-right">
                              {l.status === "sent" ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Envoyé
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-400" title={l.error_message ?? undefined}>
                                  <XCircle className="h-3.5 w-3.5" /> Échec
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
                Annuler
              </Button>
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!canSend}
                className="gap-2"
                style={{ background: "linear-gradient(135deg,#7C3AED,#5B21B6)", color: "white", border: 0 }}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Envoyer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'envoi</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmer l'envoi à <strong>{entry?.email}</strong> ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={doSend} disabled={sending}>
              {sending ? "Envoi…" : "Envoyer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
