import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { LifeBuoy, PlayCircle, RotateCcw, ListChecks } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  SHOW_CHECKLIST_EVENT,
  startTour,
  useOnboardingState,
  useUpdateOnboardingProgress,
} from "@/hooks/use-onboarding";
import { resumeTourStep, showNewBadge } from "@/lib/onboarding-checklist";

/**
 * Entrée « Aide & prise en main » : remplace l'ancien petit bouton « ? ».
 * `compact` : icône seule (mobile), avec aria-label et infobulle.
 */
export function HelpMenu({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data } = useOnboardingState();
  const update = useUpdateOnboardingProgress();
  const progress = data?.progress ?? null;
  const isNew = data ? showNewBadge(progress) : false;
  const started = !!progress?.tour_started_at && !progress?.tour_completed_at;
  const label = t("onboarding.help_entry");

  const trigger = compact ? (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={isNew ? `${label} — ${t("onboarding.new_badge")}` : label}
      data-testid="help-entry"
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground/80 outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:bg-muted"
    >
      <LifeBuoy className="h-5 w-5" aria-hidden="true" />
      {isNew && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" aria-hidden="true" />}
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      data-testid="help-entry"
      data-tour-id="nav-help"
      className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-border bg-primary-xlight/60 px-3 py-2 text-sm font-medium text-primary outline-none transition-colors hover:bg-primary-xlight focus-visible:ring-2 focus-visible:ring-ring active:bg-primary-xlight"
    >
      <LifeBuoy className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1 text-left">{label}</span>
      {isNew && (
        <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
          {t("onboarding.new_badge")}
        </span>
      )}
    </button>
  );

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <>
      {compact ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        trigger
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("onboarding.help_menu.title")}</DialogTitle>
            <DialogDescription>{t("onboarding.help_menu.description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <HelpAction
              icon={PlayCircle}
              label={
                started
                  ? t("onboarding.help_menu.resume", { step: resumeTourStep(progress) + 1 })
                  : t("onboarding.help_menu.start")
              }
              onClick={() => run(() => startTour("resume"))}
            />
            <HelpAction
              icon={RotateCcw}
              label={t("onboarding.help_menu.restart")}
              onClick={() => run(() => startTour("restart"))}
            />
            <HelpAction
              icon={ListChecks}
              label={t("onboarding.help_menu.show_checklist")}
              onClick={() =>
                run(() => {
                  update.mutate({ checklistReopened: true, checklistCollapsed: false });
                  void navigate({ to: "/dashboard" });
                  window.dispatchEvent(new CustomEvent(SHOW_CHECKLIST_EVENT));
                })
              }
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HelpAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof LifeBuoy;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm font-medium text-foreground/90 outline-none transition-colors hover:bg-primary-xlight focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      {label}
    </button>
  );
}
