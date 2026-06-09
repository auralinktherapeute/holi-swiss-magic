import { Link, useRouterState } from "@tanstack/react-router";
import { SUPPORTED_LANGS, DEFAULT_LANG } from "@/lib/i18n";
import lotusAsset from "@/assets/lotus-neon.png.asset.json";

export function Logo({ size = 48 }: { size?: number }) {
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
        className="transition-transform group-hover:scale-105"
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          mixBlendMode: "screen",
          filter: "drop-shadow(0 0 12px rgba(184,110,249,0.7))",
        }}
      />
      <span>
        <span className="font-bold text-[#b86ef9]">Holi</span>
        <span className="font-normal text-white">swiss</span>
      </span>
    </Link>
  );
}