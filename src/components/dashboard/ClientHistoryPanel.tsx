import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Package, Receipt, Printer, CheckCircle2, Clock, XCircle, Mail, ClipboardList, Send } from "lucide-react";
import { listMyClientPackages, type ClientPackage } from "@/lib/service-packages.functions";
import {
  listMyTherapistInvoices, renderInvoiceHtml, updateInvoicePaymentStatus,
  emailInvoiceToClient,
  type TherapistInvoice,
} from "@/lib/therapist-invoices.functions";
import {
  listMyQuestionnaires, emailQuestionnaireToClient,
  type Questionnaire,
} from "@/lib/questionnaires.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Props = {
  contactId: string;
  contactEmail?: string | null;
  contactName?: string | null;
};

export default function ClientHistoryPanel({ contactId, contactEmail, contactName }: Props) {
  const listPkgs = useServerFn(listMyClientPackages);
  const listInvs = useServerFn(listMyTherapistInvoices);
  const renderFn = useServerFn(renderInvoiceHtml);
  const statusFn = useServerFn(updateInvoicePaymentStatus);
  const emailInvFn = useServerFn(emailInvoiceToClient);
  const listQFn = useServerFn(listMyQuestionnaires);
  const emailQFn = useServerFn(emailQuestionnaireToClient);

  const [pkgs, setPkgs] = useState<ClientPackage[]>([]);
  const [invs, setInvs] = useState<TherapistInvoice[]>([]);
  const [qs, setQs] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog envoi facture
  const [invDlg, setInvDlg] = useState<TherapistInvoice | null>(null);
  const [invTo, setInvTo] = useState("");
  const [invMsg, setInvMsg] = useState("");
  const [invSending, setInvSending] = useState(false);

  // Dialog envoi questionnaire
  const [qDlgOpen, setQDlgOpen] = useState(false);
  const [qSel, setQSel] = useState<string>("");
  const [qTo, setQTo] = useState("");
  const [qMsg, setQMsg] = useState("");
  const [qSending, setQSending] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [p, i, q] = await Promise.all([
        listPkgs({ data: { client_id: contactId } }),
        listInvs({ data: { client_id: contactId } }),
        listQFn({}),
      ]);
      setPkgs(p ?? []);
      setInvs(i ?? []);
      setQs((q ?? []).filter((x: any) => x.actif));
    } finally { setLoading(false); }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [contactId]);

  async function print(inv: TherapistInvoice) {
    try {
      const { html } = await renderFn({ data: { id: inv.id } });
      const w = window.open("", "_blank");
      if (!w) { toast.error("Le navigateur a bloqué la fenêtre"); return; }
      w.document.write(html); w.document.close();
    } catch (e: any) { toast.error(e.message ?? "Erreur"); }
  }

  function openInvoiceDialog(inv: TherapistInvoice) {
    setInvDlg(inv);
    setInvTo(contactEmail ?? "");
    setInvMsg("");
  }
  async function sendInvoice() {
    if (!invDlg) return;
    if (!invTo.trim()) { toast.error("Email requis"); return; }
    setInvSending(true);
    try {
      await emailInvFn({ data: { id: invDlg.id, to: invTo.trim(), message: invMsg || null } });
      toast.success(`Facture envoyée à ${invTo}`);
      setInvDlg(null);
      refresh();
    } catch (e: any) { toast.error(e.message ?? "Envoi impossible"); }
    finally { setInvSending(false); }
  }

  function openQuestionnaireDialog() {
    setQDlgOpen(true);
    setQTo(contactEmail ?? "");
    setQSel(qs[0]?.id ?? "");
    setQMsg("");
  }
  async function sendQuestionnaire() {
    if (!qSel) { toast.error("Choisissez un questionnaire"); return; }
    if (!qTo.trim()) { toast.error("Email requis"); return; }
    setQSending(true);
    try {
      await emailQFn({ data: {
        questionnaire_id: qSel, to: qTo.trim(), message: qMsg || null,
        origin: window.location.origin,
      } });
      toast.success(`Questionnaire envoyé à ${qTo}`);
      setQDlgOpen(false);
    } catch (e: any) { toast.error(e.message ?? "Envoi impossible"); }
    finally { setQSending(false); }
  }

  return (
    <div className="space-y-6 border-t border-border/60 pt-4">
      <section>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            Questionnaires
          </h4>
          <Button size="sm" variant="outline" onClick={openQuestionnaireDialog} disabled={qs.length === 0}>
            <Send className="h-3.5 w-3.5 mr-1.5" /> Envoyer par email
          </Button>
        </div>
        {qs.length === 0 && (
          <p className="text-xs text-muted-foreground">Aucun questionnaire actif. Créez-en un depuis la page Questionnaires.</p>
        )}
      </section>

      <section>
        <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
          <Package className="h-4 w-4 text-primary" />
          Forfaits ({pkgs.length})
        </h4>
        {loading ? <p className="text-xs text-muted-foreground">Chargement…</p> :
          pkgs.length === 0 ? <p className="text-xs text-muted-foreground">Aucun forfait pour ce client.</p> :
          <ul className="space-y-1.5">
            {pkgs.map((p: any) => (
              <li key={p.id} className="text-sm flex justify-between border border-border/40 rounded-md px-3 py-2">
                <div>
                  <div className="font-medium">{p.service_packages?.nom ?? "Forfait"}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.nombre_seances_utilisees}/{p.service_packages?.nombre_seances_incluses ?? "?"} séances utilisées
                    {p.date_expiration && ` · expire le ${new Date(p.date_expiration).toLocaleDateString("fr-CH")}`}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full h-fit ${
                  p.statut === "actif" ? "bg-green-500/15 text-green-500" :
                  p.statut === "epuise" ? "bg-amber-500/15 text-amber-500" :
                  "bg-red-500/15 text-red-500"
                }`}>{p.statut}</span>
              </li>
            ))}
          </ul>
        }
      </section>

      <section>
        <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
          <Receipt className="h-4 w-4 text-primary" />
          Factures ({invs.length})
        </h4>
        {loading ? <p className="text-xs text-muted-foreground">Chargement…</p> :
          invs.length === 0 ? <p className="text-xs text-muted-foreground">Aucune facture pour ce client.</p> :
          <ul className="space-y-1.5">
            {invs.map((inv) => (
              <li key={inv.id} className="text-sm flex items-center justify-between border border-border/40 rounded-md px-3 py-2 gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-xs">{inv.numero_facture}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(inv.date_emission).toLocaleDateString("fr-CH")} · {Number(inv.montant_total).toFixed(2)} {inv.currency}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Select value={inv.statut_paiement} onValueChange={async (v: any) => {
                    await statusFn({ data: { id: inv.id, statut_paiement: v } });
                    toast.success("Statut mis à jour"); refresh();
                  }}>
                    <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en_attente"><span className="inline-flex items-center gap-1 text-xs"><Clock className="h-3 w-3" />En attente</span></SelectItem>
                      <SelectItem value="paye"><span className="inline-flex items-center gap-1 text-xs"><CheckCircle2 className="h-3 w-3 text-green-500" />Payée</span></SelectItem>
                      <SelectItem value="annule"><span className="inline-flex items-center gap-1 text-xs"><XCircle className="h-3 w-3 text-red-500" />Annulée</span></SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openInvoiceDialog(inv)} aria-label="Envoyer par email">
                    <Mail className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => print(inv)} aria-label="Imprimer">
                    <Printer className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        }
      </section>

      {/* Dialog envoi facture */}
      <Dialog open={!!invDlg} onOpenChange={(o) => !o && setInvDlg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envoyer la facture {invDlg?.numero_facture}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Destinataire {contactName ? `(${contactName})` : ""}</label>
              <Input type="email" value={invTo} onChange={(e) => setInvTo(e.target.value)} placeholder="client@exemple.ch" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Message (optionnel)</label>
              <Textarea rows={4} value={invMsg} onChange={(e) => setInvMsg(e.target.value)} placeholder="Mot personnel accompagnant la facture…" />
            </div>
            <p className="text-xs text-muted-foreground">
              La facture (HTML + QR-facture) sera jointe à l'email et un lien sécurisé (valable 30 jours) sera fourni.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInvDlg(null)}>Annuler</Button>
            <Button onClick={sendInvoice} disabled={invSending}>
              {invSending ? "Envoi…" : (<><Send className="h-4 w-4 mr-1.5" />Envoyer</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog envoi questionnaire */}
      <Dialog open={qDlgOpen} onOpenChange={setQDlgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envoyer un questionnaire {contactName ? `à ${contactName}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Questionnaire</label>
              <Select value={qSel} onValueChange={setQSel}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {qs.map((q) => (
                    <SelectItem key={q.id} value={q.id}>{q.titre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Destinataire</label>
              <Input type="email" value={qTo} onChange={(e) => setQTo(e.target.value)} placeholder="client@exemple.ch" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Message (optionnel)</label>
              <Textarea rows={4} value={qMsg} onChange={(e) => setQMsg(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setQDlgOpen(false)}>Annuler</Button>
            <Button onClick={sendQuestionnaire} disabled={qSending}>
              {qSending ? "Envoi…" : (<><Send className="h-4 w-4 mr-1.5" />Envoyer</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}