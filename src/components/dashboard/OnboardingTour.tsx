import { useEffect, useLayoutEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { completeOnboarding } from "@/lib/onboarding.functions";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export type TourStep = {
  target: string | null; // data-tour-id or null for centered welcome/final
  title: string;
  body: string;
};

const STEPS: TourStep[] = [
  {
    target: null,
    title: "Bienvenue sur Holiswiss 👋",
    body:
      "Holiswiss met en relation clients et thérapeutes, et vous permet de gérer toute votre activité : agenda, réservations, forfaits, facturation QR suisse et CRM. Ce tour rapide vous montre les fonctionnalités clés en 2 minutes.",
  },
  {
    target: "nav-profil",
    title: "Mon profil",
    body:
      "Complétez votre bio, vos spécialités, vos langues parlées et vos coordonnées de facturation (IBAN, adresse). Ces informations sont indispensables pour être visible et pouvoir émettre des factures.",
  },
  {
    target: "nav-agenda",
    title: "Agenda",
    body:
      "Définissez vos disponibilités hebdomadaires, ajoutez des créneaux ponctuels ou bloquez des périodes de congés. Vos clients ne pourront réserver que sur les créneaux ouverts.",
  },
  {
    target: "nav-forfaits",
    title: "Forfaits",
    body:
      "Créez des forfaits de séances (par ex. 5 séances pour 400 CHF), avec durée de validité. Les clients peuvent les acheter et vous suivez automatiquement leur consommation.",
  },
  {
    target: "nav-questionnaires",
    title: "Questionnaires",
    body:
      "Créez des questionnaires (bilan initial, suivi…) et attribuez-les à une séance ou un forfait. Les réponses sont archivées dans la fiche client.",
  },
  {
    target: "nav-reservations",
    title: "Réservations",
    body:
      "Consultez les demandes de rendez-vous entrantes, confirmez-les ou annulez-les. Un compteur en haut du menu indique les demandes en attente.",
  },
  {
    target: "nav-crm",
    title: "CRM Elite",
    body:
      "Retrouvez l'historique complet de chaque client : rendez-vous, réponses aux questionnaires, forfaits en cours, notes de séance et relances.",
  },
  {
    target: "nav-facturation",
    title: "Facturation",
    body:
      "Les factures QR suisses se génèrent automatiquement après un rendez-vous marqué « réalisé ». Configurez d'abord votre IBAN et vos coordonnées dans les réglages de facturation.",
  },
  {
    target: null,
    title: "C'est parti ! 🚀",
    body:
      "Vous êtes prêt à recevoir vos premiers clients. Une checklist de démarrage vous accompagne sur le tableau de bord — vous pouvez relancer ce tutoriel à tout moment depuis l'icône ? dans le menu.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

function computeBubblePos(rect: Rect | null, bubbleW: number, bubbleH: number): { top: number; left: number; arrow: "left" | "top" } {
  if (!rect) {
    return {
      top: Math.max(24, window.innerHeight / 2 - bubbleH / 2),
      left: Math.max(24, window.innerWidth / 2 - bubbleW / 2),
      arrow: "top",
    };
  }
  // Prefer to the right of the target (desktop sidebar)
  const padding = 16;
  if (window.innerWidth >= 768 && rect.left + rect.width + bubbleW + padding < window.innerWidth) {
    return {
      top: Math.max(16, Math.min(window.innerHeight - bubbleH - 16, rect.top + rect.height / 2 - bubbleH / 2)),
      left: rect.left + rect.width + padding,
      arrow: "left",
    };
  }
  // Fallback: below
  return {
    top: Math.min(window.innerHeight - bubbleH - 16, rect.top + rect.height + padding),
    left: Math.max(16, Math.min(window.innerWidth - bubbleW - 16, rect.left)),
    arrow: "top",
  };
}

export function OnboardingTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const complete = useServerFn(completeOnboarding);

  const current = STEPS[step];

  const measure = useCallback(() => {
    if (!open) return;
    if (!current?.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-tour-id="${current.target}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    // Scroll target into view (mostly for mobile)
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open, current]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  if (!open) return null;

  const finish = async () => {
    try {
      await complete();
    } catch {}
    onClose();
  };

  const skip = async () => {
    await finish();
  };

  const next = async () => {
    if (step >= STEPS.length - 1) {
      await finish();
    } else {
      setStep((s) => s + 1);
    }
  };

  const bubbleW = Math.min(360, window.innerWidth - 32);
  const bubbleH = 260;
  const pos = computeBubblePos(rect, bubbleW, bubbleH);
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {/* Dimmed backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200" onClick={skip} />

      {/* Highlight ring around target */}
      {rect && (
        <div
          className="absolute rounded-xl ring-4 ring-purple-400/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] pointer-events-none transition-all duration-300"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}

      {/* Bubble */}
      <div
        className="absolute rounded-2xl border border-purple-400/30 bg-gradient-to-br from-[#1a0b3d] to-[#0f0728] p-5 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300"
        style={{ top: pos.top, left: pos.left, width: bubbleW }}
      >
        <button
          type="button"
          onClick={skip}
          aria-label="Passer le tour"
          className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-teal-400/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-teal-300">
            {step + 1}/{STEPS.length}
          </span>
        </div>
        <h2 id="tour-title" className="text-lg font-semibold text-white pr-8">
          {current.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/80">{current.body}</p>

        {/* Progress bar */}
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-purple-400 to-teal-300 transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={skip}
            className="text-xs font-medium text-white/60 underline-offset-4 hover:text-white hover:underline"
          >
            Passer le tour
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && !isLast && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                Retour
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={next}
              className="bg-gradient-to-r from-purple-500 to-teal-400 text-white hover:opacity-90"
            >
              {isLast ? "Terminer" : "Suivant"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}