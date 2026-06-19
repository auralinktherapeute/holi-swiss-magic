import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Check, Sparkles, Crown, Star, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hreflangLinks } from "@/lib/seo";

export const Route = createFileRoute("/$lang/tarifs/")({
  component: PricingPage,
  head: ({ params }) => {
    const lang = params.lang;
    const titles: Record<string, string> = {
      fr: "Tarifs Holiswiss — Plans pour thérapeutes",
      de: "Holiswiss Preise — Pläne für Therapeuten",
      it: "Prezzi Holiswiss — Piani per terapeuti",
      en: "Holiswiss Pricing — Plans for therapists",
    };
    const descs: Record<string, string> = {
      fr: "Comparez les plans Holiswiss : gratuit, Essentiel à 49 CHF, Élite à 99 CHF. Visibilité, réservation en ligne, statistiques et support dédié.",
      de: "Vergleichen Sie Holiswiss-Pläne: kostenlos, Essentiel zu 49 CHF, Élite zu 99 CHF. Sichtbarkeit, Online-Buchung, Statistiken, dedizierter Support.",
      it: "Confronta i piani Holiswiss: gratuito, Essentiel a 49 CHF, Élite a 99 CHF. Visibilità, prenotazione online, statistiche e supporto dedicato.",
      en: "Compare Holiswiss plans: free, Essentiel at CHF 49, Élite at CHF 99. Visibility, online booking, analytics and dedicated support.",
    };
    const title = titles[lang] ?? titles.fr;
    const description = descs[lang] ?? descs.fr;
    const url = `https://holiswiss.ch/${lang}/tarifs`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: url }, ...hreflangLinks("/tarifs")],
    };
  },
});

function PricingPage() {
  const { lang } = useParams({ from: "/$lang/tarifs/" });
  const { t } = useTranslation();

  type PlanKey = "basic" | "essentiel" | "elite";
  const planMeta: { key: PlanKey; price: number; icon: typeof Star; highlight?: boolean; badgeKey?: "recommended" | "excellence" }[] = [
    { key: "basic", price: 0, icon: Star },
    { key: "essentiel", price: 49, icon: Sparkles, highlight: true, badgeKey: "recommended" },
    { key: "elite", price: 99, icon: Crown, badgeKey: "excellence" },
  ];
  const plans = planMeta.map((p) => ({
    ...p,
    name: t(`pricing.plans.${p.key}.name`),
    tagline: t(`pricing.plans.${p.key}.tagline`),
    features: t(`pricing.plans.${p.key}.features`, { returnObjects: true }) as string[],
    cta: t(`pricing.plans.${p.key}.cta`),
    badge: p.badgeKey ? t(`pricing.${p.badgeKey}`) : undefined,
  }));
  const reassurance = t("pricing.reassurance", { returnObjects: true }) as { title: string; desc: string }[];

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#1a0a2e]">
      {/* Ambient glow background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-[#b86ef9]/20 blur-[120px]" />
        <div className="absolute top-1/3 right-0 h-[400px] w-[400px] rounded-full bg-[#5cc8fa]/10 blur-[100px]" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-[#f0b429]/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#b86ef9]/30 bg-[#b86ef9]/10 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-[#d4a5f9]">
            <Sparkles className="h-3 w-3" /> {t("pricing.badge")}
          </span>
          <h1 className="mt-4 font-serif text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {t("pricing.title_part1")} <span className="bg-gradient-to-r from-[#b86ef9] via-[#d4a5f9] to-[#f0b429] bg-clip-text text-transparent">{t("pricing.title_highlight")}</span>
          </h1>
          <p className="mt-3 text-base text-[#d4c4e0]">
            {t("pricing.subtitle")}
          </p>
        </div>

        {/* Plans grid */}
        <div className="mx-auto mt-10 flex max-w-6xl flex-col items-stretch justify-center gap-5 lg:flex-row lg:gap-6">
          {plans.map((p) => {
            const Icon = p.icon;
            const isHighlight = p.highlight;
            const widthClass =
              p.key === "basic"
                ? "lg:max-w-[260px]"
                : p.key === "essentiel"
                ? "lg:max-w-[340px]"
                : "lg:max-w-[300px]";
            return (
              <div
                key={p.key}
                className={`group relative flex flex-col rounded-2xl p-6 transition-all duration-300 ${widthClass} ${
                  isHighlight
                    ? "border-2 border-[#b86ef9] bg-gradient-to-b from-[#3d1a5c] to-[#2a1142] shadow-[0_0_40px_rgba(184,110,249,0.35)]"
                    : p.key === "elite"
                    ? "border border-[#f0b429]/40 bg-gradient-to-b from-[#2a1142] to-[#1a0a2e] shadow-[0_0_30px_rgba(240,180,41,0.15)] hover:border-[#f0b429]/70"
                    : "border border-[#b86ef9]/20 bg-[#2a1142]/60 backdrop-blur hover:border-[#b86ef9]/40"
                }`}
              >
                {p.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest shadow-lg ${
                        isHighlight
                          ? "bg-gradient-to-r from-[#b86ef9] to-[#9b4ddc] text-white"
                          : "bg-gradient-to-r from-[#f0b429] to-[#e08a00] text-[#1a0a2e]"
                      }`}
                    >
                      {p.badge}
                    </span>
                  </div>
                )}

                {/* Icon */}
                <div
                  className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl ${
                    p.key === "elite"
                      ? "bg-gradient-to-br from-[#f0b429]/30 to-[#e08a00]/20 ring-1 ring-[#f0b429]/40"
                      : "bg-gradient-to-br from-[#b86ef9]/30 to-[#5cc8fa]/20 ring-1 ring-[#b86ef9]/30"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${p.key === "elite" ? "text-[#f0b429]" : "text-[#d4a5f9]"}`} />
                </div>

                <h3 className="font-serif text-xl font-semibold text-white">{p.name}</h3>
                <p className="mt-0.5 text-xs text-[#d4c4e0]">{p.tagline}</p>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-serif text-4xl font-bold text-white">
                    {p.price}
                  </span>
                  <span className="text-lg font-semibold text-white">CHF</span>
                  <span className="ml-1 text-xs text-[#d4c4e0]">{t("pricing.month")}</span>
                </div>
                {p.price === 0 && (
                  <p className="mt-0.5 text-[11px] text-[#9d8aa8]">{t("pricing.no_commitment")}</p>
                )}

                <div className="my-5 h-px w-full bg-gradient-to-r from-transparent via-[#b86ef9]/30 to-transparent" />

                <ul className="flex-1 space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-white/90">
                      <span
                        className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                          p.key === "elite"
                            ? "bg-[#f0b429]/20 text-[#f0b429]"
                            : "bg-[#b86ef9]/20 text-[#d4a5f9]"
                        }`}
                      >
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                      <span className="leading-snug">{f}</span>
                    </li>
                  ))}
                </ul>

                <Link to="/$lang/inscription" params={{ lang }} className="mt-6 block">
                  <Button
                    className={`group/btn w-full rounded-xl py-5 text-sm font-semibold transition-all ${
                      isHighlight
                        ? "bg-gradient-to-r from-[#b86ef9] to-[#9b4ddc] text-white shadow-lg shadow-[#b86ef9]/40 hover:shadow-xl hover:shadow-[#b86ef9]/60"
                        : p.key === "elite"
                        ? "bg-gradient-to-r from-[#f0b429] to-[#e08a00] text-[#1a0a2e] shadow-lg shadow-[#f0b429]/30 hover:shadow-xl hover:shadow-[#f0b429]/50"
                        : "border border-[#b86ef9]/40 bg-transparent text-white hover:bg-[#b86ef9]/10"
                    }`}
                    variant={isHighlight || p.key === "elite" ? "default" : "outline"}
                  >
                    {p.cta}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>

        {/* Reassurance */}
        <div className="mt-10 grid gap-4 rounded-xl border border-[#b86ef9]/20 bg-[#2a1142]/40 p-6 backdrop-blur sm:grid-cols-3">
          {reassurance.map((item) => (
            <div key={item.title} className="text-center sm:text-left">
              <div className="text-sm font-semibold text-white">{item.title}</div>
              <div className="mt-0.5 text-xs text-[#d4c4e0]">{item.desc}</div>
            </div>
          ))}
        </div>

        {/* FAQ teaser */}
        <div className="mt-8 text-center text-xs text-[#d4c4e0]">
          {t("pricing.faq_question")}{" "}
          <Link to="/$lang/contact" params={{ lang }} className="font-semibold text-[#d4a5f9] underline-offset-4 hover:underline">
            {t("pricing.faq_link")}
          </Link>
        </div>
      </div>
    </div>
  );
}