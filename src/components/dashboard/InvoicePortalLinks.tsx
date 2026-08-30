// Portail patient : création, envoi et révocation des liens sécurisés de facture.
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Link2, Mail, Ban, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  listInvoiceLinks, createInvoiceLink, revokeInvoiceLink, emailInvoiceLink,
  type InvoiceAccessLink,
} from "@/lib/invoice-portal.functions";

export default function InvoicePortalLinks({ invoiceId, clientEmail, onSent }: {
  invoiceId: string;
  clientEmail: string | null;
  onSent: () => void | Promise<void>;
}) {
  const listFn = useServerFn(listInvoiceLinks);
  const createFn = useServerFn(createInvoiceLink);
  const revokeFn = useServerFn(revokeInvoiceLink);
  const mailFn = useServerFn(emailInvoiceLink);

  const [links, setLinks] = useState<InvoiceAccessLink[]>([]);
  const [days, setDays] = useState("30");
  const [email, setEmail] = useState(clientEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setLinks(await listFn({ data: { invoice_id: invoiceId } })); }
    catch { /* silencieux : section secondaire */ }
  }, [invoiceId, listFn]);

  useEffect(() => { void load(); }, [load]);

  const nbDays = Math.min(365, Math.max(1, Number(days) || 30));

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); toast.success(label); await load(); }
    catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    finally { setBusy(false); }
  }

  const state = (l: InvoiceAccessLink) =>
    l.revoked_at ? "Révoqué"
      : new Date(l.expires_at).getTime() < Date.now() ? "Expiré"
        : `Actif jusqu'au ${new Date(l.expires_at).toLocaleDateString("fr-CH")}`;

  return (
    <section className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Link2 className="h-4 w-4" aria-hidden="true" /> Lien patient sécurisé
      </h3>
      <p className="text-xs text-muted-foreground">
        Le patient consulte sa facture et sa QR-facture via un lien personnel, expirant et
        révocable. Aucune donnée sensible n'apparaît dans l'adresse.
      </p>

      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <div className="space-y-1">
          <Label htmlFor="portal-email">Email du patient</Label>
          <Input id="portal-email" type="email" value={email} inputMode="email"
            onChange={(e) => setEmail(e.target.value)} placeholder="patient@exemple.ch" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="portal-days">Validité (jours)</Label>
          <Input id="portal-days" type="number" min={1} max={365} value={days}
            onChange={(e) => setDays(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="min-h-11" disabled={busy}
          onClick={() => run("Lien créé", async () => {
            const r = await createFn({ data: { invoice_id: invoiceId, days: nbDays } });
            setLastUrl(r.url);
          })}>
          <Link2 className="h-4 w-4 mr-2" aria-hidden="true" /> Créer un lien
        </Button>
        <Button className="min-h-11" disabled={busy || !email.trim()}
          onClick={() => run("Lien envoyé au patient", async () => {
            await mailFn({ data: { invoice_id: invoiceId, to: email.trim(), days: nbDays } });
            await onSent();
          })}>
          <Mail className="h-4 w-4 mr-2" aria-hidden="true" /> Envoyer le lien
        </Button>
      </div>

      {lastUrl && (
        <div className="rounded-md border border-border/60 bg-muted/40 p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Copiez ce lien maintenant : il ne sera plus affiché.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={lastUrl} onFocus={(e) => e.currentTarget.select()} />
            <Button variant="outline" className="min-h-11" aria-label="Copier le lien"
              onClick={() => {
                void navigator.clipboard?.writeText(lastUrl);
                toast.success("Lien copié");
              }}>
              <Copy className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}

      {links.length > 0 && (
        <ul className="divide-y divide-border/60 text-sm">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                {state(l)}
                <span className="block text-xs text-muted-foreground">
                  {l.view_count} consultation{l.view_count > 1 ? "s" : ""}
                  {l.last_viewed_at ? ` · dernière le ${new Date(l.last_viewed_at).toLocaleDateString("fr-CH")}` : ""}
                </span>
              </span>
              {!l.revoked_at && (
                <Button variant="ghost" size="sm" className="min-h-11" disabled={busy}
                  onClick={() => run("Lien révoqué", () => revokeFn({ data: { id: l.id } }))}>
                  <Ban className="h-4 w-4 mr-1 text-destructive" aria-hidden="true" /> Révoquer
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
