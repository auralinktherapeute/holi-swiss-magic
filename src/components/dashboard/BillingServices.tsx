import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import {
  listMyBillingServices, upsertBillingService, deleteBillingService,
  listTariffPositions, type BillingService, type TariffPosition,
} from "@/lib/billing-services.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

type Draft = {
  id?: string | null;
  name: string; description: string; category: string;
  duration_min: number; price: number; vat_rate: number;
  internal_code: string; tariff_position_id: string; is_active: boolean;
};

const EMPTY: Draft = {
  id: null, name: "", description: "", category: "",
  duration_min: 60, price: 0, vat_rate: 0,
  internal_code: "", tariff_position_id: "", is_active: true,
};

export const TARIFF_590_NOTICE =
  "Le Tarif 590 est un standard de facturation. Son utilisation ne garantit pas le remboursement par l'assurance complémentaire.";

export default function BillingServices() {
  const listFn = useServerFn(listMyBillingServices);
  const upsertFn = useServerFn(upsertBillingService);
  const deleteFn = useServerFn(deleteBillingService);
  const tariffsFn = useServerFn(listTariffPositions);

  const [rows, setRows] = useState<BillingService[]>([]);
  const [tariffs, setTariffs] = useState<TariffPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const [r, t] = await Promise.all([listFn(), tariffsFn({ data: {} })]);
    setRows(r); setTariffs(t); setLoading(false);
  }, [listFn, tariffsFn]);

  useEffect(() => {
    refresh().catch((e: any) => { toast.error(e.message); setLoading(false); });
  }, [refresh]);

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) { toast.error("Indiquez le nom de la prestation."); return; }
    setSaving(true);
    try {
      await upsertFn({ data: {
        id: draft.id ?? null,
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        category: draft.category.trim() || null,
        duration_min: Number(draft.duration_min) || 0,
        price: Number(draft.price) || 0,
        currency: "CHF",
        vat_rate: Number(draft.vat_rate) || 0,
        internal_code: draft.internal_code.trim() || null,
        tariff_position_id: draft.tariff_position_id || null,
        is_active: draft.is_active,
        position: 0,
      } });
      toast.success("Prestation enregistrée.");
      setDraft(null);
      await refresh();
    } catch (e: any) { toast.error(e.message ?? "Erreur"); }
    finally { setSaving(false); }
  }

  async function remove(r: BillingService) {
    if (!window.confirm(`Supprimer la prestation « ${r.name} » ?`)) return;
    try {
      await deleteFn({ data: { id: r.id } });
      toast.success("Prestation supprimée.");
      await refresh();
    } catch (e: any) { toast.error(e.message ?? "Erreur"); }
  }

  const tariffLabel = (id: string | null) => {
    const t = tariffs.find((x) => x.id === id);
    return t ? `${t.code} — ${t.designation}` : "—";
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Catalogue de prestations</h2>
          <p className="text-sm text-muted-foreground">
            Vos prestations facturables : durée, prix, TVA et position Tarif 590 facultative.
            Elles s'insèrent en un clic dans une facture.
          </p>
        </div>
        <Button className="min-h-11" onClick={() => setDraft({ ...EMPTY })}>
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" /> Nouvelle prestation
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1].map((i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune prestation enregistrée. Créez-en une pour accélérer vos factures.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <caption className="sr-only">Vos prestations facturables</caption>
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="p-3 text-left">Prestation</th>
                <th scope="col" className="p-3 text-left">Durée</th>
                <th scope="col" className="p-3 text-right">Prix</th>
                <th scope="col" className="p-3 text-right">TVA</th>
                <th scope="col" className="p-3 text-left">Tarif 590</th>
                <th scope="col" className="p-3 text-left">Statut</th>
                <th scope="col" className="p-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="p-3">
                    <span className="font-medium">{r.name}</span>
                    {r.category ? <span className="block text-xs text-muted-foreground">{r.category}</span> : null}
                  </td>
                  <td className="p-3">{r.duration_min} min</td>
                  <td className="p-3 text-right">{Number(r.price).toFixed(2)} {r.currency}</td>
                  <td className="p-3 text-right">{Number(r.vat_rate).toFixed(1)} %</td>
                  <td className="p-3 text-xs">{tariffLabel(r.tariff_position_id)}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs ${r.is_active
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"}`}>
                      {r.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" className="min-h-11 min-w-11"
                      aria-label={`Modifier ${r.name}`}
                      onClick={() => setDraft({
                        id: r.id, name: r.name, description: r.description ?? "",
                        category: r.category ?? "", duration_min: r.duration_min,
                        price: Number(r.price), vat_rate: Number(r.vat_rate),
                        internal_code: r.internal_code ?? "",
                        tariff_position_id: r.tariff_position_id ?? "",
                        is_active: r.is_active,
                      })}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button size="icon" variant="ghost" className="min-h-11 min-w-11"
                      aria-label={`Supprimer ${r.name}`} onClick={() => remove(r)}>
                      <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{TARIFF_590_NOTICE}</p>

      <Dialog open={!!draft} onOpenChange={(o) => { if (!o) setDraft(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Modifier la prestation" : "Nouvelle prestation"}</DialogTitle>
            <DialogDescription>
              Ces informations préremplissent les lignes de vos factures.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="bs-name">Nom</Label>
                <Input id="bs-name" value={draft.name} className="min-h-11"
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bs-desc">Description</Label>
                <Textarea id="bs-desc" value={draft.description} rows={2}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="bs-cat">Catégorie</Label>
                  <Input id="bs-cat" value={draft.category} className="min-h-11"
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bs-code">Code interne</Label>
                  <Input id="bs-code" value={draft.internal_code} className="min-h-11"
                    onChange={(e) => setDraft({ ...draft, internal_code: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bs-dur">Durée (minutes)</Label>
                  <Input id="bs-dur" type="number" min={0} value={draft.duration_min} className="min-h-11"
                    onChange={(e) => setDraft({ ...draft, duration_min: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bs-price">Prix (CHF)</Label>
                  <Input id="bs-price" type="number" min={0} step="0.05" value={draft.price} className="min-h-11"
                    onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bs-vat">TVA (%)</Label>
                  <Input id="bs-vat" type="number" min={0} step="0.1" value={draft.vat_rate} className="min-h-11"
                    onChange={(e) => setDraft({ ...draft, vat_rate: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bs-tariff">Position Tarif 590</Label>
                  <select id="bs-tariff" value={draft.tariff_position_id}
                    className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                    onChange={(e) => setDraft({ ...draft, tariff_position_id: e.target.value })}>
                    <option value="">Aucune</option>
                    {tariffs.map((t) => (
                      <option key={t.id} value={t.id}>{t.code} — {t.designation}</option>
                    ))}
                  </select>
                </div>
              </div>
              {tariffs.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucun catalogue Tarif 590 n'est encore importé par l'administration.
                </p>
              )}
              <div className="flex items-center gap-3">
                <Switch id="bs-active" checked={draft.is_active}
                  onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
                <Label htmlFor="bs-active">Prestation active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setDraft(null)}>Annuler</Button>
            <Button className="min-h-11" onClick={save} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
