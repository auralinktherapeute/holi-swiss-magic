import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Package, Receipt, Printer, CheckCircle2, Clock, XCircle } from "lucide-react";
import { listMyClientPackages, type ClientPackage } from "@/lib/service-packages.functions";
import {
  listMyTherapistInvoices, renderInvoiceHtml, updateInvoicePaymentStatus,
  type TherapistInvoice,
} from "@/lib/therapist-invoices.functions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function ClientHistoryPanel({ contactId }: { contactId: string }) {
  const listPkgs = useServerFn(listMyClientPackages);
  const listInvs = useServerFn(listMyTherapistInvoices);
  const renderFn = useServerFn(renderInvoiceHtml);
  const statusFn = useServerFn(updateInvoicePaymentStatus);

  const [pkgs, setPkgs] = useState<ClientPackage[]>([]);
  const [invs, setInvs] = useState<TherapistInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const [p, i] = await Promise.all([
        listPkgs({ data: { client_id: contactId } }),
        listInvs({ data: { client_id: contactId } }),
      ]);
      setPkgs(p ?? []);
      setInvs(i ?? []);
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

  return (
    <div className="space-y-6 border-t border-border/60 pt-4">
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
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => print(inv)} aria-label="Imprimer">
                    <Printer className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        }
      </section>
    </div>
  );
}