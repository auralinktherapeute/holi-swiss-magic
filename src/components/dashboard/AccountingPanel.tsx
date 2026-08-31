// Onglet « Comptabilité » : vue d'ensemble chiffrée, journaux, synthèse TVA,
// exports CSV et envoi du pack à la fiduciaire.

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Mail, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  getAccounting, getAccountingExport, sendAccountingPack, listAccountingExports,
} from "@/lib/accounting.functions";

const money = (n: number) =>
  new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" }).format(n ?? 0);

const EXPORTS = [
  { key: "invoices", label: "Journal des factures (CSV)" },
  { key: "lines", label: "Détail des prestations (CSV)" },
  { key: "payments", label: "Journal des encaissements (CSV)" },
  { key: "vat", label: "Synthèse TVA (CSV)" },
  { key: "summary", label: "Résumé de période (HTML imprimable)" },
] as const;

type ExportKey = (typeof EXPORTS)[number]["key"];

function defaultPeriod() {
  const now = new Date();
  return {
    from: `${now.getFullYear()}-01-01`,
    to: now.toISOString().slice(0, 10),
  };
}

export default function AccountingPanel() {
  const qc = useQueryClient();
  const accFn = useServerFn(getAccounting);
  const exportFn = useServerFn(getAccountingExport);
  const sendFn = useServerFn(sendAccountingPack);
  const historyFn = useServerFn(listAccountingExports);

  const [period, setPeriod] = useState(defaultPeriod);
  const [sendOpen, setSendOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [include, setInclude] = useState<ExportKey[]>(["invoices", "payments", "vat", "summary"]);

  const { data, isLoading } = useQuery({
    queryKey: ["accounting", period.from, period.to],
    queryFn: () => accFn({ data: period }),
    staleTime: 30_000,
  });
  const { data: history } = useQuery({
    queryKey: ["accounting-exports"],
    queryFn: () => historyFn(),
    staleTime: 60_000,
  });

  const o = data?.overview;

  const download = useMutation({
    mutationFn: (kind: ExportKey) => exportFn({ data: { ...period, kind } }),
    onSuccess: (file: { filename: string; mime: string; content: string }) => {
      const blob = new Blob([file.content], { type: `${file.mime};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${file.filename} téléchargé.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMut = useMutation({
    mutationFn: () => sendFn({ data: { ...period, to_email: email.trim(), message: message.trim() || null, include } }),
    onSuccess: () => {
      toast.success("Pack comptable envoyé à votre fiduciaire.");
      setSendOpen(false);
      setMessage("");
      qc.invalidateQueries({ queryKey: ["accounting-exports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cards = useMemo(() => o ? [
    { label: "Chiffre d'affaires facturé", value: money(o.revenue_invoiced) },
    { label: "Encaissé", value: money(o.collected) },
    { label: "Restant dû", value: money(o.outstanding) },
    { label: "En retard", value: `${o.overdue_count} · ${money(o.overdue_amount)}` },
    { label: "TVA collectée", value: money(o.total_vat) },
    { label: "Annulées / avoirs", value: `${o.cancelled_count} · ${money(o.cancelled_amount)}` },
  ] : [], [o]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="acc-from">Du</Label>
            <Input id="acc-from" type="date" className="mt-1 min-h-11"
              value={period.from} onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="acc-to">Au</Label>
            <Input id="acc-to" type="date" className="mt-1 min-h-11"
              value={period.to} onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))} />
          </div>
          <Button className="min-h-11" onClick={() => setSendOpen(true)}>
            <Mail className="h-4 w-4 mr-2" aria-hidden="true" />
            Envoyer à ma fiduciaire
          </Button>
        </CardContent>
      </Card>

      {isLoading || !o ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <Card key={c.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-lg font-semibold mt-1">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="invoices">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="invoices">Journal des factures</TabsTrigger>
          <TabsTrigger value="payments">Encaissements</TabsTrigger>
          <TabsTrigger value="vat">TVA</TabsTrigger>
          <TabsTrigger value="exports">Exports</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-4">
          <Card><CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b"><tr>
                <th className="p-3 text-left">Numéro</th><th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Client</th><th className="p-3 text-left">Statut</th>
                <th className="p-3 text-right">Total</th><th className="p-3 text-right">Solde</th>
              </tr></thead>
              <tbody>
                {(data?.invoices ?? []).map((i: any) => (
                  <tr key={i.id} className="border-b last:border-0">
                    <td className="p-3 font-mono text-xs">{i.numero_facture}</td>
                    <td className="p-3">{i.date_emission}</td>
                    <td className="p-3">{i.client_name}</td>
                    <td className="p-3 text-muted-foreground">{i.statut}</td>
                    <td className="p-3 text-right">{money(i.montant_total)}</td>
                    <td className="p-3 text-right">{money(i.solde)}</td>
                  </tr>
                ))}
                {!data?.invoices?.length && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Aucune facture sur la période.</td></tr>
                )}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card><CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b"><tr>
                <th className="p-3 text-left">Date</th><th className="p-3 text-left">Facture</th>
                <th className="p-3 text-left">Client</th><th className="p-3 text-left">Mode</th>
                <th className="p-3 text-right">Montant</th>
              </tr></thead>
              <tbody>
                {(data?.payments ?? []).map((p: any) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="p-3">{p.date_paiement}</td>
                    <td className="p-3 font-mono text-xs">{p.numero_facture}</td>
                    <td className="p-3">{p.client_name}</td>
                    <td className="p-3 text-muted-foreground">{p.mode_paiement ?? "—"}</td>
                    <td className="p-3 text-right">{money(p.montant)}</td>
                  </tr>
                ))}
                {!data?.payments?.length && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Aucun encaissement sur la période.</td></tr>
                )}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="vat" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Synthèse TVA</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b"><tr>
                  <th className="p-3 text-left">Taux</th><th className="p-3 text-right">Base HT</th>
                  <th className="p-3 text-right">TVA</th><th className="p-3 text-right">Total TTC</th>
                </tr></thead>
                <tbody>
                  {(o?.vat_by_rate ?? []).map((v) => (
                    <tr key={v.rate} className="border-b last:border-0">
                      <td className="p-3">{v.rate} %</td>
                      <td className="p-3 text-right">{money(v.base)}</td>
                      <td className="p-3 text-right">{money(v.vat)}</td>
                      <td className="p-3 text-right">{money(v.ttc)}</td>
                    </tr>
                  ))}
                  {!o?.vat_by_rate?.length && (
                    <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Aucune TVA sur la période.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exports" className="mt-4 space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {EXPORTS.map((e) => (
              <Button key={e.key} variant="outline" className="justify-start min-h-11"
                disabled={download.isPending}
                onClick={() => download.mutate(e.key)}>
                <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                {e.label}
              </Button>
            ))}
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Historique des exports</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(history ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun pack généré pour l'instant.</p>
              )}
              {(history ?? []).map((h: any) => (
                <div key={h.id} className="text-sm flex flex-wrap justify-between gap-2 border-b last:border-0 pb-2">
                  <span>{h.period_start} → {h.period_end} · {h.export_type}</span>
                  <span className="text-muted-foreground">
                    {new Date(h.created_at).toLocaleString("fr-CH")}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground flex gap-2">
        <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
        Ce récapitulatif facilite la préparation comptable. Vérifiez les montants avec votre
        fiduciaire avant toute déclaration officielle.
      </p>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envoyer le pack comptable</DialogTitle>
            <DialogDescription>
              Période du {period.from} au {period.to}. Rien n'est envoyé sans votre confirmation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="acc-email">Adresse de la fiduciaire</Label>
              <Input id="acc-email" type="email" className="mt-1 min-h-11" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="comptable@fiduciaire.ch" />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium mb-1">Documents joints</legend>
              {EXPORTS.map((e) => (
                <label key={e.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={include.includes(e.key)}
                    onCheckedChange={(v) =>
                      setInclude((prev) => v ? [...prev, e.key] : prev.filter((k) => k !== e.key))}
                  />
                  {e.label}
                </label>
              ))}
            </fieldset>
            <div>
              <Label htmlFor="acc-msg">Message (facultatif)</Label>
              <Textarea id="acc-msg" className="mt-1" value={message}
                onChange={(e) => setMessage(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>Annuler</Button>
            <Button disabled={!email.trim() || !include.length || sendMut.isPending}
              onClick={() => sendMut.mutate()}>
              Confirmer l'envoi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
