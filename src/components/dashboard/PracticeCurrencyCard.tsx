import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CurrencyChangeDialog } from "@/components/dashboard/CurrencyChangeDialog";
import { changePracticeCurrency, getPracticeCurrency } from "@/lib/currency.functions";
import { formatAmount, type Currency } from "@/lib/currency-consent";

/** Devise du cabinet : affichage + changement avec consentement et re-tarification. */
export function PracticeCurrencyCard() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const getFn = useServerFn(getPracticeCurrency);
  const changeFn = useServerFn(changePracticeCurrency);
  const { data } = useQuery({ queryKey: ["practice-currency"], queryFn: () => getFn() });
  const [choosing, setChoosing] = useState(false);
  const [target, setTarget] = useState<Currency | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const current = data?.currency ?? "CHF";
  const services = data?.services ?? [];
  const pricesValid = services.every((s) => {
    const v = prices[s.id];
    return v !== undefined && v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= 0;
  });

  const close = () => { setTarget(null); setChoosing(false); setPrices({}); setError(null); };
  const mut = useMutation({
    mutationFn: () => changeFn({ data: {
      currency: target!, acknowledged: true, lang: i18n.language,
      prices: services.map((s) => ({ id: s.id, price: Number(prices[s.id]) })),
    } }),
    onSuccess: () => {
      toast.success(t("currency.saved"));
      qc.invalidateQueries({ queryKey: ["practice-currency"] });
      qc.invalidateQueries({ queryKey: ["invoice-settings"] });
      qc.invalidateQueries({ queryKey: ["cabinet-client"] });
      close();
    },
    onError: () => setError(t("currency.error")),
  });

  return (
    <div className="space-y-2 rounded-lg border border-border p-3" data-testid="practice-currency">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{t("currency.practice_title")}</div>
          <div className="text-sm font-medium mt-0.5">{current === "EUR" ? t("currency.eur") : t("currency.chf")}</div>
          <div className="text-xs text-muted-foreground">{t("currency.historical_note")}</div>
        </div>
        <Button type="button" size="sm" variant="outline" className="min-h-11" disabled={!data?.hasSettings}
          onClick={() => setChoosing((v) => !v)}>
          <Pencil className="h-4 w-4 mr-1.5" aria-hidden="true" /> {t("currency.edit")}
        </Button>
      </div>
      {!data?.hasSettings && data && <p className="text-xs text-amber-500">{t("currency.settings_first")}</p>}
      {choosing && (
        <RadioGroup aria-label={t("currency.choose")} value={current}
          onValueChange={(v) => { if (v !== current) { setTarget(v as Currency); setPrices({}); setError(null); } }}
          className="gap-2 pt-1">
          {(["CHF", "EUR"] as const).map((c) => (
            <label key={c} className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3 cursor-pointer">
              <RadioGroupItem value={c} /> <span className="text-sm">{c === "CHF" ? t("currency.chf") : t("currency.eur")}</span>
            </label>
          ))}
        </RadioGroup>
      )}
      <CurrencyChangeDialog
        open={!!target}
        title={t("currency.practice_dialog_title")}
        warning={t("currency.practice_warning")}
        ackLabel={t("currency.practice_ack")}
        canConfirm={pricesValid}
        pending={mut.isPending}
        error={error}
        onCancel={close}
        onConfirm={() => { if (!pricesValid) { setError(t("currency.price_required")); return; } mut.mutate(); }}
      >
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t("currency.prices_title", { cur: target })}</h3>
          <p className="text-xs text-muted-foreground">{t("currency.prices_hint")}</p>
          {services.length === 0 && <p className="text-xs text-muted-foreground">{t("currency.no_services")}</p>}
          {services.map((s) => (
            <div key={s.id} className="grid grid-cols-1 gap-1 sm:grid-cols-[1fr_auto_9rem] sm:items-center sm:gap-3 rounded-md border border-border p-2">
              <span className="text-sm font-medium break-words">{s.name}</span>
              <span className="text-xs text-muted-foreground">{t("currency.old_price")} : {formatAmount(s.price, s.currency)}</span>
              <div>
                <Label htmlFor={`np-${s.id}`} className="sr-only">{t("currency.new_price", { cur: target })} — {s.name}</Label>
                <Input id={`np-${s.id}`} type="number" inputMode="decimal" min={0} step="0.05" className="min-h-11"
                  placeholder={t("currency.new_price", { cur: target })}
                  value={prices[s.id] ?? ""} onChange={(e) => setPrices((p) => ({ ...p, [s.id]: e.target.value }))} />
              </div>
            </div>
          ))}
        </section>
      </CurrencyChangeDialog>
    </div>
  );
}
