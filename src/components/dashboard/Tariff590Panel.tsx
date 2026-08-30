import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listTariffCatalogs, listTariffPositions,
  type TariffCatalog, type TariffPosition,
} from "@/lib/billing-services.functions";
import { TARIFF_590_NOTICE } from "@/components/dashboard/BillingServices";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Consultation en lecture seule du catalogue Tarif 590 importé par l'administration. */
export default function Tariff590Panel() {
  const catalogsFn = useServerFn(listTariffCatalogs);
  const positionsFn = useServerFn(listTariffPositions);

  const [catalogs, setCatalogs] = useState<TariffCatalog[]>([]);
  const [positions, setPositions] = useState<TariffPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const refresh = useCallback(async () => {
    const [c, p] = await Promise.all([catalogsFn(), positionsFn({ data: {} })]);
    setCatalogs(c); setPositions(p); setLoading(false);
  }, [catalogsFn, positionsFn]);

  useEffect(() => {
    refresh().catch((e: any) => { toast.error(e.message); setLoading(false); });
  }, [refresh]);

  const needle = q.trim().toLowerCase();
  const visible = needle
    ? positions.filter((p) => `${p.code} ${p.designation}`.toLowerCase().includes(needle))
    : positions;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Tarif 590</h2>
        <p className="text-sm text-muted-foreground">
          Positions du catalogue en vigueur, importées et validées par l'administration
          HoliSwiss. Associez-les à vos prestations pour les faire figurer sur vos factures.
        </p>
      </div>

      {loading ? (
        <div className="h-12 rounded-lg bg-muted animate-pulse" aria-busy="true" />
      ) : positions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun catalogue Tarif 590 n'est encore importé. Aucune position n'est inventée :
          le catalogue officiel doit être fourni puis importé par l'administration.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {catalogs.filter((c) => c.is_active).map((c) => `${c.name} · version ${c.version}`).join(" — ")
              || "Catalogue importé"}
          </p>
          <div className="space-y-1 max-w-sm">
            <Label htmlFor="t590-q" className="text-xs">Rechercher une position</Label>
            <Input id="t590-q" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Code ou désignation" className="min-h-11" />
          </div>
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <caption className="sr-only">Positions du Tarif 590</caption>
              <thead className="bg-muted/50">
                <tr>
                  <th scope="col" className="p-3 text-left">Code</th>
                  <th scope="col" className="p-3 text-left">Désignation</th>
                  <th scope="col" className="p-3 text-left">Unité</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id} className="border-t border-border/60">
                    <td className="p-3 font-mono text-xs">{p.code}</td>
                    <td className="p-3">{p.designation}</td>
                    <td className="p-3 text-muted-foreground">{p.unit ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground">{TARIFF_590_NOTICE}</p>
    </section>
  );
}
