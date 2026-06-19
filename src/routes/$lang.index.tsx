import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Search, MapPin, ShieldCheck, Star, CalendarCheck, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CANTONS, THERAPY_CATEGORIES, SPOKEN_LANGUAGES, formatCHF } from "@/lib/constants";
import { HeroVariants } from "@/components/holiswiss/HeroVariants";
import { NearbyTherapistsSwiss } from "@/components/holiswiss/NearbyTherapistsSwiss";
import { WaitlistReassuranceBlock } from "@/components/holiswiss/WaitlistReassuranceBlock";
import { hreflangLinks, ogLocale } from "@/lib/seo";

export const Route = createFileRoute("/$lang/")({
  component: HomePage,
  head: ({ params }) => {
    const lang = params.lang;
    const titles: Record<string, string> = {
      fr: "Holiswiss — Thérapeutes holistiques en Suisse",
      de: "Holiswiss — Ganzheitliche Therapeuten in der Schweiz",
      it: "Holiswiss — Terapeuti olistici in Svizzera",
      en: "Holiswiss — Holistic therapists across Switzerland",
    };
    const descs: Record<string, string> = {
      fr: "Trouvez un thérapeute certifié près de chez vous : sophrologie, hypnose, naturopathie, méditation. 26 cantons, profils vérifiés, réservation en ligne.",
      de: "Finden Sie zertifizierte Therapeuten in Ihrer Nähe: Sophrologie, Hypnose, Naturheilkunde, Meditation. 26 Kantone, geprüfte Profile, Online-Buchung.",
      it: "Trova terapeuti certificati vicino a te: sofrologia, ipnosi, naturopatia, meditazione. 26 cantoni, profili verificati, prenotazione online.",
      en: "Find certified holistic therapists near you: sophrology, hypnosis, naturopathy, meditation. 26 cantons, verified profiles, online booking.",
    };
    const title = titles[lang] ?? titles.fr;
    const description = descs[lang] ?? descs.fr;
    const url = `https://holiswiss.ch/${lang}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { property: "og:locale", content: ogLocale(lang) },
      ],
      links: [{ rel: "canonical", href: url }, ...hreflangLinks("/")],
    };
  },
});

function HomePage() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/" });

  const popularSearches = t("home.popular_searches", { returnObjects: true }) as string[];

  return (
    <>
      {/* Hero (4 variants — dev selector bottom-right) */}
      <HeroVariants />

      {/* Specialty grid */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-white">{t("home.specialties")}</h2>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {THERAPY_CATEGORIES.map((c) => (
            <button
              key={c.slug}
              className="group flex flex-col items-center gap-2 rounded-xl border border-[rgba(184,110,249,0.2)] bg-[#3d1a5c] p-4 text-center transition-all hover:border-[#b86ef9] hover:bg-[#522870] hover:shadow-[0_0_20px_rgba(184,110,249,0.3)]"
            >
              <span className="text-2xl">{c.emoji}</span>
              <span className="text-xs font-medium text-white/85 group-hover:text-[#d4a5f9]">{t(`categories.${c.slug}`, c.label)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-center text-white">{t("home.how.title")}</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            { icon: Search, n: 1, txt: t("home.how.step1") },
            { icon: ShieldCheck, n: 2, txt: t("home.how.step2") },
            { icon: CalendarCheck, n: 3, txt: t("home.how.step3") },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.n} className="rounded-xl border border-[rgba(184,110,249,0.2)] bg-[#3d1a5c] p-6 text-center">
                <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#b86ef9]/30 to-[#5cc8fa]/20 text-[#d4a5f9] ring-1 ring-[#b86ef9]/30">
                  <Icon className="h-5 w-5" />
                </div>
                  <div className="mt-3 text-xs font-semibold text-[#d4a5f9]">{t("home.step")} {s.n}</div>
                <p className="mt-2 text-sm text-white/80">{s.txt}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Reassurance block — early access / waiting list */}
      <WaitlistReassuranceBlock />

      {/* Pricing teaser */}
      <section className="eg-reveal eg-reveal--delay bg-[#2d1248]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-center text-white">{t("home.pricingTeaser")}</h2>
          <div className="eg-beta-glow mx-auto mt-4 flex max-w-2xl flex-col items-center gap-1 rounded-2xl border border-[#5cc8fa]/40 bg-[#5cc8fa]/10 px-5 py-3 text-center backdrop-blur">
            <div className="text-sm font-semibold text-[#5cc8fa]">{t("pricing.beta_notice_title")}</div>
            <div className="text-xs text-[#d4c4e0]">{t("pricing.beta_notice_desc")}</div>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { name: t("pricing.plans.basic.name"), price: 0, desc: t("pricing.plans.basic.tagline"), highlight: false },
              { name: t("pricing.plans.essentiel.name"), price: 49, desc: t("pricing.plans.essentiel.tagline"), highlight: true },
              { name: t("pricing.plans.elite.name"), price: 99, desc: t("pricing.plans.elite.tagline"), highlight: false },
            ].map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl border p-6 backdrop-blur ${p.highlight ? "border-[#b86ef9] bg-gradient-to-br from-[#522870] to-[#3d1a5c] shadow-[0_0_30px_rgba(184,110,249,0.4)] ring-1 ring-[#b86ef9]/40" : "border-[rgba(184,110,249,0.2)] bg-[#3d1a5c]"}`}
              >
                {p.highlight && (
                  <span className="inline-block rounded-full bg-gradient-to-r from-[#b86ef9] to-[#d4a5f9] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    {t("home.recommended")}
                  </span>
                )}
                <h3 className="mt-2 text-lg font-semibold text-white">{p.name}</h3>
                <div className="mt-2 text-3xl font-bold text-white">
                  {p.price === 0 ? "0 CHF" : `${formatCHF(p.price)}`}
                  <span className="text-sm font-normal text-[#d4c4e0]">{p.price > 0 ? t("pricing.month") : ""}</span>
                </div>
                <p className="mt-2 text-sm text-[#d4c4e0]">{p.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button asChild size="lg" className="gap-2 bg-[#b86ef9] text-white shadow-lg shadow-[#b86ef9]/40 hover:bg-[#a855f7]">
              <Link to="/$lang/inscription" params={{ lang }}>
                <Check className="h-4 w-4" />
                {t("pricing.beta_cta")}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Nearby therapists list + Swiss map */}
      <NearbyTherapistsSwiss />
    </>
  );
}

/** Highlight common "therapist" / "therapeute" keyword in a purple→cyan gradient. */
function HeroTagline({ text }: { text: string }) {
  const re = /(thérapeute|therapeute|therapist|therapeut|terapeuta)s?/i;
  const match = text.match(re);
  if (!match) return <>{text}</>;
  const idx = match.index ?? 0;
  return (
    <>
      {text.slice(0, idx)}
      <span
        className="bg-gradient-to-r from-[#b86ef9] via-[#d4a5f9] to-[#5cc8fa] bg-clip-text italic text-transparent"
        style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 }}
      >
        {match[0]}
      </span>
      {text.slice(idx + match[0].length)}
    </>
  );
}