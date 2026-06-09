import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCHF } from "@/lib/constants";

export const Route = createFileRoute("/$lang/tarifs/")({
  component: PricingPage,
});

function PricingPage() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/tarifs/" });

  const plans = [
    {
      key: "free", price: 0,
      features: ["Profil de base", "Visible dans l'annuaire", "1 photo", "Coordonnées"],
    },
    {
      key: "pro", price: 29, highlight: true,
      features: ["Tout Free", "Agenda en ligne", "Avis vérifiés", "Articles de blog", "Statistiques"],
    },
    {
      key: "premium", price: 59,
      features: ["Tout Pro", "Mise en avant", "Badge vérifié", "Support prioritaire", "Événements"],
    },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">{t("pricing.title")}</h1>
        <p className="mt-3 text-muted-foreground">{t("pricing.subtitle")}</p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.key}
            className={`rounded-2xl border bg-surface p-8 ${
              "highlight" in p && p.highlight
                ? "border-primary shadow-xl shadow-primary/10 ring-2 ring-primary/30 md:scale-105"
                : "border-border"
            }`}
          >
            {"highlight" in p && p.highlight && (
              <span className="inline-block rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                Recommandé
              </span>
            )}
            <h3 className="mt-3 text-xl font-semibold">{t(`pricing.${p.key}.name`)}</h3>
            <div className="mt-3 text-4xl font-bold">
              {p.price === 0 ? "0 CHF" : formatCHF(p.price)}
              {p.price > 0 && <span className="text-base font-normal text-muted-foreground">{t("pricing.month")}</span>}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t(`pricing.${p.key}.desc`)}</p>
            <ul className="mt-6 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-accent mt-0.5" /> {f}
                </li>
              ))}
            </ul>
            <Link to="/$lang/inscription" params={{ lang }} className="mt-8 block">
              <Button
                className="w-full"
                variant={"highlight" in p && p.highlight ? "default" : "outline"}
              >
                {t("pricing.cta")}
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}