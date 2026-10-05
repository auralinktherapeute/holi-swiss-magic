import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CurrencyChangeDialog } from "@/components/dashboard/CurrencyChangeDialog";
import { changeClientCurrency } from "@/lib/currency.functions";
import { resolveEffectiveCurrency } from "@/lib/currency-consent";

type Choice = "default" | "CHF" | "EUR";

/** Bloc « Devise de facturation » de la fiche client (exception à la devise du cabinet). */
export function ClientCurrencyBlock({ clientId, clientName, clientCurrency, practiceCurrency }: {
  clientId: string; clientName: string; clientCurrency: string | null; practiceCurrency: string | null;
}) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const fn = useServerFn(changeClientCurrency);
  const eff = resolveEffectiveCurrency(clientCurrency, practiceCurrency);
  const def = resolveEffectiveCurrency(null, practiceCurrency).currency;
  const currentChoice: Choice = clientCurrency === "CHF" || clientCurrency === "EUR" ? clientCurrency : "default";
  const [choosing, setChoosing] = useState(false);
  const [pending, setPending] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: (c: { choice: Choice; ack: boolean }) => fn({ data: {
      clientId, currency: c.choice === "default" ? null : c.choice, acknowledged: c.ack, lang: i18n.language,
    } }),
    onSuccess: () => {
      toast.success(t("currency.saved"));
      qc.invalidateQueries({ queryKey: ["cabinet-client", clientId] });
      setPending(null); setChoosing(false); setError(null);
    },
    onError: () => setError(t("currency.error")),
  });

  const pick = (c: Choice) => {
    if (c === currentChoice) return;
    setError(null);
    const nextEff = c === "default" ? def : c;
    if (nextEff === eff.currency) mut.mutate({ choice: c, ack: false }); // devise effective inchangée : pas de pop-up
    else setPending(c);
  };

  return (
    <section className="rounded-lg border border-border p-3 space-y-2" data-testid="client-currency">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{t("currency.label")}</div>
          <div className="text-sm font-medium mt-0.5">
            {eff.source === "client_override"
              ? t("currency.source_client", { cur: eff.currency })
              : t("currency.source_practice", { cur: eff.currency })}
          </div>
        </div>
        <Button size="sm" variant="outline" className="min-h-11 shrink-0" onClick={() => setChoosing((v) => !v)}>
          <Pencil className="h-4 w-4 mr-1.5" aria-hidden="true" /> {t("currency.edit")}
        </Button>
      </div>
      {choosing && (
        <RadioGroup aria-label={t("currency.choose")} value={currentChoice} onValueChange={(v) => pick(v as Choice)} className="gap-2">
          {(["default", "CHF", "EUR"] as const).map((c) => (
            <label key={c} className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3 cursor-pointer">
              <RadioGroupItem value={c} disabled={mut.isPending} />
              <span className="text-sm">
                {c === "default" ? `${t("currency.use_default")} (${def})` : c === "CHF" ? t("currency.chf") : t("currency.eur")}
              </span>
            </label>
          ))}
        </RadioGroup>
      )}
      {error && !pending && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <CurrencyChangeDialog
        open={!!pending}
        title={t("currency.client_dialog_title")}
        warning={t("currency.client_warning", { clientName })}
        ackLabel={t("currency.client_ack")}
        pending={mut.isPending}
        error={error}
        onCancel={() => { setPending(null); setError(null); }}
        onConfirm={() => pending && mut.mutate({ choice: pending, ack: true })}
      />
    </section>
  );
}
