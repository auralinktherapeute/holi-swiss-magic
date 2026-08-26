import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { UserCheck, CalendarPlus, PenLine, ChevronRight } from "lucide-react";
import { getOnboardingState } from "@/lib/onboarding.functions";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { ShowcaseScoreCard } from "@/components/dashboard/ShowcaseScoreCard";
import { CabinetOverviewPanel } from "@/components/dashboard/CabinetOverviewPanel";
import { CabinetStatsPanel } from "@/components/dashboard/CabinetStatsPanel";

export const Route = createFileRoute("/dashboard/")({ component: Page });

/**
 * Accueil du tableau de bord thérapeute.
 *
 * Couleurs : uniquement des tokens (`primary`, `surface`, `border`,
 * `muted-foreground`…). Aucun hexadécimal en dur, pour que le réalignement de
 * la charte se fasse en changeant les valeurs dans `styles.css` et non en
 * repassant sur chaque écran.
 *
 * Le bloc « Complétez votre profil » d'origine doublonnait avec
 * `OnboardingChecklist` — deux guidages concurrents affichés ensemble, et le
 * bloc statique continuait de réclamer un profil déjà complet une fois la
 * checklist disparue. Il est remplacé par des raccourcis, utiles à tout moment.
 */
function Page() {
  const { t } = useTranslation();
  const fetchState = useServerFn(getOnboardingState);

  // Même clé de requête que le layout et la checklist : les données sont déjà
  // en cache, cet appel n'ajoute aucune requête réseau.
  const { data: onboarding } = useQuery({
    queryKey: ["onboarding-state"],
    queryFn: () => fetchState(),
    staleTime: 30_000,
  });

  const checklist = onboarding?.checklist;
  const total = checklist ? Object.keys(checklist).length : 0;
  const done = checklist ? Object.values(checklist).filter(Boolean).length : 0;
  const settingUp = total > 0 && done < total;

  const shortcuts = [
    { icon: UserCheck, label: t("dashboard_home.complete_profile"), to: "/dashboard/profil" as const },
    { icon: CalendarPlus, label: t("dashboard_home.update_agenda"), to: "/dashboard/agenda" as const },
    { icon: PenLine, label: t("dashboard_home.write_article"), to: "/dashboard/articles" as const },
  ];

  return (
    <div className="space-y-8 p-6 md:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {t("dashboard_home.greeting")}
          </h1>
          <p className="mt-2 text-base text-muted-foreground md:text-lg">
            {settingUp ? t("dashboard_home.progress_title") : t("dashboard_home.overview_subtitle")}
          </p>
        </div>

        {/* Le badge portait « Plan Pro · actif » sans aucune condition : il
            l'affichait à tous, y compris aux comptes gratuits. Il porte
            désormais la progression réelle, seule donnée dont on dispose ici. */}
        {settingUp && (
          <Badge
            variant="secondary"
            className="border-border bg-primary-xlight text-primary tabular-nums"
          >
            {done}/{total}
          </Badge>
        )}
      </header>

      <OnboardingChecklist />

      <ShowcaseScoreCard />

      <section aria-labelledby="shortcuts-title">
        <h2 id="shortcuts-title" className="text-base font-medium text-foreground/90">
          {t("dashboard_home.quick_actions")}
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {shortcuts.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.to}
                to={s.to}
                className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 outline-none transition-colors duration-200 ease-out hover:bg-primary-xlight focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-xlight text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium text-foreground/90">{s.label}</span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>
      </section>

      <CabinetOverviewPanel />

      <CabinetStatsPanel />
    </div>
  );
}
