import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getOnboardingState } from "@/lib/onboarding.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Circle, ChevronRight, ArrowRight } from "lucide-react";

type Item = {
  key: keyof Await["checklist"];
  label: string;
  to: string;
  /** Phrase d'accompagnement quand c'est l'étape suivante à faire. */
  hint: string;
  /** Libellé du bouton d'action quand c'est l'étape suivante. */
  cta: string;
  optional?: boolean;
};
type Await = Awaited<ReturnType<typeof getOnboardingState>>;

const ITEMS: Item[] = [
  {
    key: "profileComplete",
    label: "Profil complété (bio, spécialités, IBAN, adresse)",
    to: "/dashboard/profil",
    hint: "Votre bio et vos spécialités sont ce qui pèse le plus sur votre visibilité.",
    cta: "Compléter mon profil",
  },
  {
    key: "availabilitySet",
    label: "Disponibilités définies dans l'agenda",
    to: "/dashboard/agenda",
    hint: "Sans créneaux ouverts, personne ne peut encore réserver avec vous.",
    cta: "Ouvrir mon agenda",
  },
  {
    key: "packageCreated",
    label: "Au moins une séance ou un forfait créé",
    to: "/dashboard/forfaits",
    hint: "Une séance décrite et tarifée, et votre fiche devient réservable.",
    cta: "Créer une séance",
  },
  {
    key: "questionnaireCreated",
    label: "Au moins un questionnaire créé (optionnel)",
    to: "/dashboard/questionnaires",
    hint: "Facultatif : un questionnaire d'accueil vous fait gagner du temps en séance.",
    cta: "Créer un questionnaire",
    optional: true,
  },
  {
    key: "firstReservation",
    label: "Première réservation reçue",
    to: "/dashboard/reservations",
    hint: "Tout est prêt de votre côté : cette étape se validera d'elle-même.",
    cta: "Voir mes réservations",
  },
];

/**
 * Carte d'accueil du démarrage — direction « Chaleureux ».
 *
 * Elle ne se contente pas d'afficher un état : elle nomme la prochaine étape
 * et y conduit. La liste complète reste dessous, mais on n'a plus à la
 * parcourir pour savoir quoi faire.
 *
 * Les libellés sont en français, comme ils l'étaient déjà : cette zone du
 * tableau de bord n'a jamais été traduite en de/it/en.
 */
export function OnboardingChecklist() {
  const fetchState = useServerFn(getOnboardingState);
  const { data } = useQuery({
    queryKey: ["onboarding-state"],
    queryFn: () => fetchState(),
    staleTime: 30_000,
  });

  if (!data) return null;
  const done = ITEMS.filter((i) => data.checklist[i.key]).length;
  const total = ITEMS.length;
  if (done === total) return null;

  const next = ITEMS.find((i) => !data.checklist[i.key]);
  const remaining = total - done;

  return (
    <Card
      className="relative overflow-hidden rounded-2xl border-border backdrop-blur-sm"
      style={{ background: "var(--holi-wash)" }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-medium text-foreground/90">Checklist de démarrage</CardTitle>
          <span className="rounded-full border border-border bg-primary-xlight px-2.5 py-0.5 text-xs font-medium tabular-nums text-primary-light">
            {done} sur {total}
          </span>
        </div>

        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`Progression du démarrage : ${done} sur ${total}`}
        >
          <div
            className="h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${(done / total) * 100}%`, background: "var(--holi-gradient-btn)" }}
          />
        </div>
      </CardHeader>

      {next && (
        <CardContent className="pb-4 pt-0">
          <p className="text-sm leading-relaxed text-foreground/85">
            <span className="font-medium">
              {remaining === 1 ? "Plus qu'une étape." : `Il vous reste ${remaining} étapes.`}
            </span>{" "}
            {next.hint}
          </p>
          <Button asChild size="sm" className="holi-cta mt-3.5 rounded-xl">
            <Link to={next.to}>
              {next.cta}
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      )}

      <CardContent className="space-y-1.5 pt-0">
        {ITEMS.map((item) => {
          const isDone = data.checklist[item.key];
          return (
            <Link
              key={item.key}
              to={item.to}
              className="group flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 outline-none transition-colors duration-200 ease-out hover:bg-primary-xlight focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  isDone ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
              </div>
              <span
                className={`flex-1 text-sm ${
                  isDone ? "text-muted-foreground line-through" : "text-foreground/90"
                }`}
              >
                {item.label}
                {item.optional && !isDone && (
                  <span className="ml-1.5 text-[11px] text-muted-foreground">(non bloquant)</span>
                )}
              </span>
              {!isDone && (
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none" />
              )}
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
