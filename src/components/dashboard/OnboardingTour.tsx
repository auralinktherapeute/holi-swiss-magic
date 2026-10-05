import { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { completeOnboarding } from "@/lib/onboarding.functions";
import { useUpdateOnboardingProgress } from "@/hooks/use-onboarding";
import { TOUR_LENGTH } from "@/lib/onboarding-checklist";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

/** Cible mise en évidence pour chaque étape (null = bulle centrée). */
export const TOUR_TARGETS: (string | null)[] = [
  null,
  "nav-profil",
  "nav-facturation",
  "nav-agenda",
  "nav-visibilite",
  "nav-clients",
  "nav-facturation",
  "nav-help",
];

type Rect = { top: number; left: number; width: number; height: number };

function computeBubblePos(rect: Rect | null, bubbleW: number, bubbleH: number) {
  if (!rect) {
    return {
      top: Math.max(16, window.innerHeight / 2 - bubbleH / 2),
      left: Math.max(16, window.innerWidth / 2 - bubbleW / 2),
    };
  }
  const gap = 16;
  // À droite de la cible (menu latéral) : la cible n'est jamais recouverte.
  if (window.innerWidth >= 768 && rect.left + rect.width + bubbleW + gap < window.innerWidth) {
    return {
      top: Math.max(16, Math.min(window.innerHeight - bubbleH - 16, rect.top + rect.height / 2 - bubbleH / 2)),
      left: rect.left + rect.width + gap,
    };
  }
  const below = rect.top + rect.height + gap;
  const top = below + bubbleH < window.innerHeight ? below : Math.max(16, rect.top - bubbleH - gap);
  return { top, left: Math.max(16, Math.min(window.innerWidth - bubbleW - 16, rect.left)) };
}

export function OnboardingTour({
  open,
  initialStep = 0,
  onClose,
}: {
  open: boolean;
  initialStep?: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const complete = useServerFn(completeOnboarding);
  const update = useUpdateOnboardingProgress();
  const bubbleRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const target = TOUR_TARGETS[step];

  const measure = useCallback(() => {
    if (!open || !target) return setRect(null);
    const el = document.querySelector<HTMLElement>(`[data-tour-id="${target}"]`);
    const r = el?.getBoundingClientRect();
    if (!el || !r || r.width === 0 || r.height === 0) return setRect(null);
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [open, target]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    setStep(Math.min(TOUR_LENGTH - 1, Math.max(0, initialStep)));
    return () => returnFocus.current?.focus?.();
  }, [open, initialStep]);

  // Focus sur la bulle à chaque étape.
  useEffect(() => {
    if (open) bubbleRef.current?.focus();
  }, [open, step]);

  const goTo = (s: number) => {
    setStep(s);
    update.mutate({ tourStep: s });
  };

  const later = () => {
    update.mutate({ tourStep: step, tourPaused: true });
    onClose();
  };

  const quit = async () => {
    update.mutate({ tourCompleted: true });
    try {
      await complete();
    } catch {
      // Best-effort : la progression est déjà enregistrée.
    }
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      later();
      return;
    }
    if (e.key !== "Tab" || !bubbleRef.current) return;
    const f = bubbleRef.current.querySelectorAll<HTMLElement>("button:not([disabled])");
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === bubbleRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  const isLast = step === TOUR_LENGTH - 1;
  const bubbleW = Math.min(380, window.innerWidth - 32);
  const pos = computeBubblePos(rect, bubbleW, 300);
  const base = `onboarding.tour.steps.${step}`;

  return (
    <div className="fixed inset-0 z-[1000]" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-black/60 motion-safe:animate-in motion-safe:fade-in duration-200" onClick={later} aria-hidden="true" />
      {rect && (
        <div
          className="pointer-events-none absolute rounded-xl ring-4 ring-purple-400/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] motion-safe:transition-all duration-300"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      )}
      <div
        ref={bubbleRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        data-testid="onboarding-tour"
        className="absolute rounded-2xl border border-purple-400/30 bg-gradient-to-br from-[#1a0b3d] to-[#0f0728] p-5 shadow-2xl outline-none motion-safe:animate-in motion-safe:fade-in duration-300"
        style={{ top: pos.top, left: pos.left, width: bubbleW }}
      >
        <button
          type="button"
          onClick={quit}
          aria-label={t("onboarding.tour.close")}
          className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-teal-300 outline-none"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="inline-flex items-center rounded-full bg-teal-400/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-teal-300">
          {t("onboarding.tour.step_of", { current: step + 1, total: TOUR_LENGTH })}
        </span>
        <h2 id="tour-title" className="mt-2 pr-10 text-lg font-semibold text-white">
          {t(`${base}.title`)}
        </h2>
        <p id="tour-body" className="mt-2 text-sm leading-relaxed text-white/85">
          {t(`${base}.body`)}
        </p>
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/10" aria-hidden="true">
          <div
            className="h-full bg-gradient-to-r from-purple-400 to-teal-300 motion-safe:transition-all duration-300"
            style={{ width: `${((step + 1) / TOUR_LENGTH) * 100}%` }}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-x-3">
            <button type="button" onClick={quit} className="min-h-11 text-xs font-medium text-white/70 underline-offset-4 hover:text-white hover:underline focus-visible:ring-2 focus-visible:ring-teal-300 outline-none rounded">
              {t("onboarding.tour.quit")}
            </button>
            {!isLast && (
              <button type="button" onClick={later} className="min-h-11 text-xs font-medium text-white/70 underline-offset-4 hover:text-white hover:underline focus-visible:ring-2 focus-visible:ring-teal-300 outline-none rounded">
                {t("onboarding.tour.later")}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => goTo(step - 1)} className="min-h-11 text-white/85 hover:bg-white/10 hover:text-white">
                {t("onboarding.tour.back")}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => (isLast ? quit() : goTo(step + 1))}
              className="min-h-11 bg-gradient-to-r from-purple-500 to-teal-400 text-white hover:opacity-90"
            >
              {isLast ? t("onboarding.tour.finish") : t(`${base}.next`)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
