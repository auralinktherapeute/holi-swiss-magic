import { useCallback, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, Landmark, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { analyzeCamtFile, applyCamtPayments, type ReconciliationMatch } from "@/lib/bank-reconciliation.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

function money(n: number, ccy = "CHF") {
  return `${ccy} ${n.toFixed(2)}`;
}

const STATUS_UI: Record<ReconciliationMatch["status"], { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  matched: { label: "Correspondance", cls: "border-emerald-500/40 bg-emerald-500/5", Icon: CheckCircle2 },
  amount_mismatch: { label: "Montant différent", cls: "border-amber-500/40 bg-amber-500/5", Icon: AlertTriangle },
  already_paid: { label: "Déjà soldée", cls: "border-border bg-muted/30", Icon: CheckCircle2 },
  unmatched: { label: "Non rapprochée", cls: "border-destructive/40 bg-destructive/5", Icon: XCircle },
  ignored: { label: "Débit ignoré", cls: "border-border bg-muted/30", Icon: XCircle },
};

export default function BankReconciliation({ onApplied }: { onApplied?: () => void }) {
  const analyzeFn = useServerFn(analyzeCamtFile);
  const applyFn = useServerFn(applyCamtPayments);
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [matches, setMatches] = useState<ReconciliationMatch[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);

  const onFile = useCallback(async (file: File) => {
    if (file.size > 4_000_000) { toast.error("Fichier trop volumineux (max 4 Mo)."); return; }
    setBusy(true);
    try {
      const xml = await file.text();
      const res = await analyzeFn({ data: { xml } });
      setFileName(file.name);
      setMatches(res.matches);
      setErrors(res.errors);
      const pre: Record<number, boolean> = {};
      res.matches.forEach((m, i) => { if (m.status === "matched") pre[i] = true; });
      setSelected(pre);
      if (res.matches.length === 0) toast.error("Aucune écriture exploitable dans ce fichier.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Lecture impossible");
    } finally {
      setBusy(false);
    }
  }, [analyzeFn]);

  const applicable = (matches ?? [])
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.invoice && (m.status === "matched" || m.status === "amount_mismatch"));

  const apply = useCallback(async () => {
    const items = applicable
      .filter(({ i }) => selected[i])
      .map(({ m }) => ({
        invoice_id: m.invoice!.id,
        montant: Math.min(m.amount, m.invoice!.solde),
        date_paiement: m.date,
        reference_bancaire: m.bankRef ?? m.reference,
      }));
    if (items.length === 0) { toast.error("Sélectionnez au moins une écriture."); return; }
    setBusy(true);
    try {
      const res = await applyFn({ data: { items } });
      const failed = res.results.filter((r) => !r.ok);
      toast.success(`${res.applied} encaissement(s) enregistré(s).`);
      if (failed.length > 0) toast.error(`${failed.length} ignoré(s) : ${failed[0]!.message}`);
      setMatches(null); setSelected({}); setFileName(null);
      if (fileRef.current) fileRef.current.value = "";
      onApplied?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  }, [applicable, selected, applyFn, onApplied]);

  return (
    <section className="rounded-lg border border-border bg-card p-4 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Landmark className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">Rapprochement bancaire (camt.054)</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Importez l'avis de crédit XML fourni par votre banque (ISO 20022, camt.054). Les écritures sont
        rapprochées avec vos factures via la référence QR, puis vous validez les encaissements à enregistrer.
        Le fichier est analysé par HoliSwiss, sans service externe.
      </p>

      <div className="grid gap-2 sm:max-w-md">
        <Label htmlFor="camt-file" className="text-xs">Fichier camt.054 (.xml)</Label>
        <Input
          id="camt-file" ref={fileRef} type="file" accept=".xml,text/xml,application/xml"
          className="min-h-11"
          disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
        />
        {fileName && <p className="text-xs text-muted-foreground">Fichier analysé : {fileName}</p>}
      </div>

      {errors.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-amber-600 dark:text-amber-400">
          {errors.map((e) => (
            <li key={e} className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />{e}
            </li>
          ))}
        </ul>
      )}

      {matches && matches.length > 0 && (
        <>
          <ul className="mt-4 space-y-2">
            {matches.map((m, i) => {
              const ui = STATUS_UI[m.status];
              const selectable = Boolean(m.invoice) && (m.status === "matched" || m.status === "amount_mismatch");
              return (
                <li key={`${m.bankRef ?? m.reference ?? "x"}-${i}`} className={`rounded-md border p-3 ${ui.cls}`}>
                  <div className="flex items-start gap-3">
                    {selectable ? (
                      <Checkbox
                        checked={Boolean(selected[i])}
                        onCheckedChange={(v) => setSelected((s) => ({ ...s, [i]: Boolean(v) }))}
                        aria-label={`Enregistrer l'encaissement de ${money(m.amount, m.currency)}`}
                        className="mt-1"
                      />
                    ) : (
                      <ui.Icon className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {money(m.amount, m.currency)}
                        {m.date ? ` · ${m.date}` : ""}
                        {m.debtor ? ` · ${m.debtor}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground break-all">
                        Réf. {m.reference ?? "—"} · {ui.label}
                      </p>
                      <p className="text-xs mt-1">{m.message}</p>
                      {m.invoice && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Facture {m.invoice.numero_facture} — solde {money(m.invoice.solde, m.invoice.currency)}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => void apply()} disabled={busy} className="min-h-11">
              <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
              Enregistrer les encaissements sélectionnés
            </Button>
            <span className="text-xs text-muted-foreground">
              {applicable.filter(({ i }) => selected[i]).length} sélectionné(s) sur {applicable.length} rapprochable(s)
            </span>
          </div>
        </>
      )}
    </section>
  );
}
