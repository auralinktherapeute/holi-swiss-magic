import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Circle, ChevronDown, ChevronUp, ExternalLink, X } from "lucide-react";
import {
  SHOW_CHECKLIST_EVENT,
  useOnboardingState,
  useUpdateOnboardingProgress,
} from "@/hooks/use-onboarding";
import {
  countDone,
  SETUP_STEPS,
  shouldShowChecklistCard,
  type OnboardingEvent,
  type SetupStep,
} from "@/lib/onboarding-checklist";

type Action =
  | { kind: "link"; to: string; search?: Record<string, string> }
  | { kind: "public"; event: OnboardingEvent; hash?: string };

const ACTIONS: Record<SetupStep, Action> = {
  profile: { kind: "link", to: "/dashboard/profil" },
  services: { kind: "link", to: "/dashboard/facturation", search: { vue: "prestations" } },
  currency: { kind: "link", to: "/dashboard/facturation", search: { vue: "parametres" } },
  availability: { kind: "link", to: "/dashboard/agenda" },
  publicPage: { kind: "public", event: "public_page_viewed" },
  booking: { kind: "public", event: "booking_checked" },
  billing: { kind: "link", to: "/dashboard/facturation", search: { vue: "parametres" } },
};

/**
 * Carte « Configurez votre cabinet » — 7 étapes à état réel.
 * Les étapes non déductibles des données (page publique, parcours de
 * réservation, maintien de CHF) ne passent à « terminé » qu'après une action
 * explicite du thérapeute, enregistrée dans sa progression.
 */
export function OnboardingChecklist() {
  const { t, i18n } = useTranslation();
  const { data } = useOnboardingState();
  const update = useUpdateOnboardingProgress();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = () => window.setTimeout(() => cardRef.current?.scrollIntoView({ block: "start" }), 150);
    window.addEventListener(SHOW_CHECKLIST_EVENT, h);
    return () => window.removeEventListener(SHOW_CHECKLIST_EVENT, h);
  }, []);

  if (!data) return null;
  const c = data.checklist;
  const reopened = !!data.progress?.checklist_reopened;
  if (!shouldShowChecklistCard(c, reopened)) return null;

  const done = countDone(c);
  const total = SETUP_STEPS.length;
  const collapsed = !!data.progress?.checklist_collapsed;
  const lang = (i18n.language || "fr").split("-")[0];
  const publicLang = ["fr", "de", "it", "en"].includes(lang) ? lang : "fr";

  return (
    <Card
      ref={cardRef}
      data-testid="setup-checklist"
      className="relative overflow-hidden rounded-2xl border-border"
      style={{ background: "var(--holi-wash)" }}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-medium text-foreground/90">
            {t("onboarding.checklist.title")} —{" "}
            <span className="tabular-nums">{t("onboarding.checklist.progress", { done, total })}</span>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11"
              aria-expanded={!collapsed}
              onClick={() => update.mutate({ checklistCollapsed: !collapsed })}
            >
              {collapsed ? <ChevronDown className="mr-1 h-4 w-4" aria-hidden="true" /> : <ChevronUp className="mr-1 h-4 w-4" aria-hidden="true" />}
              {collapsed ? t("onboarding.checklist.expand") : t("onboarding.checklist.collapse")}
            </Button>
            {done === total && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                aria-label={t("onboarding.checklist.hide")}
                onClick={() => update.mutate({ checklistReopened: false })}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={t("onboarding.checklist.progress_aria", { done, total })}
        >
          <div
            className="h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${(done / total) * 100}%`, background: "var(--holi-gradient-btn)" }}
          />
        </div>
        {done === total && <p className="mt-3 text-sm text-foreground/85">{t("onboarding.checklist.all_done")}</p>}
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-1.5 pt-0">
          <ol className="space-y-1.5">
            {SETUP_STEPS.map((key) => {
              const isDone = c[key];
              const action = ACTIONS[key];
              return (
                <li
                  key={key}
                  data-testid={`setup-step-${key}`}
                  data-done={isDone ? "true" : "false"}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      isDone ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Circle className="h-3.5 w-3.5" aria-hidden="true" />}
                  </span>
                  <span className={`min-w-0 flex-1 text-sm ${isDone ? "text-muted-foreground line-through" : "text-foreground/90"}`}>
                    {t(`onboarding.checklist.steps.${key}.label`)}
                    {isDone && <span className="sr-only"> — {t("onboarding.checklist.done")}</span>}
                  </span>
                  {!isDone && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {key === "currency" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="min-h-11"
                          onClick={() => update.mutate({ event: "currency_confirmed" })}
                        >
                          {t("onboarding.checklist.keep_chf")}
                        </Button>
                      )}
                      {action.kind === "link" ? (
                        <Button asChild size="sm" variant="outline" className="min-h-11 rounded-lg">
                          <Link to={action.to} search={action.search as never}>
                            {t(`onboarding.checklist.steps.${key}.cta`)}
                          </Link>
                        </Button>
                      ) : data.slug ? (
                        <Button asChild size="sm" variant="outline" className="min-h-11 rounded-lg">
                          <Link
                            to="/$lang/therapeute/$slug"
                            params={{ lang: publicLang, slug: data.slug }}
                            target="_blank"
                            rel="noopener"
                            onClick={() => update.mutate({ event: action.event })}
                          >
                            {t(`onboarding.checklist.steps.${key}.cta`)}
                            <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                            <span className="sr-only"> {t("onboarding.checklist.new_tab")}</span>
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t("onboarding.checklist.no_slug")}</span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </CardContent>
      )}
    </Card>
  );
}
