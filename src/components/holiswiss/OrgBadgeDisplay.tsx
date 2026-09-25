import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { OrgCertificationBadge } from "./OrgCertificationBadges";

/**
 * 4 dispositions du badge de certification par organisme (SVHH…) dans
 * l'en-tête du profil public — choisissables via le sélecteur dev.
 * 1. Sceau à taille égale (même diamètre que la photo, sous celle-ci)
 * 2. Halo superposé (sceau chevauchant le bas-droit de la photo)
 * 3. Médaillon horizontal (capsule élégante sous la photo)
 * 4. Ruban prestige (bandeau or + sceau pleine taille)
 *
 * Aucun texte inventé : seuls `display_name` et `certification_label`
 * (modèle {organization}) sont affichés. Le badge reste conditionné aux
 * certifications actives — aucun bloc vide.
 */
export type OrgBadgeVariant = 1 | 2 | 3 | 4;

const STORAGE_KEY = "holiswiss-orgbadge-variant";
const EVENT = "orgbadge-variant-change";

function readVariant(): OrgBadgeVariant {
  if (typeof window === "undefined") return 1;
  const raw = Number(localStorage.getItem(STORAGE_KEY));
  return ([1, 2, 3, 4].includes(raw) ? raw : 1) as OrgBadgeVariant;
}

export function useOrgBadgeVariant(): OrgBadgeVariant {
  const [variant, setVariant] = useState<OrgBadgeVariant>(1);
  useEffect(() => {
    setVariant(readVariant());
    const onChange = () => setVariant(readVariant());
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return variant;
}

/** Or : dégradé du cerclage du sceau, indépendant de la couleur d'accent. */
const SEAL_RING = "linear-gradient(135deg,#d4af37,#b87333)";

function BadgeDetails({ c }: { c: OrgCertificationBadge }) {
  const color = c.badge_color || "#b86ef9";
  const label = (c.certification_label || "").trim().replace(/\{organization\}/gi, c.display_name);
  return (
    <PopoverContent className="w-64 border-white/10 bg-[#1a1035] text-white">
      <p className="text-sm font-semibold">{c.display_name}</p>
      {label && <p className="mt-1 text-xs text-white/70">{label}</p>}
      {c.website_url && (
        <a
          href={c.website_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium"
          style={{ color }}
        >
          <ExternalLink className="h-3.5 w-3.5" /> Site de l'organisme
        </a>
      )}
    </PopoverContent>
  );
}

/** Sceau circulaire avec cerclage or, image réelle de l'organisme. */
function Seal({ c, sizeClass }: { c: OrgCertificationBadge; sizeClass: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full p-[2px] ${sizeClass}`}
      style={{ background: SEAL_RING }}
    >
      <span className="flex h-full w-full items-center justify-center rounded-full bg-[#2a1a3e] p-1">
        {c.logo_url ? (
          <img
            src={c.logo_url}
            alt={c.display_name}
            loading="lazy"
            className="h-full w-full rounded-full object-contain"
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center rounded-full text-xs font-bold"
            style={{ color: c.badge_color || "#b86ef9" }}
          >
            {c.code.slice(0, 4)}
          </span>
        )}
      </span>
    </span>
  );
}

export function OrgBadgeDisplay({
  items,
  variant = 1,
  className = "",
}: {
  items: OrgCertificationBadge[];
  variant?: OrgBadgeVariant;
  className?: string;
}) {
  if (!items?.length || variant === 2) return null;

  if (variant === 1) {
    return (
      <div className={`flex flex-col items-center gap-1.5 ${className}`}>
        {items.map((c) => (
          <Popover key={c.id}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Certification ${c.display_name}`}
                className="group flex min-h-11 flex-col items-center gap-1.5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                <Seal c={c} sizeClass="h-28 w-28" />
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: c.badge_color || "#b86ef9" }}
                >
                  {c.display_name}
                </span>
              </button>
            </PopoverTrigger>
            <BadgeDetails c={c} />
          </Popover>
        ))}
      </div>
    );
  }

  if (variant === 3) {
    return (
      <div className={`flex flex-col items-stretch gap-2 ${className}`}>
        {items.map((c) => (
          <Popover key={c.id}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Certification ${c.display_name}`}
                className="flex min-h-11 max-w-56 items-center gap-3 rounded-full border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-4 text-left transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                <Seal c={c} sizeClass="h-11 w-11" />
                <span className="flex min-w-0 flex-col items-start">
                  <span className="text-xs font-semibold text-white/90">{c.display_name}</span>
                  {(c.certification_label || "").trim() && (
                    <span className="max-w-40 truncate text-[10px] text-white/55">
                      {(c.certification_label || "").trim().replace(/\{organization\}/gi, c.display_name)}
                    </span>
                  )}
                </span>
              </button>
            </PopoverTrigger>
            <BadgeDetails c={c} />
          </Popover>
        ))}
      </div>
    );
  }

  // variant 4 — ruban prestige
  return (
    <div className={`flex flex-col items-center ${className}`}>
      {items.map((c) => {
        const color = c.badge_color || "#b86ef9";
        return (
          <Popover key={c.id}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Certification ${c.display_name}`}
                className="group flex min-h-11 flex-col items-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                <span
                  className="rounded-t-lg px-3 py-1 text-[9px] font-extrabold uppercase tracking-widest shadow-md"
                  style={{ background: `linear-gradient(135deg,${color},${color}cc)`, color: "#1a1035" }}
                >
                  {c.display_name}
                </span>
                <span className="-mt-px">
                  <Seal c={c} sizeClass="h-28 w-28" />
                </span>
              </button>
            </PopoverTrigger>
            <BadgeDetails c={c} />
          </Popover>
        );
      })}
    </div>
  );
}

/**
 * Disposition 2 : sceau chevauchant le bas-droit de la photo.
 * À rendre dans le conteneur rond de la photo (parent positionné).
 */
export function OrgBadgeHalo({ items }: { items: OrgCertificationBadge[] }) {
  if (!items?.length) return null;
  return (
    <span className="absolute left-14 top-14 z-20 flex flex-col items-center">
      {items.map((c) => (
        <Popover key={c.id}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Certification ${c.display_name}`}
              className="block rounded-full shadow-xl transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              <Seal c={c} sizeClass="h-16 w-16" />
            </button>
          </PopoverTrigger>
          <BadgeDetails c={c} />
        </Popover>
      ))}
    </span>
  );
}

/** Sélecteur dev, même motif que LanguageSwitcherDevPicker. */
export function OrgBadgeDevPicker() {
  const [variant, setVariant] = useState<OrgBadgeVariant>(1);
  useEffect(() => {
    setVariant(readVariant());
    const onChange = () => setVariant(readVariant());
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  if (!import.meta.env.DEV) return null;

  const set = (v: OrgBadgeVariant) => {
    setVariant(v);
    try {
      localStorage.setItem(STORAGE_KEY, String(v));
    } catch {
      /* stockage indisponible : variante éphémère */
    }
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-xs text-white/80 shadow-lg backdrop-blur-md">
      <span className="text-white/50">Org badge variant (dev)</span>
      {[1, 2, 3, 4].map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => set(v as OrgBadgeVariant)}
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
