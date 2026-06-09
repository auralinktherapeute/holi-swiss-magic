import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Search, MapPin, Languages, ShieldCheck, Star, CalendarCheck, Flag, Check } from "lucide-react";
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
      <section className="relative overflow-hidden">
        <div className="absolute right-0 top-0 -z-10 h-[600px] w-[600px] rounded-full bg-primary/10 blur-3xl" />
        <div className="mx-auto max-w-7xl px-4 pt-16 pb-12 sm:px-6 lg:px-8 lg:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-xlight px-3 py-1 text-xs font-semibold text-primary">
              🇨🇭 Suisse · 26 cantons
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {t("brand.tagline")}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              {t("home.subtitle", { count: 280 })}
            </p>
          </div>

          {/* Search bar */}
          <div className="mx-auto mt-10 max-w-4xl rounded-2xl border border-border bg-surface p-3 shadow-xl shadow-primary/5">
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
              <Select>
                <SelectTrigger className="h-12 border-0 bg-transparent shadow-none focus:ring-2 focus:ring-primary">
                  <SelectValue placeholder={t("home.search.approach")} />
                </SelectTrigger>
                <SelectContent>
                  {THERAPY_CATEGORIES.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>{c.emoji} {c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="h-12 border-0 bg-transparent shadow-none focus:ring-2 focus:ring-primary">
                  <SelectValue placeholder={t("home.search.canton")} />
                </SelectTrigger>
                <SelectContent>
                  {CANTONS.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="h-12 border-0 bg-transparent shadow-none focus:ring-2 focus:ring-primary">
                  <SelectValue placeholder={t("home.search.language")} />
                </SelectTrigger>
                <SelectContent>
                  {SPOKEN_LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Link to="/$lang/therapeutes" params={{ lang }}>
                <Button size="lg" className="h-12 w-full bg-accent hover:bg-accent/90 text-accent-foreground gap-2">
                  <Search className="h-4 w-4" /> {t("home.search.cta")}
                </Button>
              </Link>
            </div>
          </div>

          {/* Trust row */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-accent" />{t("home.trust.verified")}</span>
            <span className="inline-flex items-center gap-1.5"><Star className="h-4 w-4 text-warning" />{t("home.trust.reviews")}</span>
            <span className="inline-flex items-center gap-1.5"><CalendarCheck className="h-4 w-4 text-primary" />{t("home.trust.booking")}</span>
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" />{t("home.trust.cantons")}</span>
          </div>
        </div>
      </section>

      {/* Specialty grid */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight">{t("home.specialties")}</h2>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {THERAPY_CATEGORIES.map((c) => (
            <button
              key={c.slug}
              className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-4 text-center transition-all hover:border-primary hover:shadow-md hover:shadow-primary/5"
            >
              <span className="text-2xl">{c.emoji}</span>
              <span className="text-xs font-medium text-foreground/80 group-hover:text-primary">{c.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Featured therapists */}
      <section className="bg-surface-alt">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight">{t("home.featured")}</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SAMPLE.map((s) => <TherapistCard key={s.slug} {...s} />)}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-center">{t("home.how.title")}</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            { icon: Search, n: 1, txt: t("home.how.step1") },
            { icon: ShieldCheck, n: 2, txt: t("home.how.step2") },
            { icon: CalendarCheck, n: 3, txt: t("home.how.step3") },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.n} className="rounded-xl border border-border bg-surface p-6 text-center">
                <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-xlight text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-3 text-xs font-semibold text-primary">ÉTAPE {s.n}</div>
                <p className="mt-2 text-sm text-foreground/80">{s.txt}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="bg-surface-alt">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-center">{t("home.pricingTeaser")}</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { name: t("pricing.free.name"), price: 0, desc: t("pricing.free.desc"), highlight: false },
              { name: t("pricing.pro.name"), price: 29, desc: t("pricing.pro.desc"), highlight: true },
              { name: t("pricing.premium.name"), price: 59, desc: t("pricing.premium.desc"), highlight: false },
            ].map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl border bg-surface p-6 ${p.highlight ? "border-primary shadow-xl shadow-primary/10 ring-2 ring-primary/30" : "border-border"}`}
              >
                {p.highlight && (
                  <span className="inline-block rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                    Recommandé
                  </span>
                )}
                <h3 className="mt-2 text-lg font-semibold">{p.name}</h3>
                <div className="mt-2 text-3xl font-bold">
                  {p.price === 0 ? "0 CHF" : `${formatCHF(p.price)}`}
                  <span className="text-sm font-normal text-muted-foreground">{p.price > 0 ? t("pricing.month") : ""}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link to="/$lang/inscription" params={{ lang }}>
              <Button size="lg" className="gap-2"><Check className="h-4 w-4" />{t("home.ctaFree")}</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-accent text-accent-foreground">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            { n: "280+", l: t("home.stats.practitioners") },
            { n: "26", l: t("home.stats.cantons") },
            { n: "18", l: t("home.stats.approaches") },
            { n: "12k+", l: t("home.stats.sessions") },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <div className="text-3xl font-bold">{s.n}</div>
              <div className="mt-1 text-sm opacity-90">{s.l}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}