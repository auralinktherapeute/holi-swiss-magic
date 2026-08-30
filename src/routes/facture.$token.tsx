import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getInvoiceByToken } from "@/lib/invoice-portal.functions";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/facture/$token")({
  component: PortalPage,
  head: () => ({
    meta: [
      { title: "Votre facture — HoliSwiss" },
      { name: "description", content: "Consultez votre facture HoliSwiss en toute sécurité : prestations, montant, échéance et QR-facture suisse." },
      { property: "og:title", content: "Votre facture — HoliSwiss" },
      { property: "og:description", content: "Consultation sécurisée de votre facture HoliSwiss." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Invoice = Awaited<ReturnType<typeof getInvoiceByToken>> extends { invoice?: infer I }
  ? NonNullable<I>
  : never;

const STATUS_LABEL: Record<string, string> = {
  validee: "Validée", envoyee: "Envoyée", consultee: "Consultée",
  partiellement_payee: "Partiellement payée", payee: "Payée",
  en_retard: "En retard", annulee: "Annulée", avoir: "Avoir",
  en_litige: "En litige",
};

function PortalPage() {
  const { token } = Route.useParams();
  const fetchFn = useServerFn(getInvoiceByToken);
  const [state, setState] = useState<"loading" | "invalid" | "ready">("loading");
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    let alive = true;
    fetchFn({ data: { token } })
      .then((r) => {
        if (!alive) return;
        if (!r.ok) { setState("invalid"); return; }
        setInvoice(r.invoice as Invoice);
        setState("ready");
      })
      .catch(() => { if (alive) setState("invalid"); });
    return () => { alive = false; };
  }, [token, fetchFn]);

  if (state === "loading") {
    return (
      <main className="min-h-dvh grid place-items-center p-6">
        <div className="h-40 w-full max-w-2xl rounded-lg bg-muted animate-pulse" aria-busy="true" />
      </main>
    );
  }

  if (state === "invalid" || !invoice) {
    return (
      <main className="min-h-dvh grid place-items-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-semibold">Lien indisponible</h1>
          <p className="text-muted-foreground">
            Ce lien de facture a expiré, a été désactivé ou n'est pas valide.
            Contactez votre thérapeute pour en recevoir un nouveau.
          </p>
        </div>
      </main>
    );
  }

  const fmt = (n: number) => `${n.toFixed(2)} ${invoice.currency}`;
  const date = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-CH") : "—");

  return (
    <main className="min-h-dvh bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1">
          <p className="text-sm text-muted-foreground">Facture de {invoice.therapistName}</p>
          <h1 className="text-2xl font-semibold">Facture {invoice.numero_facture}</h1>
          <p className="text-sm text-muted-foreground">
            Émise le {date(invoice.date_emission)} · Échéance {date(invoice.date_echeance)} ·{" "}
            {STATUS_LABEL[invoice.statut] ?? invoice.statut}
          </p>
        </header>

        <section className="grid grid-cols-3 gap-3">
          {[
            { label: "Total", value: fmt(invoice.montant_total) },
            { label: "Déjà payé", value: fmt(invoice.montant_paye) },
            { label: "Solde", value: fmt(invoice.solde) },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border/60 bg-card p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-lg font-semibold">{s.value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-border/60 bg-card overflow-hidden">
          <h2 className="px-4 py-3 text-sm font-semibold border-b border-border/60">Prestations</h2>
          <ul className="divide-y divide-border/60">
            {invoice.lines.map((l, i) => (
              <li key={i} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                <span>
                  {l.description}
                  <span className="block text-xs text-muted-foreground">
                    {l.quantite} × {l.prix_unitaire.toFixed(2)} {invoice.currency}
                  </span>
                </span>
                <span className="font-medium whitespace-nowrap">{fmt(l.montant_ht)}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex justify-end">
          <Button
            className="min-h-11"
            onClick={() => {
              const w = window.open("", "_blank");
              if (!w) return;
              w.document.write(invoice.html);
              w.document.close();
              w.focus();
              w.print();
            }}
          >
            <Printer className="h-4 w-4 mr-2" aria-hidden="true" /> Imprimer / PDF avec QR-facture
          </Button>
        </div>

        <section className="rounded-lg border border-border/60 bg-card overflow-hidden">
          <h2 className="px-4 py-3 text-sm font-semibold border-b border-border/60">
            Facture complète et QR-facture suisse
          </h2>
          <iframe
            title={`Facture ${invoice.numero_facture}`}
            srcDoc={invoice.html}
            className="w-full h-[900px] bg-white"
          />
        </section>

        <p className="text-xs text-muted-foreground text-center">
          Ce lien est personnel et limité dans le temps. HoliSwiss ne conserve aucune donnée
          bancaire de paiement.
        </p>
      </div>
    </main>
  );
}
