import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Search, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import lotusAsset from "@/assets/lotus-logo.png.asset.json";
import lotusNeonAsset from "@/assets/lotus-neon.png.asset.json";

type Variant = 1 | 2 | 3 | 4;

function LotusGlow({ size = 80, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={lotusAsset.url}
      alt="Holiswiss lotus"
      width={size}
      height={size}
      className={`hv-lotus-glow ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

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

/* ───────── Variant 1: Cinematic Dark ───────── */
function VariantCinematic() {
  const [text, setText] = useState("");
  const full = "Trouvez le bon thérapeute,\npartout en Suisse";
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i++;
      setText(full.slice(0, i));
      if (i >= full.length) clearInterval(id);
    }, 55);
    return () => clearInterval(id);
  }, []);
  const particles = Array.from({ length: 12 });
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#1a0a2e] text-white">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <img src={lotusAsset.url} alt="" aria-hidden className="hv-lotus-glow" style={{ width: 400, height: 400, opacity: 0.08 }} />
      </div>
      <div className="pointer-events-none absolute inset-0">
        {particles.map((_, i) => (
          <span
            key={i}
            className="hv-particle"
            style={{
              left: `${(i * 83) % 100}%`,
              top: `${(i * 47) % 100}%`,
              animationDelay: `${(i % 6) * 0.7}s`,
              animationDuration: `${8 + (i % 5)}s`,
            }}
          />
        ))}
      </div>
      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">
        <LotusGlow size={80} />
        <div className="mt-5"><Wordmark /></div>
        <h1 className="mt-10 whitespace-pre-line text-4xl font-bold leading-tight sm:text-6xl">
          {text}
          <span className="hv-caret">|</span>
        </h1>
        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[rgba(184,110,249,0.4)] bg-white/[0.05] px-4 py-1.5 text-sm backdrop-blur-md">
          <ShieldCheck className="h-4 w-4 text-[#d4a5f9]" />
          Suisse · 26 cantons
        </div>
        <button className="hv-shimmer relative mt-10 overflow-hidden rounded-xl bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] px-8 py-4 text-base font-semibold text-white shadow-[0_10px_40px_-10px_rgba(184,110,249,0.8)]">
          <span className="relative z-10 inline-flex items-center gap-2"><Search className="h-5 w-5" /> Trouver un thérapeute</span>
        </button>
      </div>
    </section>
  );
}

/* ───────── Variant 2: Split Premium ───────── */
function VariantSplit() {
  const { lang } = useParams({ from: "/$lang/" });
  return (
    <section
      className="relative min-h-screen overflow-hidden text-white"
      style={{ background: "radial-gradient(ellipse at 80% 50%, #3d1a5c 0%, #2d1248 60%, #1a0a2e 100%)" }}
    >
      <div className="absolute inset-x-0 top-16 mx-auto h-px max-w-7xl bg-gradient-to-r from-transparent via-[#b86ef9] to-[#5cc8fa] opacity-60" />
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 items-center gap-10 px-6 py-24 md:grid-cols-5">
        <div className="md:col-span-3 space-y-6">
          <div className="hv-slide-up flex items-center gap-3" style={{ animationDelay: "0ms" }}>
            <LotusNeon size={80} className="hv-lotus-glow" />
            <Wordmark />
          </div>
          <h1 className="hv-slide-up text-5xl font-bold leading-[1.05] sm:text-6xl lg:text-7xl" style={{ animationDelay: "150ms" }}>
            Trouvez le bon <span className="bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] bg-clip-text text-transparent">thérapeute</span>, partout en Suisse
          </h1>
          <p className="hv-slide-up max-w-xl text-lg text-[#d4c4e0]" style={{ animationDelay: "300ms" }}>
            Plus de 280 praticiens vérifiés en sophrologie, hypnose, naturopathie et bien plus.
          </p>
          <div className="hv-slide-up relative max-w-xl rounded-2xl border border-[rgba(184,110,249,0.35)] bg-[rgba(20,8,40,0.6)] p-2 shadow-[0_20px_80px_-20px_rgba(184,110,249,0.55)] backdrop-blur-xl" style={{ animationDelay: "450ms" }}>
            <div className="flex items-center">
              <Search className="ml-4 h-5 w-5 text-[#b9a4d4]" />
              <input className="h-12 flex-1 bg-transparent px-3 text-white placeholder:text-[#a89bc4] focus:outline-none" placeholder="Spécialité, ville…" />
              <Link to="/$lang/therapeutes" params={{ lang }}>
                <Button className="m-1 h-10 bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] text-white">Chercher</Button>
              </Link>
            </div>
          </div>
          <div className="hv-slide-up flex flex-wrap gap-5 text-sm text-[#c8b8df]" style={{ animationDelay: "600ms" }}>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-[#5cc8fa]" />Praticiens vérifiés</span>
            <span className="inline-flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-[#d4a5f9]" />26 cantons</span>
          </div>
        </div>
        <div className="md:col-span-2 relative flex items-center justify-center">
          <div className="hv-aura" />
          <div className="hv-aura hv-aura-2" />
          <div className="hv-aura hv-aura-3" />
          <LotusNeon
            size={320}
            className="hv-lotus-spin relative z-10"
            style={{ filter: "drop-shadow(0 0 50px rgba(184,110,249,0.85)) drop-shadow(0 0 90px rgba(92,200,250,0.45))" }}
          />
        </div>
      </div>
    </section>
  );
}

/* ───────── Variant 3: Glassmorphism Luxury ───────── */
function VariantGlass() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#1a0a2e] text-white">
      <div className="hv-blob hv-blob-1" />
      <div className="hv-blob hv-blob-2" />
      <div className="hv-blob hv-blob-3" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6">
        <div className="relative w-full">
          <div className="absolute -inset-8 rounded-[32px] bg-[radial-gradient(ellipse_at_center,rgba(184,110,249,0.35),transparent_70%)] blur-2xl" />
          <div
            className="relative rounded-[24px] border p-10 text-center sm:p-16"
            style={{
              background: "rgba(255,255,255,0.03)",
              borderColor: "rgba(184,110,249,0.15)",
              backdropFilter: "blur(20px)",
            }}
          >
            <div className="flex flex-col items-center gap-4">
              <LotusGlow size={80} />
              <Wordmark />
            </div>
            <h1 className="hv-gradient-text mt-8 text-4xl font-bold leading-tight sm:text-6xl">
              Trouvez le bon thérapeute, partout en Suisse
            </h1>
            <p className="mt-5 text-base text-[#d4c4e0] sm:text-lg">
              La plateforme suisse du bien-être holistique.
            </p>
            <div className="mx-auto mt-8 flex max-w-xl items-center rounded-xl border border-[rgba(184,110,249,0.25)] bg-white/[0.04] p-1.5">
              <Search className="ml-3 h-5 w-5 text-[#b9a4d4]" />
              <input className="h-12 flex-1 bg-transparent px-3 text-white placeholder:text-[#a89bc4] focus:outline-none" placeholder="Que recherchez-vous ?" />
              <Button className="h-10 bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] text-white">Chercher</Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────── Variant 4: Minimal Swiss ───────── */
function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef(false);
  useEffect(() => {
    if (ref.current) return;
    ref.current = true;
    const start = performance.now();
    const dur = 1400;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [to]);
  return <span>{n}{suffix}</span>;
}
function VariantMinimal() {
  const { lang } = useParams({ from: "/$lang/" });
  const words = ["Trouvez", "le", "bon", "__LOTUS__", "thérapeute,", "partout", "en", "Suisse"];
  return (
    <section className="relative flex min-h-screen items-center bg-[#2d1248] text-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-24">
        <h1 className="flex flex-wrap items-center gap-x-4 gap-y-2 text-4xl font-bold leading-tight sm:text-6xl lg:text-7xl">
          {words.map((w, i) =>
            w === "__LOTUS__" ? (
              <span key={i} className="hv-word inline-flex" style={{ animationDelay: `${i * 50}ms` }}>
                <LotusGlow size={96} />
              </span>
            ) : (
              <span key={i} className="hv-word inline-block" style={{ animationDelay: `${i * 50}ms` }}>{w}</span>
            ),
          )}
        </h1>
        <div className="hv-accent-line mt-8 h-[2px] bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa]" />
        <div className="mt-10 grid max-w-2xl grid-cols-3 gap-6 text-center">
          <div><div className="text-3xl font-bold text-[#b86ef9]"><CountUp to={280} suffix="+" /></div><div className="mt-1 text-sm text-[#d4c4e0]">praticiens</div></div>
          <div><div className="text-3xl font-bold text-[#b86ef9]"><CountUp to={26} /></div><div className="mt-1 text-sm text-[#d4c4e0]">cantons</div></div>
          <div><div className="text-3xl font-bold text-[#b86ef9]"><CountUp to={4} /></div><div className="mt-1 text-sm text-[#d4c4e0]">langues</div></div>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/$lang/therapeutes" params={{ lang }}>
            <Button size="lg" className="bg-[#b86ef9] text-white hover:bg-[#a855f7]">Trouver un thérapeute</Button>
          </Link>
          <Link to="/$lang/inscription" params={{ lang }}>
            <Button size="lg" variant="outline" className="border-[#b86ef9] bg-transparent text-white hover:bg-white/10">S'inscrire gratuitement</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ───────── Wrapper with dev selector ───────── */
export function HeroVariants() {
  const [variant, setVariant] = useState<Variant>(1);
  useTranslation(); // ensure i18n ready
  const isDev = import.meta.env.DEV;
  return (
    <>
      <style>{HERO_CSS}</style>
      {variant === 1 && <VariantCinematic />}
      {variant === 2 && <VariantSplit />}
      {variant === 3 && <VariantGlass />}
      {variant === 4 && <VariantMinimal />}
      {isDev && (
        <div className="fixed bottom-4 right-4 z-[1000] flex flex-col items-end gap-1.5">
          <span className="rounded bg-black/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/80 backdrop-blur">Hero variant (dev)</span>
          <div className="flex gap-1.5 rounded-xl bg-black/40 p-1.5 backdrop-blur-md">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setVariant(n as Variant)}
                className={`h-9 w-9 rounded-lg text-sm font-semibold transition ${variant === n ? "bg-[#b86ef9] text-white" : "bg-white/10 text-white/80 hover:bg-white/20"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
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
`;