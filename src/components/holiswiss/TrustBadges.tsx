import { BadgeCheck, ShieldCheck, Sparkles, FileText } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { TrustBadge } from "@/lib/therapist-badges";

const ICONS = {
  pro: Sparkles,
  verified: ShieldCheck,
  certification: BadgeCheck,
  accreditation: FileText,
} as const;

const STYLES: Record<string, string> = {
  pro: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  verified: "border-[rgba(184,110,249,0.4)] bg-[rgba(184,110,249,0.12)] text-[#d9b4ff]",
  certificationVerified: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  declared: "border-white/15 bg-white/5 text-[rgba(255,255,255,0.72)]",
};

function fmtDate(iso?: string | null, lang = "fr") {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const locale = { de: "de-CH", it: "it-CH", en: "en-GB" }[lang.slice(0, 2)] ?? "fr-CH";
  return d.toLocaleDateString(locale, { year: "numeric", month: "long" });
}

/**
 * Badges de confiance de la fiche publique.
 * Un badge vérifié et un badge déclaré ne se ressemblent jamais : couleur,
 * icône et description accessible diffèrent explicitement.
 */
export function TrustBadges({
  badges,
  lang = "fr",
  className = "",
}: {
  badges: TrustBadge[];
  lang?: string;
  className?: string;
}) {
  if (!badges.length) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <ul className={`flex flex-wrap gap-2 ${className}`}>
        {badges.map((b) => {
          const Icon = ICONS[b.kind];
          const style =
            b.kind === "pro"
              ? STYLES.pro
              : b.kind === "verified"
                ? STYLES.verified
                : b.verified
                  ? STYLES.certificationVerified
                  : STYLES.declared;
          const when = fmtDate(b.verifiedAt, lang);
          const accessible = `${b.label} — ${b.description}${when ? ` (${when})` : ""}`;
          return (
            <li key={b.key}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    role="note"
                    tabIndex={0}
                    aria-label={accessible}
                    title={accessible}
                    className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[#b86ef9] ${style}`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{b.label}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs border-[rgba(184,110,249,0.3)] bg-[#0f0a1e] text-white">
                  <p>{b.description}</p>
                  {when && (
                    <p className="mt-1 text-[11px] text-[rgba(255,255,255,0.6)]">
                      {lang.startsWith("de") ? "Geprüft am" : lang.startsWith("it") ? "Verificato il" : lang.startsWith("en") ? "Verified on" : "Vérifié le"} {when}
                      {b.source ? ` · ${b.source}` : ""}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    </TooltipProvider>
  );
}
