// Parcours d'envoi simplifié en 4 étapes : Préparer → Vérifier → Tester → Envoyer.
// Purement visuel : il n'ajoute aucun blocage, il indique où en est l'envoi.
import { Check, Circle, Dot } from "lucide-react";
import { cn } from "@/lib/utils";

export type SendStepKey = "preparer" | "verifier" | "tester" | "envoyer";
export type SendStepState = "done" | "current" | "todo";

export const NEWSLETTER_SEND_STEPS: {
  key: SendStepKey;
  label: string;
  hint: string;
  tab: string;
}[] = [
  {
    key: "preparer",
    label: "Préparer",
    hint: "Modèle, objet, pré-header, introduction, corps et bouton.",
    tab: "email",
  },
  {
    key: "verifier",
    label: "Vérifier",
    hint: "Aperçu, segment, destinataires, expéditeur et liens — sur une seule page.",
    tab: "send",
  },
  {
    key: "tester",
    label: "Envoyer un test",
    hint: "Un email vers votre adresse. Ce n'est pas l'envoi réel.",
    tab: "send",
  },
  {
    key: "envoyer",
    label: "Envoyer la newsletter",
    hint: "Récapitulatif puis confirmation avant l'envoi via Resend.",
    tab: "send",
  },
];

const STATE_STYLES: Record<SendStepState, string> = {
  done: "border-[#4ade80]/40 bg-[#4ade80]/10 text-[#bbf7d0]",
  current: "border-[#b86ef9]/60 bg-[#b86ef9]/15 text-white",
  todo: "border-white/12 bg-white/5 text-white/60",
};

export function NewsletterSteps({
  states,
  onStepClick,
  statusLabel,
  className,
}: {
  states: Record<SendStepKey, SendStepState>;
  onStepClick?: (tab: string) => void;
  statusLabel?: string;
  className?: string;
}) {
  return (
    <section
      aria-label="Parcours d'envoi de la newsletter"
      className={cn("rounded-xl border border-white/10 bg-[#1d0d3d] p-4", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">Parcours d'envoi</h2>
        {statusLabel && <span className="text-xs text-white/60">{statusLabel}</span>}
      </div>
      <p className="mt-1 text-xs text-white/55">
        Quatre étapes. Aucun email ne part avant la confirmation finale.
      </p>

      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {NEWSLETTER_SEND_STEPS.map((step, i) => {
          const state = states[step.key];
          const Icon = state === "done" ? Check : state === "current" ? Dot : Circle;
          const label = `Étape ${i + 1} : ${step.label}. ${step.hint}`;
          const base = cn(
            "flex w-full min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-xs",
            STATE_STYLES[state],
          );
          const content = (
            <>
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/25 text-[10px] font-semibold"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span className="text-left leading-tight">{step.label}</span>
              <Icon className="ml-auto h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
            </>
          );
          return (
            <li key={step.key}>
              {onStepClick ? (
                <button
                  type="button"
                  title={step.hint}
                  aria-label={label}
                  onClick={() => onStepClick(step.tab)}
                  className={cn(
                    base,
                    "transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9]",
                  )}
                >
                  {content}
                </button>
              ) : (
                <div className={base} title={step.hint} aria-label={label}>
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
