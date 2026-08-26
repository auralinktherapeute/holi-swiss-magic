import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BellRing, Clock, AlertTriangle, Send } from "lucide-react";
import {
  listInvoiceReminders, sendInvoiceReminder, type InvoiceReminder,
} from "@/lib/therapist-invoices.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

const BUCKETS: { id: InvoiceReminder["bucket"]; label: string; cls: string }[] = [
  { id: "en_retard", label: "En retard", cls: "border-destructive/40 bg-destructive/5" },
  { id: "echeance_proche", label: "Échéance sous 7 jours", cls: "border-amber-500/40 bg-amber-500/5" },
];

function dueLabel(r: InvoiceReminder): string {
  if (r.days_to_due === null) return "Sans échéance";
  if (r.days_to_due < 0) return `En retard de ${Math.abs(r.days_to_due)} jour${Math.abs(r.days_to_due) > 1 ? "s" : ""}`;
  if (r.days_to_due === 0) return "Échéance aujourd'hui";
  return `Échéance dans ${r.days_to_due} jour${r.days_to_due > 1 ? "s" : ""}`;
}

export default function InvoiceReminders({ onSent }: { onSent?: () => void }) {
  const listFn = useServerFn(listInvoiceReminders);
  const sendFn = useServerFn(sendInvoiceReminder);

  const [rows, setRows] = useState<InvoiceReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<InvoiceReminder | null>(null);
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setRows(await listFn());
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible de charger les relances");
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  useEffect(() => { void refresh(); }, [refresh]);

  function open(r: InvoiceReminder) {
    setTarget(r);
    setTo(r.client_email ?? "");
    setMessage("");
  }

  async function send() {
    if (!target) return;
    setSending(true);
    try {
      const res = await sendFn({
        data: { id: target.id, to: to.trim() || null, message: message.trim() || null },
      });
      toast.success(`Relance envoyée à ${res.sentTo}`);
      setTarget(null);
      await refresh();
      onSent?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Envoi impossible");
    } finally {
      setSending(false);
    }
  }

  const due = rows.filter((r) => r.bucket !== "a_venir");

  if (loading) {
    return <div className="h-24 rounded-lg bg-muted animate-pulse" aria-busy="true" />;
  }

  return (
    <section aria-labelledby="relances-title">
      <h2 id="relances-title" className="text-lg font-semibold mb-1 flex items-center gap-2">
        <BellRing className="h-5 w-5 text-primary" aria-hidden="true" /> Relances
      </h2>
      <p className="text-sm text-muted-foreground mb-3">
        Aucune relance n'est envoyée automatiquement : vous décidez de chaque envoi.
      </p>

      {due.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune facture à relancer. Tout est à jour.
        </p>
      ) : (
        <div className="space-y-4">
          {BUCKETS.map((b) => {
            const list = due.filter((r) => r.bucket === b.id);
            if (list.length === 0) return null;
            return (
              <div key={b.id} className={`rounded-lg border p-3 space-y-2 ${b.cls}`}>
                <p className="text-sm font-medium flex items-center gap-2">
                  {b.id === "en_retard"
                    ? <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    : <Clock className="h-4 w-4" aria-hidden="true" />}
                  {b.label} ({list.length})
                </p>
                <ul className="space-y-2">
                  {list.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-card border border-border/60 p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          <span className="font-mono text-xs text-muted-foreground mr-2">{r.numero_facture}</span>
                          {r.client_nom ?? "Client"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {dueLabel(r)} · Solde {r.solde.toFixed(2)} {r.currency}
                          {r.reminders_sent > 0 && (
                            <> · {r.reminders_sent} relance{r.reminders_sent > 1 ? "s" : ""} envoyée{r.reminders_sent > 1 ? "s" : ""}</>
                          )}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        onClick={() => open(r)}
                      >
                        <Send className="h-4 w-4 mr-2" aria-hidden="true" /> Relancer
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Relancer la facture {target?.numero_facture}</DialogTitle>
            <DialogDescription>
              Un rappel courtois avec la facture en pièce jointe sera envoyé au client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="relance-email">Adresse email du client</Label>
              <Input
                id="relance-email"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="client@exemple.ch"
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="relance-message">Message personnalisé (facultatif)</Label>
              <Textarea
                id="relance-message"
                rows={4}
                maxLength={2000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Laissez vide pour utiliser le rappel standard."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setTarget(null)}>
              Annuler
            </Button>
            <Button className="min-h-11" onClick={send} disabled={sending || !to.trim()}>
              {sending ? "Envoi…" : "Envoyer la relance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
