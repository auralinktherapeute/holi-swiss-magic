import { Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Search, ShieldCheck, Sparkles, Star, MapPin, Users, ChevronRight, Brain, Leaf, HeartPulse, Flower2, Moon, HandHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import lotusNeonAsset from "@/assets/lotus-transparent.png.asset.json";
import heroTherapyAsset from "@/assets/hero-therapy-session.jpg.asset.json";
import therapistsGridAsset from "@/assets/therapists-grid.jpg.asset.json";
import wellnessAmbientAsset from "@/assets/wellness-ambient.jpg.asset.json";

function LotusNeon({ size = 80, className = "", style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <img
      src={lotusNeonAsset.url}
      alt="Holiswiss lotus"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain", ...style }}
    />
  );
}

function Wordmark() {
  return (
    <span className="text-[28px] font-bold tracking-tight leading-none">
      <span className="text-[#b86ef9]">Holi</span>
      <span className="font-normal text-white">swiss</span>
    </span>
  );
}

/* ───────── Shared search bar ───────── */
function HeroSearchBar() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/" });
  return (
    <div className="relative max-w-xl rounded-2xl border border-[rgba(184,110,249,0.35)] bg-[rgba(20,8,40,0.65)] p-2 shadow-[0_20px_80px_-20px_rgba(184,110,249,0.55)] backdrop-blur-xl">
      <div className="flex items-center">
        <Search className="ml-4 h-5 w-5 shrink-0 text-[#b9a4d4]" />
        <input
          type="search"
          aria-label={t("hero.search_placeholder")}
          className="h-12 min-w-0 flex-1 bg-transparent px-3 text-white placeholder:text-[#c4b5dd] focus:outline-none"
          placeholder={t("hero.search_placeholder")}
        />
        <Link to="/$lang/therapeutes" params={{ lang }}>
          <Button className="m-1 h-10 bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] text-white">
            {t("hero.search_btn")}
          </Button>
        </Link>
      </div>
    </div>
  );
}

function TrustBadges() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-5 text-sm text-[#c8b8df]">
      <span className="inline-flex items-center gap-1.5">
        <ShieldCheck className="h-4 w-4 text-[#5cc8fa]" />
        {t("hero.trust_verified")}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-[#d4a5f9]" />
        {t("hero.trust_cantons")}
      </span>
    </div>
  );
}

/* ───────── Variant 1: Split-screen with real photo ───────── */
function VariantPhotoSplit() {
  const { t } = useTranslation();
  return (
    <section
      className="relative overflow-hidden text-white"
      style={{ background: "radial-gradient(ellipse at 20% 40%, #3d1a5c 0%, #26103a 55%, #1a0828 100%)" }}
    >
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl grid-cols-1 items-center gap-10 px-6 py-16 lg:grid-cols-12 lg:gap-12 lg:py-24">
        <div className="space-y-6 lg:col-span-7">
          <div className="hv-slide-up flex items-center gap-3">
            <LotusNeon size={64} className="hv-lotus-glow" />
            <Wordmark />
          </div>
          <h1 className="hv-slide-up text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl" style={{ animationDelay: "150ms" }}>
            {t("hero.title_part1")}{" "}
            <span className="bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] bg-clip-text text-transparent">
              {t("hero.title_highlight")}
            </span>
            {t("hero.title_part2")}
          </h1>
          <p className="hv-slide-up max-w-xl text-base text-[#d4c4e0] sm:text-lg" style={{ animationDelay: "300ms" }}>
            {t("hero.subtitle")}
          </p>
          <div className="hv-slide-up" style={{ animationDelay: "450ms" }}>
            <HeroSearchBar />
          </div>
          <div className="hv-slide-up" style={{ animationDelay: "600ms" }}>
            <TrustBadges />
          </div>
        </div>
        <div className="hv-slide-up relative lg:col-span-5" style={{ animationDelay: "300ms" }}>
          <div className="absolute -inset-6 rounded-[32px] bg-[radial-gradient(ellipse_at_center,rgba(184,110,249,0.45),transparent_70%)] blur-2xl" />
          <div className="relative overflow-hidden rounded-3xl border border-[rgba(184,110,249,0.35)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
            <img
              src={heroTherapyAsset.url}
              alt={t("hero.trust_verified")}
              width={1280}
              height={1600}
              className="h-[420px] w-full object-cover sm:h-[520px] lg:h-[600px]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#1a0828]/70 via-transparent to-[#5cc8fa]/10" />
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-md">
              <div className="flex items-center gap-2 text-sm">
                <Star className="h-4 w-4 fill-[#f9a8d4] text-[#f9a8d4]" />
                <span className="font-semibold">4,9 / 5</span>
                <span className="text-white/60">· 280+ {t("hero.stats_practitioners")}</span>
              </div>
              <span className="hidden items-center gap-1 text-xs text-white/70 sm:inline-flex">
                <MapPin className="h-3.5 w-3.5" /> 26 CH
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────── Variant 2: Blurred therapist-grid backdrop ───────── */
function VariantMosaicBackdrop() {
  const { t } = useTranslation();
  return (
    <section className="relative overflow-hidden text-white">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${therapistsGridAsset.url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(8px) saturate(0.85)",
          transform: "scale(1.08)",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(26,8,40,0.85) 0%, rgba(26,8,40,0.72) 40%, rgba(26,8,40,0.92) 100%)",
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-x-0 top-16 mx-auto h-px max-w-7xl bg-gradient-to-r from-transparent via-[#b86ef9] to-[#5cc8fa] opacity-60" />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col items-center justify-center px-6 py-24 text-center">
        <div className="hv-slide-up flex items-center gap-3">
          <LotusNeon size={72} className="hv-lotus-glow" />
          <Wordmark />
        </div>
        <h1 className="hv-slide-up mt-8 text-4xl font-bold leading-tight sm:text-6xl" style={{ animationDelay: "150ms" }}>
          {t("hero.title_part1")}{" "}
          <span className="bg-gradient-to-r from-[#b86ef9] via-[#d4a5f9] to-[#5cc8fa] bg-clip-text text-transparent">
            {t("hero.title_highlight")}
          </span>
          {t("hero.title_part2")}
        </h1>
        <p className="hv-slide-up mt-5 max-w-2xl text-base text-[#e0d0ee] sm:text-lg" style={{ animationDelay: "300ms" }}>
          {t("hero.subtitle")}
        </p>
        <div className="hv-slide-up mt-8 w-full max-w-xl" style={{ animationDelay: "450ms" }}>
          <HeroSearchBar />
        </div>
        <div className="hv-slide-up mt-6" style={{ animationDelay: "600ms" }}>
          <TrustBadges />
        </div>
        <div className="mt-10 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-white/75 backdrop-blur">
          <Users className="h-3.5 w-3.5 text-[#d4a5f9]" />
          {t("hero.stats_practitioners")}
          <span aria-hidden>·</span>
          <Star className="h-3.5 w-3.5 fill-[#f9a8d4] text-[#f9a8d4]" /> 4,9/5
        </div>
      </div>
    </section>
  );
}

/* ───────── Variant 3: Minimalist + social-proof marquee ───────── */
function VariantMarquee() {
  const { t } = useTranslation();
  const items = [
    { icon: Users, label: "280+ " + t("hero.stats_practitioners") },
    { icon: MapPin, label: "26 " + t("hero.stats_cantons") },
    { icon: Star, label: "4,9 / 5 · 1 200 avis" },
    { icon: ShieldCheck, label: t("hero.trust_verified") },
    { icon: Sparkles, label: t("hero.stats_languages") + " · FR · DE · IT · EN" },
    { icon: HandHeart, label: "Réservation en ligne" },
  ];
  return (
    <section
      className="relative overflow-hidden text-white"
      style={{ background: "radial-gradient(ellipse at 50% 30%, #3d1a5c 0%, #26103a 55%, #1a0828 100%)" }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl flex-col items-center justify-center px-6 py-24 text-center">
        <div className="hv-slide-up flex items-center gap-3">
          <LotusNeon size={72} className="hv-lotus-glow" />
          <Wordmark />
        </div>
        <h1 className="hv-slide-up mt-8 text-4xl font-bold leading-tight sm:text-6xl" style={{ animationDelay: "150ms" }}>
          {t("hero.title_part1")}{" "}
          <span className="bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] bg-clip-text text-transparent">
            {t("hero.title_highlight")}
          </span>
          {t("hero.title_part2")}
        </h1>
        <p className="hv-slide-up mt-5 max-w-xl text-base text-[#d4c4e0] sm:text-lg" style={{ animationDelay: "300ms" }}>
          {t("hero.glass_subtitle")}
        </p>
        <div className="hv-slide-up mt-8 w-full max-w-xl" style={{ animationDelay: "450ms" }}>
          <HeroSearchBar />
        </div>
      </div>
      <div
        className="relative border-y border-[rgba(184,110,249,0.2)]"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(26,8,40,0.92), rgba(61,26,92,0.75), rgba(26,8,40,0.92)), url(${wellnessAmbientAsset.url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="hv-marquee-mask overflow-hidden py-5">
          <div className="hv-marquee flex w-max gap-10 whitespace-nowrap">
            {[...items, ...items].map((it, i) => {
              const Icon = it.icon;
              return (
                <span key={i} className="inline-flex items-center gap-2 text-sm text-white/85">
                  <Icon className="h-4 w-4 text-[#d4a5f9]" />
                  {it.label}
                  <span className="ml-6 text-[#b86ef9]/50">◆</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────── Variant 4: Hero + visual specialties carousel ───────── */
export function SpecialtiesCarousel() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/" });
  const specs = [
    { slug: "sophrologie", icon: Brain, gradient: "from-[#7c3aed] to-[#5cc8fa]", label: "Sophrologie", count: 48 },
    { slug: "hypnose", icon: Moon, gradient: "from-[#a855f7] to-[#ec4899]", label: "Hypnose", count: 32 },
    { slug: "naturopathie", icon: Leaf, gradient: "from-[#10b981] to-[#5cc8fa]", label: "Naturopathie", count: 61 },
    { slug: "meditation", icon: Flower2, gradient: "from-[#d4a5f9] to-[#7dd3fc]", label: "Méditation", count: 27 },
    { slug: "reflexologie", icon: HandHeart, gradient: "from-[#f9a8d4] to-[#b86ef9]", label: "Réflexologie", count: 39 },
    { slug: "kinesiologie", icon: HeartPulse, gradient: "from-[#5cc8fa] to-[#b86ef9]", label: "Kinésiologie", count: 22 },
  ];
  return (
    <div className="relative">
      <style>{HERO_CSS}</style>
      <div className="mb-4 flex items-end justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[#d4a5f9]">
          {t("home.specialties")}
        </h3>
        <Link
          to="/$lang/therapeutes"
          params={{ lang }}
          className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white"
        >
          {t("hero.find_btn")} <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="hv-scroll-x flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
        {specs.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.slug}
                to="/$lang/therapeutes"
                params={{ lang }}
                className="group relative flex h-44 w-64 shrink-0 snap-start flex-col justify-end overflow-hidden rounded-2xl border border-white/10 p-4 transition hover:-translate-y-0.5 hover:border-[#b86ef9]/60"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient} opacity-90`} aria-hidden />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.25),transparent_60%)]" aria-hidden />
                <Icon className="absolute right-4 top-4 h-10 w-10 text-white/85 transition group-hover:scale-110" />
                <div className="relative">
                  <div className="text-lg font-semibold leading-tight">{s.label}</div>
                  <div className="mt-1 text-xs text-white/80">{s.count} thérapeutes</div>
                </div>
              </Link>
            );
          })}
      </div>
    </div>
  );
}

/* ───────── Legacy Variant kept for reference (unused) ───────── */
/* ───────── Wrapper with dev selector ───────── */
export function HeroVariants() {
  useTranslation(); // ensure i18n ready
  return (
    <>
      <style>{HERO_CSS}</style>
      <VariantPhotoSplit />
    </>
  );
}

const HERO_CSS = `
@keyframes hv-pulse-glow { 0%,100%{filter:drop-shadow(0 0 20px rgba(184,110,249,0.6));}50%{filter:drop-shadow(0 0 40px rgba(184,110,249,0.95));} }
.hv-lotus-glow{animation:hv-pulse-glow 3s ease-in-out infinite;}
@keyframes hv-caret { 0%,100%{opacity:1;}50%{opacity:0;} }
.hv-caret{display:inline-block;margin-left:4px;color:#b86ef9;animation:hv-caret 1s steps(1) infinite;}
@keyframes hv-float { 0%{transform:translateY(0) translateX(0);opacity:0;}10%{opacity:1;}90%{opacity:1;}100%{transform:translateY(-120px) translateX(20px);opacity:0;} }
.hv-particle{position:absolute;width:4px;height:4px;border-radius:9999px;background:rgba(184,110,249,0.6);box-shadow:0 0 12px rgba(184,110,249,0.8);animation:hv-float linear infinite;}
@keyframes hv-shimmer { 0%{transform:translateX(-150%);}100%{transform:translateX(150%);} }
.hv-shimmer::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent);transform:translateX(-150%);animation:hv-shimmer 2.5s ease-in-out infinite;}
@keyframes hv-slide-up { from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);} }
.hv-slide-up{opacity:0;animation:hv-slide-up 700ms ease-out forwards;}
@keyframes hv-spin { from{transform:rotate(0);}to{transform:rotate(360deg);} }
.hv-lotus-spin{animation:hv-spin 20s linear infinite;}
@keyframes hv-aura-pulse { 0%,100%{opacity:0.2;transform:scale(1);}50%{opacity:0.5;transform:scale(1.15);} }
.hv-aura{position:absolute;width:380px;height:380px;border-radius:9999px;border:1px solid rgba(184,110,249,0.4);animation:hv-aura-pulse 4s ease-in-out infinite;}
.hv-aura-2{width:480px;height:480px;animation-delay:1s;border-color:rgba(92,200,250,0.3);}
.hv-aura-3{width:580px;height:580px;animation-delay:2s;border-color:rgba(212,165,249,0.25);}
@keyframes hv-blob { 0%{transform:translate(0,0) scale(1);}100%{transform:translate(60px,-40px) scale(1.2);} }
.hv-blob{position:absolute;width:520px;height:520px;border-radius:9999px;filter:blur(80px);opacity:0.45;animation:hv-blob 8s ease-in-out infinite alternate;}
.hv-blob-1{background:#b86ef9;top:-100px;left:-100px;}
.hv-blob-2{background:#5cc8fa;bottom:-120px;right:-80px;animation-delay:2s;}
.hv-blob-3{background:#ec4899;top:30%;right:20%;animation-delay:4s;opacity:0.3;}
@keyframes hv-gradient { 0%,100%{background-position:0% 50%;}50%{background-position:100% 50%;} }
.hv-gradient-text{background:linear-gradient(90deg,#b86ef9,#5cc8fa,#b86ef9);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:hv-gradient 4s linear infinite;}
@keyframes hv-word { from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);} }
.hv-word{opacity:0;animation:hv-word 500ms ease-out forwards;}
@keyframes hv-line { from{transform:scaleX(0);}to{transform:scaleX(1);} }
.hv-accent-line{transform-origin:left;animation:hv-line 800ms ease-out 600ms forwards;transform:scaleX(0);}
@keyframes hv-marquee { from{transform:translateX(0);}to{transform:translateX(-50%);} }
.hv-marquee{animation:hv-marquee 40s linear infinite;}
.hv-marquee-mask{-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);}
.hv-scroll-x{scrollbar-width:thin;scrollbar-color:rgba(184,110,249,0.5) transparent;}
.hv-scroll-x::-webkit-scrollbar{height:6px;}
.hv-scroll-x::-webkit-scrollbar-thumb{background:rgba(184,110,249,0.5);border-radius:9999px;}
`;