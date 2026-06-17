import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/holiswiss/Logo";
import { LanguageSwitcher } from "@/components/holiswiss/LanguageSwitcher";
import { AccountCta } from "@/components/holiswiss/AccountCta";
import { SUPPORTED_LANGS, DEFAULT_LANG } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

type Variant = 1 | 2 | 3 | 4;
const STORAGE_KEY = "holiswiss-nav-variant";

function readVariant(): Variant {
  if (typeof window === "undefined") return 4;
  const raw = Number(localStorage.getItem(STORAGE_KEY));
  return ([1, 2, 3, 4].includes(raw) ? raw : 4) as Variant;
}

function useLang() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const first = pathname.split("/").filter(Boolean)[0];
  const lang = (SUPPORTED_LANGS as readonly string[]).includes(first) ? first : DEFAULT_LANG;
  return lang;
}

function useNavLinks() {
  const { t } = useTranslation();
  return [
    { to: "/$lang/therapeutes", label: t("nav.therapists") },
    { to: "/$lang/blog", label: t("nav.blog") },
    { to: "/$lang/evenements", label: t("nav.events") },
    { to: "/$lang/tarifs", label: t("nav.pricing") },
  ] as const;
}

function useScrolled(threshold = 50) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

/* Shared mobile burger panel */
function MobilePanel({
  open,
  onClose,
  lang,
  links,
  ctaLabel,
}: {
  open: boolean;
  onClose: () => void;
  lang: string;
  links: ReturnType<typeof useNavLinks>;
  ctaLabel: string;
}) {
  if (!open) return null;
  return (
    <div className="md:hidden absolute left-0 right-0 top-16 z-40 border-t border-[rgba(184,110,249,0.2)] bg-[#1a0a3a]/95 backdrop-blur-xl animate-fade-in">
      <div className="flex flex-col px-4 py-4 gap-1">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            params={{ lang }}
            onClick={onClose}
            className="rounded-md px-3 py-3 text-[15px] text-white/85 hover:bg-white/5 hover:text-white"
          >
            {l.label}
          </Link>
        ))}
        <AccountCta
          lang={lang}
          loggedOutLabel={ctaLabel}
          onClick={onClose}
          className="mt-2 rounded-lg border border-[#b86ef9] px-3 py-3 text-center text-[15px] font-semibold text-[#b86ef9]"
        />
      </div>
    </div>
  );
}

/* ---------- Variant 1: Frosted Premium ---------- */
function NavFrosted() {
  const lang = useLang();
  const links = useNavLinks();
  const { t } = useTranslation();
  const scrolled = useScrolled(50);
  const [open, setOpen] = useState(false);
  const cta = t("nav.therapistSpace");

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        background: scrolled ? "rgba(20,8,45,0.75)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(184,110,249,0.15)" : "1px solid transparent",
        boxShadow: scrolled ? "0 4px 30px rgba(0,0,0,0.3)" : "none",
        transition: "all 400ms ease",
      }}
    >
      <style>{`
        .nv1-link { position: relative; }
        .nv1-link::after {
          content: ""; position: absolute; left: 0; bottom: -4px; height: 2px; width: 100%;
          background: #b86ef9; transform: scaleX(0); transform-origin: left;
          transition: transform 200ms ease;
        }
        .nv1-link:hover::after { transform: scaleX(1); }
      `}</style>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden md:flex items-center gap-7">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              params={{ lang }}
              className="nv1-link text-[15px] font-medium text-white/75 hover:text-white transition-colors"
              activeProps={{ className: "text-white" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />
          <AccountCta
            lang={lang}
            loggedOutLabel={cta}
            className="inline-flex items-center rounded-lg border-[1.5px] border-[#b86ef9] px-5 py-2 text-sm font-semibold text-[#b86ef9] transition-all duration-200 hover:bg-[#b86ef9] hover:text-white"
            style={{ boxShadow: "0 0 12px rgba(184,110,249,0.4)" }}
          />
        </div>
        <div className="md:hidden flex items-center gap-1">
          <LanguageSwitcher />
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      <MobilePanel open={open} onClose={() => setOpen(false)} lang={lang} links={links} ctaLabel={cta} />
    </header>
  );
}

/* ---------- Variant 2: Glow Line ---------- */
function NavGlowLine() {
  const lang = useLang();
  const links = useNavLinks();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const cta = t("nav.therapistSpace");

  return (
    <header className="sticky top-0 z-50 w-full bg-[#2d1248]">
      <style>{`
        @keyframes nv2-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .nv2-line {
          position: absolute; left: 0; right: 0; bottom: 0; height: 1px;
          background: linear-gradient(90deg, transparent, #b86ef9, #5cc8fa, #b86ef9, transparent);
          background-size: 200% 100%;
          animation: nv2-shimmer 3s linear infinite;
        }
        .nv2-link { position: relative; }
        .nv2-link::after {
          content: "•"; position: absolute; left: 50%; bottom: -14px; transform: translateX(-50%);
          color: #b86ef9; opacity: 0; transition: opacity 150ms ease;
        }
        .nv2-link:hover::after, .nv2-link.is-active::after { opacity: 1; }
      `}</style>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden md:flex items-center gap-7">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              params={{ lang }}
              className="nv2-link text-[15px] font-medium text-white/70 hover:text-white transition-colors"
              activeProps={{ className: "is-active text-white" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />
          <AccountCta
            lang={lang}
            loggedOutLabel={cta}
            className="inline-flex items-center rounded-lg px-5 py-2 text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 hover:scale-[1.02]"
            style={{
              background: "linear-gradient(135deg, #b86ef9, #5cc8fa)",
              boxShadow: "0 4px 15px rgba(184,110,249,0.35)",
            }}
          />
        </div>
        <div className="md:hidden flex items-center gap-1">
          <LanguageSwitcher />
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      <div className="nv2-line" aria-hidden />
      <MobilePanel open={open} onClose={() => setOpen(false)} lang={lang} links={links} ctaLabel={cta} />
    </header>
  );
}

/* ---------- Variant 3: Spotlight ---------- */
function NavSpotlight() {
  const lang = useLang();
  const links = useNavLinks();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const cta = t("nav.therapistSpace");

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        background: "rgba(15,8,35,0.95)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <style>{`
        .nv3-link {
          padding: 6px 12px; border-radius: 6px;
          transition: background 150ms ease, transform 150ms ease, opacity 150ms ease;
        }
        .nv3-link:hover { background: rgba(184,110,249,0.12); transform: scale(1.02); }
        .nv3-cta { position: relative; overflow: hidden; }
        .nv3-cta::before {
          content: ""; position: absolute; top: 0; left: 0; width: 60%; height: 100%;
          background: linear-gradient(120deg, transparent, rgba(255,255,255,0.35), transparent);
          transform: translateX(-150%); transition: transform 400ms ease;
        }
        .nv3-cta:hover::before { transform: translateX(250%); }
        .nv3-cta:hover { border-color: #b86ef9 !important; }
        .nv3-logo:hover img { transform: rotate(5deg); transition: transform 300ms ease; }
      `}</style>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <span className="nv3-logo"><Logo /></span>
        <nav className="hidden md:flex items-center gap-2">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              params={{ lang }}
              className="nv3-link text-[15px] font-medium text-white/80 hover:text-white"
              activeProps={{ className: "text-white" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />
          <AccountCta
            lang={lang}
            loggedOutLabel={cta}
            className="nv3-cta inline-flex items-center rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors"
            style={{
              background: "#1a0a3a",
              border: "1px solid rgba(184,110,249,0.4)",
            }}
          />
        </div>
        <div className="md:hidden flex items-center gap-1">
          <LanguageSwitcher />
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      <MobilePanel open={open} onClose={() => setOpen(false)} lang={lang} links={links} ctaLabel={cta} />
    </header>
  );
}

/* ---------- Variant 4: Aurora ---------- */
function NavAurora() {
  const lang = useLang();
  const links = useNavLinks();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const cta = t("nav.therapistSpace");

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        background: "linear-gradient(135deg, #1a0a3a, #2d1248, #1a0a3a, #0f1a3a)",
        backgroundSize: "300% 300%",
        animation: "nv4-aurora 8s ease infinite",
        borderBottom: "1px solid rgba(184,110,249,0.2)",
      }}
    >
      <style>{`
        @keyframes nv4-aurora {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes nv4-pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes nv4-aura { 0%,100% { transform: translate(-50%,-50%) scale(0.8); opacity: 0.4; } 50% { transform: translate(-50%,-50%) scale(1.2); opacity: 0.8; } }
        .nv4-link { transition: letter-spacing 200ms ease, color 200ms ease; }
        .nv4-link:hover { color: #fff; letter-spacing: 0.04em; }
        .nv4-cta { animation: nv4-pulse 2s ease infinite; }
        .nv4-logo { position: relative; }
        .nv4-logo::before {
          content: ""; position: absolute; left: 24px; top: 50%;
          width: 56px; height: 56px; border-radius: 50%;
          background: rgba(184,110,249,0.5); filter: blur(20px);
          transform: translate(-50%,-50%); animation: nv4-aura 3s ease infinite;
          pointer-events: none; z-index: 0;
        }
      `}</style>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <span className="nv4-logo relative z-10"><Logo /></span>
        <nav className="hidden md:flex items-center gap-7">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              params={{ lang }}
              className="nv4-link text-[15px] font-medium text-white/80 tracking-wide"
              activeProps={{ className: "text-white" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />
          <AccountCta
            lang={lang}
            loggedOutLabel={cta}
            className="nv4-cta inline-flex items-center rounded-lg px-5 py-2 text-sm font-semibold transition-colors"
            style={{
              background: "rgba(184,110,249,0.2)",
              border: "1px solid rgba(184,110,249,0.5)",
              color: "#d4a8ff",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(184,110,249,0.35)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(184,110,249,0.2)";
              e.currentTarget.style.color = "#d4a8ff";
            }}
          />
        </div>
        <div className="md:hidden flex items-center gap-1">
          <LanguageSwitcher />
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      <MobilePanel open={open} onClose={() => setOpen(false)} lang={lang} links={links} ctaLabel={cta} />
    </header>
  );
}

export function PublicNav() {
  const [variant, setVariant] = useState<Variant>(1);
  useEffect(() => {
    setVariant(readVariant());
    const onCustom = () => setVariant(readVariant());
    const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) setVariant(readVariant()); };
    window.addEventListener("nav-variant-change", onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("nav-variant-change", onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  switch (variant) {
    case 2: return <NavGlowLine />;
    case 3: return <NavSpotlight />;
    case 4: return <NavAurora />;
    default: return <NavFrosted />;
  }
}

export function PublicNavDevPicker() {
  const [variant, setVariant] = useState<Variant>(1);
  useEffect(() => { setVariant(readVariant()); }, []);
  if (!import.meta.env.DEV) return null;

  const set = (v: Variant) => {
    setVariant(v);
    try { localStorage.setItem(STORAGE_KEY, String(v)); } catch {}
    window.dispatchEvent(new Event("nav-variant-change"));
  };

  return (
    <div className="fixed bottom-4 right-20 z-[1000] flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md shadow-lg">
      <span className="text-white/50">Nav variant (dev)</span>
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