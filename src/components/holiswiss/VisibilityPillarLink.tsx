import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { isPillarLang } from "@/lib/visibility-pillar-content";

const LABELS = {
  fr: "Comment développer votre visibilité de thérapeute en Suisse",
  de: "Wie Sie als Therapeutin oder Therapeut in der Schweiz sichtbarer werden",
  it: "Come aumentare la visibilità del vostro studio in Svizzera",
} as const;

/**
 * Lien de maillage sobre vers la page pilier, dans la langue courante.
 *
 * Le slug diffère par langue : chaque branche cible sa route typée. Aucune page
 * anglaise n'existe — le composant ne rend alors rien, plutôt que de renvoyer
 * vers une autre langue.
 */
export function VisibilityPillarLink({ lang, className = "" }: { lang: string; className?: string }) {
  if (!isPillarLang(lang)) return null;
  const cls =
    `inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-[#5cc8fa] underline underline-offset-4 hover:text-white focus-visible:ring-2 focus-visible:ring-[#b86ef9] focus-visible:outline-none ${className}`.trim();
  const label = LABELS[lang];
  const icon = <ArrowRight className="h-4 w-4" aria-hidden="true" />;

  if (lang === "de") {
    return (
      <Link to="/$lang/sichtbarkeit-therapeuten-schweiz" params={{ lang }} className={cls}>
        {label}
        {icon}
      </Link>
    );
  }
  if (lang === "it") {
    return (
      <Link to="/$lang/visibilita-terapeuti-svizzera" params={{ lang }} className={cls}>
        {label}
        {icon}
      </Link>
    );
  }
  return (
    <Link to="/$lang/visibilite-therapeute-suisse" params={{ lang }} className={cls}>
      {label}
      {icon}
    </Link>
  );
}
