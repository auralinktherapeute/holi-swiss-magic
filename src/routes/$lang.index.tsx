import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Search, MapPin, ShieldCheck, Star, CalendarCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CANTONS, THERAPY_CATEGORIES, SPOKEN_LANGUAGES, formatCHF } from "@/lib/constants";
import { TherapistCard } from "@/components/holiswiss/TherapistCard";

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

  return (
    <>
      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #2d1248 0%, #3d1a5c 50%, #2d1248 100%)" }}
      >
        {/* Radial purple glow behind hero content */}
        <div className="pointer-events-none absolute left-1/2 top-1/3 -z-0 h-[700px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_60%_50%_at_50%_40%,rgba(184,110,249,0.2),transparent)] blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 -z-0 h-[500px] w-[500px] rounded-full bg-[radial-gradient(closest-side,rgba(92,200,250,0.18),transparent_70%)] blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-16 sm:px-6 lg:px-8 lg:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(184,110,249,0.4)] bg-[#522870] px-3 py-1 text-xs font-semibold text-[#d4c4e0] backdrop-blur">
              🇨🇭 Suisse · 26 cantons
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              <HeroTagline text={t("brand.tagline")} />
            </h1>
            <p className="mt-5 text-lg text-[#d4c4e0]">
              {t("home.subtitle", { count: 280 })}
            </p>
          </div>

          {/* Search bar */}
          <div className="mx-auto mt-10 max-w-4xl rounded-2xl border border-[rgba(184,110,249,0.3)] bg-[rgba(255,255,255,0.06)] p-3 shadow-[0_0_60px_-15px_rgba(184,110,249,0.5)] backdrop-blur-xl">
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
              <Select>
                <SelectTrigger className="h-12 border-0 bg-transparent text-white shadow-none focus:ring-2 focus:ring-primary [&>span]:text-white/90">
                  <SelectValue placeholder={t("home.search.approach")} />
                </SelectTrigger>
                <SelectContent>
                  {THERAPY_CATEGORIES.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>{c.emoji} {c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="h-12 border-0 bg-transparent text-white shadow-none focus:ring-2 focus:ring-primary [&>span]:text-white/90">
                  <SelectValue placeholder={t("home.search.canton")} />
                </SelectTrigger>
                <SelectContent>
                  {CANTONS.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="h-12 border-0 bg-transparent text-white shadow-none focus:ring-2 focus:ring-primary [&>span]:text-white/90">
                  <SelectValue placeholder={t("home.search.language")} />
                </SelectTrigger>
                <SelectContent>
                  {SPOKEN_LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Link to="/$lang/therapeutes" params={{ lang }}>
                <Button size="lg" className="h-12 w-full gap-2 bg-[#5cc8fa] text-[#0f172a] shadow-lg shadow-[#5cc8fa]/25 hover:opacity-90">
                  <Search className="h-4 w-4" /> {t("home.search.cta")}
                </Button>
              </Link>
            </div>
          </div>

          {/* Trust row */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-[#d4c4e0]">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-[#5cc8fa]" />{t("home.trust.verified")}</span>
            <span className="inline-flex items-center gap-1.5"><Star className="h-4 w-4 text-[#f59e0b]" />{t("home.trust.reviews")}</span>
            <span className="inline-flex items-center gap-1.5"><CalendarCheck className="h-4 w-4 text-[#d4a5f9]" />{t("home.trust.booking")}</span>
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-[#d4a5f9]" />{t("home.trust.cantons")}</span>
          </div>
        </div>
      </section>

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
              <span className="text-xs font-medium text-white/85 group-hover:text-[#d4a5f9]">{c.label}</span>
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
                <div className="mt-3 text-xs font-semibold text-[#d4a5f9]">ÉTAPE {s.n}</div>
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
                    Recommandé
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
      <span className="bg-gradient-to-r from-[#b86ef9] via-[#d4a5f9] to-[#5cc8fa] bg-clip-text text-transparent">
        {match[0]}
      </span>
      {text.slice(idx + match[0].length)}
    </>
  );
}