import { ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface OrgCertificationBadge {
  id: string;
  code: string;
  display_name: string;
  logo_url: string | null;
  badge_color: string | null;
  certification_label: string | null;
  website_url: string | null;
}

/**
 * Badges de certification délivrés par des organismes externes (SVHH…).
 * Affichés uniquement lorsqu'une certification active existe : aucun bloc vide.
 * Le libellé provient de `certification_label` (modèle avec {organization}) —
 * jamais inventé côté code, pour ne pas affirmer un statut inexact.
 */
export function OrgCertificationBadges({
  items,
  className = "",
}: {
  items: OrgCertificationBadge[];
  className?: string;
}) {
  if (!items?.length) return null;

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      {items.map((c) => {
        const color = c.badge_color || "#b86ef9";
        const label = (c.certification_label || "").trim().replace(/\{organization\}/gi, c.display_name);
        return (
          <Popover key={c.id}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Certification ${c.display_name}`}
                className="flex min-h-11 items-center gap-2 rounded-xl border px-2 py-1.5 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                style={{ borderColor: `${color}59`, background: `${color}1a`, boxShadow: `0 0 14px ${color}26` }}
              >
                {c.logo_url ? (
                  <img
                    src={c.logo_url}
                    alt={c.display_name}
                    loading="lazy"
                    width={40}
                    height={40}
                    className="h-10 w-10 shrink-0 rounded-lg bg-white/90 object-contain p-0.5"
                  />
                ) : (
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                    style={{ background: `${color}33`, color }}
                  >
                    {c.code.slice(0, 4)}
                  </span>
                )}
                <span className="text-xs font-medium leading-tight text-white/85">
                  {label || c.display_name}
                </span>
              </button>
            </PopoverTrigger>
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
                  <ExternalLink className="h-3.5 w-3.5" /> Site de l&apos;organisme
                </a>
              )}
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
