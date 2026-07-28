import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, CreditCard, Download, Eye, FileText, Receipt } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listMySubscriptionInvoices,
  type SubscriptionInvoice,
} from "@/lib/subscription-invoices.functions";

export const Route = createFileRoute("/dashboard/abonnement")({ component: Page });

const PLAN_KEYS: { id: "basic" | "essentiel" | "elite"; price: number; current?: boolean }[] = [
  { id: "basic", price: 0 },
  { id: "essentiel", price: 49, current: true },
  { id: "elite", price: 99 },
];

function Page() {
  const { t } = useTranslation();
  const plans = PLAN_KEYS.map((p) => ({
    ...p,
    name: t(`pricing.plans.${p.id}.name`),
    tagline: t(`pricing.plans.${p.id}.tagline`),
    features: t(`pricing.plans.${p.id}.features`, { returnObjects: true }) as string[],
  }));
  const active = plans.find((p) => p.current)!;
  return (
    <div className="p-6 md:p-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t("dashboard.subscription")}</h1>
        <p className="text-muted-foreground mt-1">Plan actif et facturation</p>
      </div>

      <Card className="bg-gradient-to-br from-[#522870] to-[#3d1a5c] border-primary/40 shadow-[0_0_30px_rgba(184,110,249,0.25)]">
        <CardContent className="p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center"><Sparkles className="h-6 w-6 text-primary" /></div>
            <div>
              <Badge className="bg-primary/20 text-primary border-primary/30 mb-1">Plan actif</Badge>
              <div className="text-2xl font-bold text-foreground">{active.name} · {active.price} CHF / mois</div>
              <div className="text-sm text-muted-foreground">Prochain prélèvement le 1er juillet 2026</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary">Changer de moyen de paiement</Button>
            <Button variant="ghost">Annuler</Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Tous les plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => (
            <Card key={p.id} className={`bg-surface border ${p.current ? "border-primary shadow-[0_0_30px_rgba(184,110,249,0.25)]" : "border-border/60"}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{p.name}</CardTitle>
                  {p.current && <Badge className="bg-primary text-primary-foreground">Actif</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{p.tagline}</p>
                <div className="mt-2"><span className="text-3xl font-bold text-foreground">{p.price}</span><span className="text-muted-foreground"> CHF / mois</span></div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2"><Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /><span className="text-foreground/80">{f}</span></li>
                  ))}
                </ul>
                {!p.current && <Button className="w-full bg-primary hover:bg-primary/90">Choisir {p.name}</Button>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <InvoicesSection />
    </div>
  );
}

// ─── Invoices ────────────────────────────────────────────────────────────────

const STATUS_META: Record<SubscriptionInvoice["status"], { label: string; className: string }> = {
  paid: { label: "Payée", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  open: { label: "En attente", className: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  pending: { label: "En attente", className: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  draft: { label: "Brouillon", className: "bg-muted/40 text-muted-foreground border-border/60" },
  failed: { label: "Échouée", className: "bg-red-500/15 text-red-300 border-red-500/30" },
  uncollectible: { label: "Échouée", className: "bg-red-500/15 text-red-300 border-red-500/30" },
  void: { label: "Annulée", className: "bg-muted/40 text-muted-foreground border-border/60" },
  refunded: { label: "Remboursée", className: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
};

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-CH", { style: "currency", currency: currency || "CHF" }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency || "CHF"}`;
  }
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-CH", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function InvoicesSection() {
  const listFn = useServerFn(listMySubscriptionInvoices);
  const [selected, setSelected] = useState<SubscriptionInvoice | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-subscription-invoices"],
    queryFn: () => listFn(),
  });

  const invoices = data ?? [];

  return (
    <>
      <Card className="bg-surface border-border/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> Mes factures
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Historique des factures de votre abonnement Holiswiss
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg bg-background/50" />
              ))}
            </div>
          ) : isError ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              Impossible de charger vos factures.
              <Button size="sm" variant="ghost" className="ml-2" onClick={() => refetch()}>
                Réessayer
              </Button>
            </div>
          ) : invoices.length === 0 ? (
            <InvoiceEmptyState />
          ) : (
            invoices.map((inv) => (
              <InvoiceRow key={inv.id} invoice={inv} onView={() => setSelected(inv)} />
            ))
          )}
        </CardContent>
      </Card>

      <InvoiceDetailsDialog invoice={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function InvoiceRow({ invoice, onView }: { invoice: SubscriptionInvoice; onView: () => void }) {
  const meta = STATUS_META[invoice.status] ?? STATUS_META.draft;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 p-3 hover:bg-background/60 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="font-medium text-foreground truncate">{invoice.invoice_number}</div>
          <div className="text-xs text-muted-foreground">
            {formatDate(invoice.invoice_date)}
            {invoice.plan_name ? ` · ${invoice.plan_name}` : ""}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
        <div className="text-sm text-foreground/90 tabular-nums w-24 text-right">
          {formatMoney(invoice.amount_total, invoice.currency)}
        </div>
        <Button size="sm" variant="ghost" onClick={onView} aria-label="Voir la facture">
          <Eye className="h-4 w-4" />
        </Button>
        <DownloadButton invoice={invoice} />
      </div>
    </div>
  );
}

function DownloadButton({ invoice }: { invoice: SubscriptionInvoice }) {
  const url = invoice.invoice_pdf_url || invoice.hosted_invoice_url;
  const onClick = () => {
    if (!url) {
      toast.error("La facture n'est pas encore disponible.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };
  return (
    <Button size="sm" variant="ghost" onClick={onClick} aria-label="Télécharger la facture">
      <Download className="h-4 w-4" />
    </Button>
  );
}

function InvoiceEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/30 px-6 py-10 text-center">
      <div className="h-12 w-12 rounded-full bg-primary/15 text-primary flex items-center justify-center mb-3">
        <Receipt className="h-6 w-6" />
      </div>
      <div className="text-foreground font-medium">Aucune facture pour le moment</div>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        Vos factures d'abonnement Holiswiss apparaîtront ici dès qu'elles seront émises. Vous pourrez les consulter et les télécharger en un clic.
      </p>
    </div>
  );
}

function InvoiceDetailsDialog({ invoice, onClose }: { invoice: SubscriptionInvoice | null; onClose: () => void }) {
  const open = !!invoice;
  const meta = invoice ? STATUS_META[invoice.status] ?? STATUS_META.draft : null;
  const url = invoice ? invoice.invoice_pdf_url || invoice.hosted_invoice_url : null;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        {invoice && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Facture {invoice.invoice_number}
              </DialogTitle>
              <DialogDescription>
                Émise le {formatDate(invoice.invoice_date)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Statut</span>
                {meta && <Badge variant="outline" className={meta.className}>{meta.label}</Badge>}
              </div>
              <DetailRow label="Plan" value={invoice.plan_name} />
              <DetailRow
                label="Période"
                value={
                  invoice.period_start || invoice.period_end
                    ? `${formatDate(invoice.period_start)} → ${formatDate(invoice.period_end)}`
                    : null
                }
              />
              <div className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-1.5">
                <DetailLine label="Montant HT" value={invoice.amount_subtotal != null ? formatMoney(invoice.amount_subtotal, invoice.currency) : null} />
                <DetailLine label="TVA" value={invoice.amount_tax != null ? formatMoney(invoice.amount_tax, invoice.currency) : null} />
                <div className="h-px bg-border/60 my-1" />
                <DetailLine label="Total TTC" value={formatMoney(invoice.amount_total, invoice.currency)} strong />
              </div>
              <DetailRow label="Moyen de paiement" value={invoice.payment_method} />
              <div className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-1.5">
                <DetailLine label="Facturé à" value={invoice.customer_name} />
                <DetailLine label="Email" value={invoice.customer_email} />
                <DetailLine label="Société" value={invoice.company_name} />
                <DetailLine label="Adresse" value={invoice.billing_address} />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="ghost" onClick={onClose}>Fermer</Button>
              <Button
                onClick={() => {
                  if (!url) { toast.error("La facture n'est pas encore disponible."); return; }
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
                className="bg-primary hover:bg-primary/90"
              >
                <Download className="h-4 w-4 mr-2" /> Télécharger le PDF
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right">{value}</span>
    </div>
  );
}

function DetailLine({ label, value, strong }: { label: string; value: string | null | undefined; strong?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "text-foreground font-semibold tabular-nums" : "text-foreground/90 tabular-nums"}>{value}</span>
    </div>
  );
}
