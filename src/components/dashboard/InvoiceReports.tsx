import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BarChart3, Download, Percent } from "lucide-react";
import {
  getInvoiceReport, exportInvoicesCsv,
} from "@/lib/therapist-invoices.functions";
import type { InvoiceReport } from "@/lib/invoice-report.server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { id: "year", label: "Année en cours" },
  { id: "q", label: "Trimestre en cours" },
  { id: "prev-year", label: "Année précédente" },
] as const;

function presetRange(id: (typeof PRESETS)[number]["id"]): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  if (id === "prev-year") return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
  if (id === "q") {
    const qStart = Math.floor(now.getMonth() / 3) * 3;
    return { from: ymd(new Date(y, qStart, 1)), to: ymd(new Date(y, qStart + 3, 0)) };
  }
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1)
    .toLocaleDateString("fr-CH", { month: "short", year: "numeric" });
}

export default function InvoiceReports() {
  const reportFn = useServerFn(getInvoiceReport);
  const exportFn = useServerFn(exportInvoicesCsv);

  const [range, setRange] = useState(() => presetRange("year"));
  const [report, setReport] = useState<InvoiceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  const load = useCallback(async (r: { from: string; to: string }) => {
    setLoading(true);
    try {
      setReport(await reportFn({ data: r }));
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible de calculer le rapport");
    } finally {
      setLoading(false);
    }
  }, [reportFn]);

  useEffect(() => { void load(range); }, [load, range]);

  async function download(kind: "invoices" | "payments") {
    setExporting(kind);
    try {
      const { filename, csv } = await exportFn({ data: { ...range, kind } });
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export téléchargé");
    } catch (e: any) {
      toast.error(e?.message ?? "Export impossible");
    } finally {
      setExporting(null);
    }
  }

  const maxTtc = useMemo(
    () => Math.max(1, ...(report?.monthly ?? []).map((m) => m.ttc)),
    [report],
  );

  const cur = report?.currency ?? "CHF";
  const fmt = (n: number) => `${n.toFixed(2)} ${cur}`;

  return (
    <section aria-labelledby="rapports-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="rapports-title" className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" /> Rapports financiers
          </h2>
          <p className="text-sm text-muted-foreground">
            Chiffre d'affaires, TVA à déclarer et exports pour votre fiduciaire.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.id} size="sm" variant="outline" className="min-h-11"
              onClick={() => setRange(presetRange(p.id))}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card p-3">
        <div className="space-y-1.5">
          <Label htmlFor="rapport-from">Du</Label>
          <Input
            id="rapport-from" type="date" value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rapport-to">Au</Label>
          <Input
            id="rapport-to" type="date" value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </div>
        <div className="flex flex-wrap gap-2 ml-auto">
          <Button
            variant="outline" className="min-h-11"
            onClick={() => download("invoices")} disabled={exporting !== null}
          >
            <Download className="h-4 w-4 mr-2" aria-hidden="true" />
            {exporting === "invoices" ? "Export…" : "Exporter les factures (CSV)"}
          </Button>
          <Button
            variant="outline" className="min-h-11"
            onClick={() => download("payments")} disabled={exporting !== null}
          >
            <Download className="h-4 w-4 mr-2" aria-hidden="true" />
            {exporting === "payments" ? "Export…" : "Exporter les encaissements (CSV)"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="h-40 rounded-lg bg-muted animate-pulse" aria-busy="true" />
      ) : !report || report.totals.invoices === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune facture émise sur cette période.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Chiffre d'affaires HT", value: fmt(report.totals.ht) },
              { label: "TVA facturée", value: fmt(report.totals.tva) },
              { label: "Total TTC", value: fmt(report.totals.ttc) },
              { label: "Encaissé", value: fmt(report.totals.encaisse) },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border/60 bg-card p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-semibold mt-1">{s.value}</p>
              </div>
            ))}
          </div>

          {report.totals.en_retard > 0 && (
            <p className="text-sm text-destructive">
              {report.totals.en_retard} facture{report.totals.en_retard > 1 ? "s" : ""} en retard
              sur la période — {fmt(report.totals.montant_en_retard)} à recouvrer.
            </p>
          )}

          <div className="rounded-lg border border-border/60 bg-card p-4">
            <h3 className="text-sm font-medium mb-3">Évolution mensuelle (TTC)</h3>
            <ul className="space-y-2">
              {report.monthly.map((m) => (
                <li key={m.month} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">
                    {monthLabel(m.month)}
                  </span>
                  <span className="flex-1 h-3 rounded-full bg-muted overflow-hidden" aria-hidden="true">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(2, (m.ttc / maxTtc) * 100)}%` }}
                    />
                  </span>
                  <span className="w-32 shrink-0 text-right text-xs tabular-nums">
                    {fmt(m.ttc)}
                  </span>
                  <span className="w-28 shrink-0 text-right text-xs text-muted-foreground tabular-nums hidden sm:block">
                    encaissé {m.encaisse.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-border/60 bg-card p-4">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Percent className="h-4 w-4 text-primary" aria-hidden="true" /> TVA par taux
            </h3>
            {!report.assujetti_tva ? (
              <p className="text-sm text-muted-foreground">
                Vous n'êtes pas assujetti à la TVA : aucune TVA n'est à déclarer.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">TVA facturée par taux sur la période</caption>
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th scope="col" className="py-1.5">Taux</th>
                        <th scope="col" className="py-1.5 text-right">Base HT</th>
                        <th scope="col" className="py-1.5 text-right">TVA due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.vat.map((v) => (
                        <tr key={v.rate} className="border-t border-border/60">
                          <td className="py-1.5">{v.rate.toFixed(1)} %</td>
                          <td className="py-1.5 text-right tabular-nums">{v.base_ht.toFixed(2)}</td>
                          <td className="py-1.5 text-right tabular-nums">{v.tva.toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-border font-medium">
                        <td className="py-1.5">Total</td>
                        <td className="py-1.5 text-right tabular-nums">{report.totals.ht.toFixed(2)}</td>
                        <td className="py-1.5 text-right tabular-nums">{report.totals.tva.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Calcul selon les contre-prestations <strong>facturées</strong> (date d'émission).
                  Si vous décomptez selon les contre-prestations reçues, basez-vous sur l'export
                  des encaissements. Ces chiffres sont indicatifs : votre fiduciaire reste la référence.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
