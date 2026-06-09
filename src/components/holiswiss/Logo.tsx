import { Link, useRouterState } from "@tanstack/react-router";
import { SUPPORTED_LANGS, DEFAULT_LANG } from "@/lib/i18n";
import lotusAsset from "@/assets/lotus-logo.png.asset.json";

export function Logo({ size = 36 }: { size?: number }) {
  // Derive lang from URL — identical on SSR and client (avoids hydration mismatch).
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const first = pathname.split("/").filter(Boolean)[0];
  const lang = (SUPPORTED_LANGS as readonly string[]).includes(first) ? first : DEFAULT_LANG;

  return (
    <Link
      to="/$lang"
      params={{ lang }}
      className="group flex items-center gap-2.5 text-xl font-bold tracking-tight"
    >
      <img
        src={lotusAsset.url}
        alt="Holiswiss"
        width={size}
        height={size}
        className="drop-shadow-[0_0_12px_rgba(168,85,247,0.45)] transition-transform group-hover:scale-105"
        style={{ width: size, height: size }}
      />
      <span>
        <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Holi</span>
        <span className="font-normal text-white">swiss</span>
      </span>
    </Link>
  );
}