import { useTranslation } from "react-i18next";
import { CircleHelp, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { startTour } from "@/hooks/use-onboarding";

export type HelpModule = "agenda" | "billing" | "packages" | "questionnaires" | "visibility";

/** Mini-aide ciblée sur un module — ne relance pas le guide complet. */
export function ModuleHelp({ module }: { module: HelpModule }) {
  const { t } = useTranslation();
  const title = t(`onboarding.module_help.${module}.title`);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          data-testid={`module-help-${module}`}
          aria-label={t("onboarding.module_help.open", { module: title })}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-primary outline-none transition-colors hover:bg-primary-xlight focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CircleHelp className="h-4 w-4" aria-hidden="true" />
          {t("onboarding.module_help.label")}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{t("onboarding.module_help.label")}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2.5">
          {(["p1", "p2", "p3"] as const).map((k) => (
            <li key={k} className="flex gap-2.5 text-sm leading-relaxed text-foreground/85">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              {t(`onboarding.module_help.${module}.${k}`)}
            </li>
          ))}
        </ul>
        <DialogFooter className="gap-2 sm:gap-2">
          <DialogClose asChild>
            <Button variant="ghost" className="min-h-11" onClick={() => startTour("restart")}>
              {t("onboarding.module_help.restart_tour")}
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button className="min-h-11">{t("onboarding.module_help.close")}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
