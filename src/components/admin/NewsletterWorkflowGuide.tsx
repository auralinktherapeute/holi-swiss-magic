// Parcours de publication d'une newsletter — 13 étapes, de la suggestion à l'envoi Resend.
// Sert de repère visuel : chaque étape indique si elle est faite, en cours ou à venir.
import { Check, Circle, Dot } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkflowStepKey =
  | "suggestion"
  | "brief"
  | "completer"
  | "rediger"
  | "editeur"
  | "apercu_email"
  | "apercu_ressource"
  | "checklist"
  | "test"
  | "controle"
  | "approbation"
  | "segment"
  | "confirmation"
  | "envoi";

export type WorkflowStepState = "done" | "current" | "todo";

export const NEWSLETTER_WORKFLOW_STEPS: {
  key: WorkflowStepKey;
  label: string;
  hint: string;
  tab?: string;
}[] = [
  {
    key: "suggestion",
    label: "Suggestion",
    hint: "Une idée de sujet, proposée automatiquement ou saisie à la main.",
  },
  {
    key: "brief",
    label: "Créer un brief",
    hint: "La suggestion devient une newsletter en préparation.",
    tab: "brief",
  },
  {
    key: "completer",
    label: "Compléter le brief",
    hint: "Titre, pilier, audience, objectif, fonctionnalité mise en avant.",
    tab: "brief",
  },
  {
    key: "rediger",
    label: "Générer ou rédiger",
    hint: "Rédaction du contenu email et de la page ressource.",
    tab: "email",
  },
  {
    key: "editeur",
    label: "Ouvrir l'éditeur",
    hint: "Objet, pré-header, intro, corps, bouton, pied de page.",
    tab: "email",
  },
  {
    key: "apercu_email",
    label: "Prévisualiser l'email",
    hint: "Rendu desktop, mobile et version texte brut.",
    tab: "send",
  },
  {
    key: "apercu_ressource",
    label: "Prévisualiser la page ressource",
    hint: "La page publique liée doit être publiée avant l'envoi.",
    tab: "resource",
  },
  {
    key: "checklist",
    label: "Vérifier la checklist",
    hint: "Tous les points de contrôle qualité doivent être cochés.",
    tab: "qc",
  },
  {
    key: "test",
    label: "Envoyer un email de test",
    hint: "Un envoi réel vers une seule adresse, journalisé séparément.",
    tab: "send",
  },
  {
    key: "controle",
    label: "Contrôler le rendu",
    hint: "Lecture du test reçu : liens, images, affichage mobile.",
    tab: "send",
  },
  {
    key: "approbation",
    label: "Approuver",
    hint: "Passage au statut « Approuvée » : l'envoi devient possible.",
    tab: "qc",
  },
  {
    key: "segment",
    label: "Vérifier le segment",
    hint: "Destinataires consentants, exclusions, nombre de contacts.",
    tab: "send",
  },
  {
    key: "confirmation",
    label: "Confirmer l'envoi",
    hint: "Écran récapitulatif en quatre blocs, puis confirmation finale.",
    tab: "send",
  },
  {
    key: "envoi",
    label: "Envoyer via Resend",
    hint: "Envoi par lots, journalisé destinataire par destinataire.",
    tab: "send",
  },
];

type Props = {
  /** État de chaque étape. Absent = guide purement informatif. */
  states?: Partial<Record<WorkflowStepKey, WorkflowStepState>>;
  /** Rend les étapes cliquables pour rejoindre l'onglet correspondant. */
  onStepClick?: (tab: string) => void;
  className?: string;
};

const STATE_STYLES: Record<WorkflowStepState, string> = {
  done: "border-[#4ade80]/40 bg-[#4ade80]/10 text-[#bbf7d0]",
  current: "border-[#b86ef9]/60 bg-[#b86ef9]/15 text-white",
  todo: "border-white/12 bg-white/5 text-white/60",
};

export function NewsletterWorkflowGuide({ states, onStepClick, className }: Props) {
  return (
    <section
      aria-label="Parcours de publication d'une newsletter"
      className={cn("rounded-xl border border-white/10 bg-[#1d0d3d] p-4", className)}
    >
      <h2 className="text-sm font-semibold text-white">Parcours de publication</h2>
      <p className="mt-1 text-xs text-white/55">
        Treize étapes, de l'idée à l'envoi. Aucun email ne part avant la confirmation finale.
      </p>

      <ol className="mt-4 flex flex-wrap gap-2">
        {NEWSLETTER_WORKFLOW_STEPS.map((step, i) => {
          const state: WorkflowStepState = states?.[step.key] ?? "todo";
          const clickable = Boolean(onStepClick && step.tab);
          const Icon = state === "done" ? Check : state === "current" ? Dot : Circle;
          const content = (
            <>
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/25 text-[10px] font-semibold"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span className="text-left leading-tight">{step.label}</span>
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
            </>
          );
          const label = `Étape ${i + 1} : ${step.label}. ${step.hint} ${
            state === "done"
              ? "Étape terminée."
              : state === "current"
                ? "Étape en cours."
                : "Étape à venir."
          }`;
          const base = cn(
            "flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-xs",
            STATE_STYLES[state],
          );

          return (
            <li key={step.key} className="max-w-full">
              {clickable ? (
                <button
                  type="button"
                  title={step.hint}
                  aria-label={label}
                  onClick={() => onStepClick?.(step.tab!)}
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
