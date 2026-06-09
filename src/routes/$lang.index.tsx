import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Search, MapPin, ShieldCheck, Star, CalendarCheck, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CANTONS, THERAPY_CATEGORIES, SPOKEN_LANGUAGES, formatCHF } from "@/lib/constants";
import { TherapistCard } from "@/components/holiswiss/TherapistCard";
import { HeroVariants } from "@/components/holiswiss/HeroVariants";

export const Route = createFileRoute("/$lang/")({
  component: HomePage,
});

const SAMPLE = [
  { slug: "marie-dubois", displayName: "Marie Dubois", specialties: ["Sophrologie", "Méditation"], canton: "GE", rating: 4.9, reviewsCount: 84, priceFrom: 120, initials: "MD" },
  { slug: "thomas-meier", displayName: "Thomas Meier", specialties: ["Hypnose", "Coaching"], canton: "ZH", rating: 4.8, reviewsCount: 56, priceFrom: 150, initials: "TM" },
  { slug: "sofia-rossi", displayName: "Sofia Rossi", specialties: ["Naturopathie"], canton: "TI", rating: 4.7, reviewsCount: 41, priceFrom: 110, initials: "SR" },
  { slug: "luc-bernard", displayName: "Luc Bernard", specialties: ["Ostéopathie"], canton: "VD", rating: 5.0, reviewsCount: 102, priceFrom: 140, initials: "LB" },
  { slug: "anna-keller", displayName: "Anna Keller", specialties: ["Reiki", "Aromathérapie"], canton: "BE", rating: 4.6, reviewsCount: 33, priceFrom: 95, initials: "AK" },
  { slug: "paul-favre", displayName: "Paul Favre", specialties: ["Kinésiologie"], canton: "FR", rating: 4.9, reviewsCount: 67, priceFrom: 130, initials: "PF" },
];

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

      {/* Featured therapists */}
      <section className="bg-[#2d1248]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-white">{t("home.featured")}</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SAMPLE.map((s) => <TherapistCard key={s.slug} {...s} />)}
          </div>
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

      {/* Pricing teaser */}
      <section className="bg-[#2d1248]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-center text-white">{t("home.pricingTeaser")}</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { name: t("pricing.free.name"), price: 0, desc: t("pricing.free.desc"), highlight: false },
              { name: t("pricing.pro.name"), price: 29, desc: t("pricing.pro.desc"), highlight: true },
              { name: t("pricing.premium.name"), price: 59, desc: t("pricing.premium.desc"), highlight: false },
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
            <Link to="/$lang/inscription" params={{ lang }}>
              <Button size="lg" className="gap-2 bg-[#b86ef9] text-white shadow-lg shadow-[#b86ef9]/40 hover:bg-[#a855f7]"><Check className="h-4 w-4" />{t("home.ctaFree")}</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="relative overflow-hidden bg-[#522870] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(184,110,249,0.25),transparent_70%)]" />
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            { n: "280+", l: t("home.stats.practitioners") },
            { n: "26", l: t("home.stats.cantons") },
            { n: "18", l: t("home.stats.approaches") },
            { n: "12k+", l: t("home.stats.sessions") },
          ].map((s) => (
            <div key={s.l} className="relative text-center">
              <div className="text-3xl font-bold text-[#b86ef9]">{s.n}</div>
              <div className="mt-1 text-sm text-white">{s.l}</div>
            </div>
          ))}
        </div>
      </section>
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