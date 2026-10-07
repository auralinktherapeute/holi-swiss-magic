import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Circle, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getMyShowcaseReport } from "@/lib/therapist-health.functions";
import type { ShowcaseAuditReport } from "@/lib/showcase-report";

/**
 * Carte « Qualité de ma fiche » de l'écran Profil.
 * Score unique : celui de la vitrine (même requête que /dashboard/visibilite),
 * recalculé côté serveur après chaque enregistrement (`refreshShowcaseAfterSave`).
 * L'ancienne formule locale concurrente a été retirée.
 * La prop `profile` est conservée pour compatibilité d'appel ; elle n'est plus utilisée.
 */
export function ProfileCompletionCard(_props: { profile?: unknown }) {
  const load = useServerFn(getMyShowcaseReport);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-showcase-report"],
    queryFn: () => load(),
    staleTime: 60_000,
  });

  const report = (data?.report ?? null) as ShowcaseAuditReport | null;
  const score = typeof data?.score === "number" ? data.score : null;
  const actions = report?.priorityActions ?? [];

  return (
    <Card className="border-[rgba(184,110,249,0.25)] bg-[#2d1248]/70">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#b86ef9]" aria-hidden />
            <h2 className="text-sm font-semibold text-foreground">
              Qualité de ma fiche (score vitrine)
            </h2>
          </div>
          <span className="text-lg font-bold text-foreground">
            {isLoading ? "…" : score == null ? "Donnée indisponible" : `${score} / 100`}
          </span>
        </div>
        {score != null && <Progress value={score} className="mt-3 h-2" />}
        <p className="mt-2 text-xs text-muted-foreground">
          {isError
            ? "Le score n'a pas pu être chargé."
            : "La qualité de la fiche aide les moteurs à la comprendre, sans garantir ni indexation, ni position Google, ni recommandation par une IA. Mis à jour après chaque enregistrement."}
        </p>
        {actions.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {actions.slice(0, 4).map((a) => (
              <li key={a.checkId} className="flex items-center gap-2 text-xs text-foreground/85">
                <Circle className="h-3 w-3 shrink-0 text-[#b86ef9]/60" aria-hidden />
                {a.label}
                <span className="ml-auto shrink-0 text-[10px] font-semibold text-[#5cc8fa]">
                  +{a.points} pts
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link
          to="/dashboard/visibilite"
          className="mt-3 inline-block text-xs font-medium underline underline-offset-2"
        >
          Voir le détail de ma vitrine
        </Link>
      </CardContent>
    </Card>
  );
}
