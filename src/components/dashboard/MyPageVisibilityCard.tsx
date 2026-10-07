import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Circle, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyPageIndexStatus } from "@/lib/indexation-dashboard.functions";
import type { ReportCheck } from "@/lib/showcase-report";

/** Contrôles déjà calculés par le score vitrine, présentés comme indicateurs vérifiables. */
const AI_INDICATORS: { id: string; label: string }[] = [
  { id: "indexable", label: "Page accessible aux robots (pas de blocage)" },
  { id: "structured_data", label: "Données structurées présentes" },
  { id: "localized_version", label: "Version traduite réellement complète" },
  { id: "profile_fresh", label: "Fiche mise à jour récemment" },
  { id: "articles", label: "Article publié relié à votre fiche" },
];

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-CH") : null);

function Row({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

export function MyPageVisibilityCard({ checks }: { checks: ReportCheck[] }) {
  const load = useServerFn(getMyPageIndexStatus);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-page-index-status"],
    queryFn: () => load(),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const page = data?.page;
  const scValue = isLoading
    ? "Chargement…"
    : isError || !page
      ? "Donnée indisponible"
      : page.label;
  const scNote = isError || !page
    ? "Le suivi Search Console n'a pas pu être lu."
    : `${page.explanation} ${page.lastCheckedAt ? `Mesure du ${fmt(page.lastCheckedAt)}.` : "Aucune date de mesure."}${page.stale ? " Mesure de plus de 30 jours." : ""}`;

  const byId = new Map(checks.map((c) => [c.id, c]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ma page publique</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Row
            title="Publication de la fiche"
            value={isLoading ? "Chargement…" : data == null ? "Donnée indisponible" : data.published ? "Publiée" : "Non publiée"}
          />
          <Row
            title="Validation administrative"
            value={isLoading ? "Chargement…" : data == null ? "Donnée indisponible" : data.adminValidated ? "Contrôle Holiswiss effectué" : "Pas encore effectuée"}
            note="Contrôle du nom et des coordonnées, puis échange téléphonique. Ce n'est pas une certification."
          />
          <Row title="État Search Console (Google)" value={scValue} note={scNote} />
          <Row
            title="Complétude de la fiche"
            value="Voir le score vitrine ci-dessous"
            note="Le score ne mesure pas l'indexation et ne garantit aucune position."
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Une soumission aux moteurs (IndexNow) ne vaut jamais indexation : seul Search Console la constate.
        </p>

        <div>
          <h3 className="text-sm font-semibold">Visibilité IA — indicateurs vérifiables</h3>
          <p className="text-xs text-muted-foreground">
            Calculés à partir de votre fiche. Aucun classement ou trafic d'IA n'est mesuré ici.
          </p>
          <ul className="mt-2 space-y-1.5">
            {AI_INDICATORS.map(({ id, label }) => {
              const c = byId.get(id);
              const Icon = !c ? HelpCircle : c.status === "passed" ? CheckCircle2 : Circle;
              const state = !c ? "Donnée indisponible" : c.status === "passed" ? "Oui" : "Non";
              return (
                <li key={id} className="flex items-center gap-2 text-sm">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="flex-1">{label}</span>
                  <span className="text-xs font-medium">{state}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
