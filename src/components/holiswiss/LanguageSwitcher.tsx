import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LANGS } from "@/lib/constants";
import { useEffect, useRef, useState } from "react";
import { Globe, ChevronDown } from "lucide-react";

const NATIVE: Record<string, string> = {
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  en: "English",
};

type Variant = 1 | 2 | 3 | 4;

function useChangeLang() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const first = pathname.split("/").filter(Boolean)[0];
  const current = LANGS.find((l) => l.code === first) ?? LANGS[0];

  const change = async (code: string) => {
    await i18n.changeLanguage(code);
    try { localStorage.setItem("holiswiss-lang", code); } catch {}
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length && LANGS.some((l) => l.code === segments[0])) {
      segments[0] = code;
    } else {
      segments.unshift(code);
    }
    navigate({ to: "/" + segments.join("/") });
  };

  return { current, change };
}

function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onOutside]);
  return ref;
}

/* ---------- Variant 1: Pill Minimal ---------- */
function VariantPill() {
  const { current, change } = useChangeLang();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Change language"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-transparent px-3.5 py-1.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-white/10"
      >
        <span aria-hidden>{current.flag}</span>
        <span>{current.label}</span>
      </button>
      {open && (
        <div
          className="absolute right-0 z-50 mt-2 min-w-[180px] origin-top-right rounded-xl border p-1.5 shadow-2xl animate-fade-in"
          style={{
            background: "#1a0f35",
            borderColor: "rgba(184,110,249,0.3)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          {LANGS.map((l) => {
            const active = l.code === current.code;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => { change(l.code); setOpen(false); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
                style={{
                  background: active ? "rgba(184,110,249,0.2)" : "transparent",
                  color: active ? "#b86ef9" : "rgba(255,255,255,0.9)",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(184,110,249,0.15)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <span aria-hidden>{l.flag}</span>
                <span>{NATIVE[l.code]}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Variant 2: Glassmorphism ---------- */
function VariantGlass() {
  const { current, change } = useChangeLang();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Change language"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-[10px] border px-3 py-1.5 text-[13px] text-white backdrop-blur-md transition-colors"
        style={{
          background: "rgba(255,255,255,0.06)",
          borderColor: "rgba(255,255,255,0.12)",
        }}
      >
        <span aria-hidden className="text-[18px] leading-none">{current.flag}</span>
        <span>{current.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          className="absolute right-0 z-50 mt-2 min-w-[180px] rounded-[14px] border p-1.5 backdrop-blur-xl animate-fade-in"
          style={{
            background: "rgba(15,10,30,0.85)",
            borderColor: "rgba(184,110,249,0.2)",
          }}
        >
          {LANGS.map((l, i) => (
            <div key={l.code}>
              <button
                type="button"
                onClick={() => { change(l.code); setOpen(false); }}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-[13px] text-white/90 transition-colors hover:text-white"
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(184,110,249,0.12)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden className="text-[18px] leading-none">{l.flag}</span>
                  <span>{NATIVE[l.code]}</span>
                </span>
                <span className="text-[11px] uppercase tracking-wide text-white/50">{l.label}</span>
              </button>
              {i < LANGS.length - 1 && <div className="mx-3 h-px bg-white/5" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Variant 3: Animated Tabs ---------- */
function VariantTabs() {
  const { current, change } = useChangeLang();
  const idx = LANGS.findIndex((l) => l.code === current.code);
  const count = LANGS.length;

  return (
    <div
      className="relative inline-flex items-center rounded-full p-[3px]"
      style={{ background: "rgba(255,255,255,0.05)" }}
    >
      {/* Sliding pill */}
      <span
        aria-hidden
        className="absolute top-[3px] bottom-[3px] rounded-full transition-transform duration-300 ease-out"
        style={{
          left: "3px",
          width: `calc((100% - 6px) / ${count})`,
          transform: `translateX(${idx * 100}%)`,
          background: "#b86ef9",
        }}
      />
      {LANGS.map((l) => {
        const active = l.code === current.code;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => change(l.code)}
            aria-label={NATIVE[l.code]}
            className={`relative z-10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] transition-colors duration-200 ${
              active ? "font-semibold text-white" : "text-white/50 hover:text-white/80"
            }`}
          >
            <span aria-hidden>{l.flag}</span>
            <span className="hidden sm:inline">{l.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Variant 4: Morphing Globe ---------- */
function VariantGlobe() {
  const { current, change } = useChangeLang();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <style>{`
        @keyframes lswgloberot { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes lswpop { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes lswslidein { from { opacity: 0; transform: translateX(8px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
      <button
        type="button"
        aria-label="Change language"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm text-white transition-colors"
        style={{ borderColor: "rgba(184,110,249,0.3)" }}
      >
        <Globe
          className="h-[18px] w-[18px]"
          style={{ color: "#b86ef9", animation: "lswgloberot 8s linear infinite" }}
        />
        <span aria-hidden className="text-[18px] leading-none">{current.flag}</span>
        <span className="text-white/30">|</span>
        <span>{current.label}</span>
      </button>
      {open && (
        <div
          className="absolute right-0 z-50 mt-2 min-w-[220px] overflow-hidden rounded-[14px] border"
          style={{
            background: "#0f0a1e",
            borderColor: "rgba(184,110,249,0.25)",
            transformOrigin: "top right",
            animation: "lswpop 200ms ease-out",
          }}
        >
          {LANGS.map((l, i) => {
            const active = l.code === current.code;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => { change(l.code); setOpen(false); }}
                className="group flex h-11 w-full items-center justify-between px-4 transition-colors"
                style={{
                  animation: `lswslidein 250ms ease-out both`,
                  animationDelay: `${i * 30}ms`,
                  color: active ? "#b86ef9" : "rgba(255,255,255,0.9)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "linear-gradient(90deg, transparent, rgba(184,110,249,0.1))";
                }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <span className="flex items-center gap-3 text-sm">
                  {active && <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: "#b86ef9" }} />}
                  <span
                    aria-hidden
                    className="text-[22px] leading-none transition-transform duration-150 group-hover:scale-110"
                  >
                    {l.flag}
                  </span>
                  <span>{NATIVE[l.code]}</span>
                </span>
                <span className="text-[11px] uppercase tracking-wide text-white/40">{l.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Exported switcher with dev variant selector ---------- */
const STORAGE_KEY = "holiswiss-lang-variant";

function readVariant(): Variant {
  if (typeof window === "undefined") return 1;
  const raw = Number(localStorage.getItem(STORAGE_KEY));
  return ([1, 2, 3, 4].includes(raw) ? raw : 1) as Variant;
}

export function LanguageSwitcher() {
  const [variant, setVariant] = useState<Variant>(1);

  useEffect(() => {
    setVariant(readVariant());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setVariant(readVariant());
    };
    window.addEventListener("storage", onStorage);
    const onCustom = () => setVariant(readVariant());
    window.addEventListener("lsw-variant-change", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("lsw-variant-change", onCustom);
    };
  }, []);

  switch (variant) {
    case 2: return <VariantGlass />;
    case 3: return <VariantTabs />;
    case 4: return <VariantGlobe />;
    default: return <VariantPill />;
  }
}

export function LanguageSwitcherDevPicker() {
  const [variant, setVariant] = useState<Variant>(1);
  useEffect(() => { setVariant(readVariant()); }, []);
  if (!import.meta.env.DEV) return null;

  const set = (v: Variant) => {
    setVariant(v);
    try { localStorage.setItem(STORAGE_KEY, String(v)); } catch {}
    window.dispatchEvent(new Event("lsw-variant-change"));
  };

  return (
    <div className="fixed bottom-4 left-4 z-[1000] flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md shadow-lg">
      <span className="text-white/50">Lang variant (dev)</span>
      {[1, 2, 3, 4].map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => set(v as Variant)}
          className={`h-6 w-6 rounded-full text-[11px] font-semibold transition-colors ${
            variant === v ? "bg-[#b86ef9] text-white" : "bg-white/5 text-white/60 hover:bg-white/10"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}