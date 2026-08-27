import { useEffect, useRef, useState } from "react";
import { MapPin, Sparkles, Star, ArrowRight, CalendarDays, FileText, BadgeCheck } from "lucide-react";
import heroPhoto from "@/assets/hero-therapy-session.jpg.asset.json";

/**
 * 3 variantes VISUELLES de la future section « Thérapeute à la Une ».
 * 100 % présentationnel : données fictives, aucun appel réseau, aucune table.
 */

export const FEATURED = {
  name: "Gerald HENRY",
  profession: "Énergéticien, Magnétiseur",
  city: "Basel",
  canton: "BS",
  rating: 4.9,
  reviews: 37,
  years: 10,
  description:
    "Thérapeute en soins esséniens depuis plus de 10 ans, Gerald accompagne avec écoute et présence pour harmoniser le corps, le cœur et l'esprit.",
  specialties: ["Énergéticien", "Magnétiseur", "Lithothérapeute", "Radiesthésie", "Soins esséniens"],
  articles: [
    "Retrouver son équilibre énergétique au quotidien",
    "Comprendre les soins esséniens",
    "Le rôle des pierres dans le bien-être",
  ],
  events: [
    { title: "Atelier : Initiation aux énergies subtiles", date: "15 septembre" },
    { title: "Cercle de soins collectifs", date: "28 septembre" },
  ],
  photo: heroPhoto.url,
  photoAlt: "Portrait de Gerald HENRY, énergéticien et magnétiseur à Basel",
};

/* ---------- helpers ---------- */

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, shown };
}

function Tags({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((s) => (
        <li
          key={s}
          className="rounded-full border border-[rgba(184,110,249,0.28)] bg-[#b86ef9]/10 px-3 py-1 text-xs font-medium text-[#e2c6ff]"
        >
          {s}
        </li>
      ))}
    </ul>
  );
}

function ArticleCard({ title }: { title: string }) {
  return (
    <article className="group min-w-[240px] flex-1 rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#b86ef9]/45 motion-reduce:transform-none">
      <FileText className="h-4 w-4 text-[#d4a5f9]" aria-hidden="true" />
      <h4 className="mt-2 text-sm font-medium leading-snug text-white">{title}</h4>
      <span className="mt-3 inline-flex items-center gap-1 text-xs text-[#c0b0d8] transition-colors group-hover:text-white">
        Lire l'article <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </span>
    </article>
  );
}

function EventCard({ title, date }: { title: string; date: string }) {
  return (
    <article className="min-w-[240px] flex-1 rounded-2xl border border-white/10 bg-gradient-to-br from-[#3d1a5c]/60 to-[#1a1035]/60 p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#5cc8fa]/40 motion-reduce:transform-none">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#5cc8fa]">
        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> {date}
      </span>
      <h4 className="mt-2 text-sm font-medium leading-snug text-white">{title}</h4>
    </article>
  );
}

function Scroller({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div
      className="-mx-1 flex min-w-0 gap-4 overflow-x-auto px-1 pb-2"
      role="list"
      aria-label={label}
    >
      {children}
    </div>
  );
}

function Cta({ children, variant = "primary" }: { children: React.ReactNode; variant?: "primary" | "ghost" }) {
  const base =
    "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-7 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a5f9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0a1e] motion-reduce:transform-none";
  const skin =
    variant === "primary"
      ? "bg-gradient-to-r from-[#b86ef9] to-[#8b5cf6] text-white shadow-[0_8px_30px_rgba(184,110,249,0.35)] hover:shadow-[0_10px_38px_rgba(184,110,249,0.5)] hover:-translate-y-0.5"
      : "border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.09]";
  return (
    <a href="#" onClick={(e) => e.preventDefault()} className={`${base} ${skin}`}>
      {children}
    </a>
  );
}

function Badge({ children, pulse = false }: { children: React.ReactNode; pulse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#b86ef9]/40 bg-[#b86ef9]/12 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e2c6ff] backdrop-blur">
      <Sparkles
        className={`h-3.5 w-3.5 text-[#f5c97a] ${pulse ? "animate-[pulse_3s_ease-in-out_infinite] motion-reduce:animate-none" : ""}`}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}

/* ---------- Proposition A — Éditorial premium ---------- */

function VersionA() {
  const { ref, shown } = useReveal<HTMLElement>();
  return (
    <section
      ref={ref}
      aria-labelledby="fa-title"
      className="bg-[#0f0a1e] px-4 py-14 sm:px-6 sm:py-20 lg:px-10"
    >
      <div
        className={`mx-auto max-w-6xl transition-all duration-700 ease-out motion-reduce:transition-none ${
          shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
        }`}
      >
        <div className="grid gap-10 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-center">
          <div className="relative mx-auto w-full max-w-[340px]">
            <div
              className="pointer-events-none absolute inset-0 -z-0 rounded-[2.5rem] bg-[#b86ef9]/25 blur-[70px]"
              aria-hidden="true"
            />
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10">
              <img
                src={FEATURED.photo}
                alt={FEATURED.photoAlt}
                loading="lazy"
                width={680}
                height={850}
                className={`aspect-[4/5] w-full object-cover transition-transform duration-[2500ms] ease-out motion-reduce:transform-none ${
                  shown ? "scale-105" : "scale-100"
                }`}
              />
            </div>
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
              <Badge>Thérapeute à la Une</Badge>
            </div>
          </div>

          <div className="min-w-0">
            <h2
              id="fa-title"
              className="text-3xl font-semibold tracking-tight text-white sm:text-4xl"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              {FEATURED.name}
            </h2>
            <p className="mt-2 text-base text-[#d4a5f9]">{FEATURED.profession}</p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-[#c0b0d8]">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {FEATURED.city} ({FEATURED.canton})
            </p>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[#e6dcf2]">
              {FEATURED.description}
            </p>
            <div className="mt-5">
              <Tags items={FEATURED.specialties} />
            </div>
            <div className="mt-7">
              <Cta>
                Découvrir le profil <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Cta>
            </div>
          </div>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-2 [&>*]:min-w-0">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#a89bc4]">
              Derniers articles
            </h3>
            <div className="mt-4">
              <Scroller label="Derniers articles">
                {FEATURED.articles.map((a) => (
                  <ArticleCard key={a} title={a} />
                ))}
              </Scroller>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#a89bc4]">
              Événements à venir
            </h3>
            <div className="mt-4">
              <Scroller label="Événements à venir">
                {FEATURED.events.map((e) => (
                  <EventCard key={e.title} {...e} />
                ))}
              </Scroller>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Proposition B — Carte signature ---------- */

function VersionB() {
  const { ref, shown } = useReveal<HTMLElement>();
  return (
    <section
      ref={ref}
      aria-labelledby="fb-title"
      className="bg-[#0b0716] px-4 py-14 sm:px-6 sm:py-20"
    >
      <div
        className={`mx-auto max-w-4xl transition-all duration-700 ease-out motion-reduce:transition-none ${
          shown ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        }`}
      >
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#2d1248] via-[#1a1035] to-[#0f0a1e] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-9">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#b86ef9]/20 blur-[80px] motion-safe:animate-[pulse_6s_ease-in-out_infinite]"
            aria-hidden="true"
          />
          <div className="relative flex flex-col gap-7 sm:flex-row sm:items-start">
            <div className="relative mx-auto w-full max-w-[220px] shrink-0">
              <div className="overflow-hidden rounded-3xl border border-white/12 shadow-[0_18px_45px_rgba(0,0,0,0.5)]">
                <img
                  src={FEATURED.photo}
                  alt={FEATURED.photoAlt}
                  loading="lazy"
                  width={440}
                  height={520}
                  className="aspect-[4/5] w-full object-cover"
                />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <Badge pulse>Sélection Holiswiss</Badge>
              <h2 id="fb-title" className="mt-4 text-2xl font-semibold text-white sm:text-3xl">
                {FEATURED.name}
              </h2>
              <p className="mt-1.5 text-sm text-[#d4a5f9]">{FEATURED.profession}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#c0b0d8]">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" aria-hidden="true" /> {FEATURED.city} ({FEATURED.canton})
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-[#f5c97a] text-[#f5c97a]" aria-hidden="true" />
                  <span className="text-white">{FEATURED.rating.toFixed(1)}</span>
                  <span>({FEATURED.reviews} avis)</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-[#7de3b8]">
                  <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Profil vérifié
                </span>
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-[#e6dcf2]">{FEATURED.description}</p>
              <div className="mt-4">
                <Tags items={FEATURED.specialties} />
              </div>
            </div>
          </div>

          <div className="relative mt-8 grid gap-3 sm:grid-cols-2">
            <ul className="space-y-2" aria-label="Derniers articles">
              {FEATURED.articles.map((a) => (
                <li key={a}>
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className="flex min-h-[44px] items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5 text-sm text-[#e6dcf2] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#b86ef9]/40 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9] motion-reduce:transform-none"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-[#d4a5f9]" aria-hidden="true" />
                    <span className="min-w-0">{a}</span>
                  </a>
                </li>
              ))}
            </ul>
            <ul className="space-y-2" aria-label="Événements à venir">
              {FEATURED.events.map((e) => (
                <li key={e.title}>
                  <a
                    href="#"
                    onClick={(ev) => ev.preventDefault()}
                    className="flex min-h-[44px] items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5 text-sm text-[#e6dcf2] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#5cc8fa]/40 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5cc8fa] motion-reduce:transform-none"
                  >
                    <CalendarDays className="h-4 w-4 shrink-0 text-[#5cc8fa]" aria-hidden="true" />
                    <span className="min-w-0">
                      {e.title} — <span className="text-[#c0b0d8]">{e.date}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mt-8 flex justify-center">
            <Cta>
              Découvrir le profil de Gerald <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Proposition C — Expérience immersive ---------- */

function Counter({ to, label, suffix = "" }: { to: number; label: string; suffix?: string }) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!shown) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / 900, 1);
      setV(Number((to * (1 - Math.pow(1 - p, 3))).toFixed(to % 1 ? 1 : 0)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shown, to]);
  return (
    <div ref={ref} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center backdrop-blur">
      <div className="text-xl font-semibold text-white sm:text-2xl">
        {v}
        {suffix}
      </div>
      <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-[#a89bc4]">{label}</div>
    </div>
  );
}

function VersionC() {
  const { ref, shown } = useReveal<HTMLElement>();
  return (
    <section ref={ref} aria-labelledby="fc-title" className="relative overflow-hidden bg-[#08050f]">
      <img
        src={FEATURED.photo}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover opacity-30"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-[#08050f] via-[#0f0a1e]/92 to-[#2d1248]/70"
        aria-hidden="true"
      />
      <div className="relative px-4 py-16 sm:px-6 sm:py-24 lg:px-12">
        <div
          className={`mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-[#0f0a1e]/60 p-6 backdrop-blur-xl transition-all duration-700 ease-out sm:p-10 motion-reduce:transition-none ${
            shown ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
          }`}
        >
          <Badge>Rencontrez notre Thérapeute à la Une</Badge>
          <h2
            id="fc-title"
            className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            {FEATURED.name}
          </h2>
          <p className="mt-2 text-base text-[#d4a5f9]">
            {FEATURED.profession} · {FEATURED.city} ({FEATURED.canton})
          </p>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-[#e6dcf2] sm:text-base">
            {FEATURED.description}
          </p>

          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Counter to={FEATURED.years} label="Ans d'expérience" suffix="+" />
            <Counter to={FEATURED.reviews} label="Avis vérifiés" />
            <Counter to={FEATURED.specialties.length} label="Approches" />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a89bc4]">Articles</h3>
              <div className="mt-3">
                <Scroller label="Articles">
                  {FEATURED.articles.map((a) => (
                    <ArticleCard key={a} title={a} />
                  ))}
                </Scroller>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a89bc4]">Événements</h3>
              <div className="mt-3">
                <Scroller label="Événements">
                  {FEATURED.events.map((e) => (
                    <EventCard key={e.title} {...e} />
                  ))}
                </Scroller>
              </div>
            </div>
          </div>

          <div className="mt-9">
            <Cta>
              Explorer son univers <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
          </div>
        </div>
      </div>
    </section>
  );
}

export const FEATURED_THERAPIST_VARIANTS = [
  {
    id: "proposition-a",
    name: "Proposition A — Éditorial Premium",
    description: "Deux colonnes, portrait halo violet, articles et événements en dessous.",
    Component: VersionA,
  },
  {
    id: "proposition-b",
    name: "Proposition B — Carte Signature",
    description: "Grande carte flottante centrée, note et badge animé, listes compactes.",
    Component: VersionB,
  },
  {
    id: "proposition-c",
    name: "Proposition C — Expérience Immersive",
    description: "Pleine largeur, image de fond, panneau glass et compteurs animés.",
    Component: VersionC,
  },
] as const;
