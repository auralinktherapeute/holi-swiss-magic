import { useTranslation } from "react-i18next";
import { CalendarCheck, Users, Sparkles, MousePointerClick, Star } from "lucide-react";

/**
 * Bande « promesse plateforme » affichée juste sous le hero.
 * Positionne Holiswiss comme une plateforme complète (agenda, CRM,
 * visibilité Google & IA, réservation, avis) — pas un simple annuaire.
 */
export function PlatformPromiseBand() {
  const { t } = useTranslation();

  const items = [
    { icon: CalendarCheck, label: t("home.promise.agenda", "Agenda en ligne") },
    { icon: Users, label: t("home.promise.crm", "CRM patients") },
    { icon: Sparkles, label: t("home.promise.visibility", "Visibilité Google & IA") },
    { icon: MousePointerClick, label: t("home.promise.booking", "Réservation en ligne") },
    { icon: Star, label: t("home.promise.reviews", "Avis patients") },
  ];

  return (
    <section className="border-y border-[rgba(184,110,249,0.15)] bg-[#241040]/80">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-semibold uppercase tracking-widest text-[#5cc8fa]">
          {t("home.promise.kicker", "Plus qu'un annuaire")}
        </p>
        <h2 className="mt-1 text-center text-xl font-bold text-white sm:text-2xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
          {t("home.promise.title", "La plateforme complète des thérapeutes suisses")}
        </h2>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {items.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(184,110,249,0.3)] bg-[#3d1a5c]/60 px-4 py-2 text-sm text-white/90 backdrop-blur transition hover:border-[#b86ef9]/70"
            >
              <Icon className="h-4 w-4 text-[#b86ef9]" aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
