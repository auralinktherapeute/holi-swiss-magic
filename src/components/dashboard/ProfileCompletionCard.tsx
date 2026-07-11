import { CheckCircle2, Circle, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { computeProfileCompletion, type CompletionInput } from "@/lib/profile-completion";

/**
 * Carte « Profil complété à X % » — se met à jour en direct pendant
 * l'édition du profil et liste les actions restantes les plus rentables.
 * Un profil complet = une fiche publique plus riche = meilleur SEO/GEO.
 */
export function ProfileCompletionCard({ profile }: { profile: CompletionInput }) {
  const { percent, missing } = computeProfileCompletion(profile);
  const done = percent >= 100;

  const tone =
    percent >= 80 ? "text-emerald-300" : percent >= 50 ? "text-orange-300" : "text-red-300";

  return (
    <Card className="border-[rgba(184,110,249,0.25)] bg-[#2d1248]/70">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#b86ef9]" aria-hidden />
            <h2 className="text-sm font-semibold text-foreground">Visibilité de votre profil</h2>
          </div>
          <span className={`text-lg font-bold ${tone}`}>{percent} %</span>
        </div>

        <Progress value={percent} className="mt-3 h-2" />
        <p className="mt-2 text-xs text-muted-foreground">
          {done
            ? "Excellent — votre profil est complet et optimisé pour Google et les moteurs IA."
            : "Un profil complet apparaît mieux dans les recherches Google et les recommandations des IA."}
        </p>

        {!done && (
          <ul className="mt-4 space-y-1.5">
            {missing.slice(0, 4).map((item) => (
              <li key={item.key} className="flex items-center gap-2 text-xs text-foreground/85">
                <Circle className="h-3 w-3 shrink-0 text-[#b86ef9]/60" aria-hidden />
                {item.label}
                <span className="ml-auto shrink-0 text-[10px] font-semibold text-[#5cc8fa]">+{item.weight} %</span>
              </li>
            ))}
            {missing.length > 4 && (
              <li className="text-[11px] text-muted-foreground">…et {missing.length - 4} autre(s) action(s)</li>
            )}
          </ul>
        )}

        {done && (
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Toutes les sections sont remplies
          </div>
        )}
      </CardContent>
    </Card>
  );
}
