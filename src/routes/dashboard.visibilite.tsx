import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Info,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldAlert,
} from "lucide-react";
import { ChevronDown, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getMyShowcaseReport, runMyShowcaseAnalysis } from "@/lib/therapist-health.functions";
import { SHOWCASE_ACTIONS, SHOWCASE_STATUS_LABEL } from "@/lib/showcase-actions";
import type { Recommendation } from "@/lib/showcase-recommendations";
import { type AuditSeverity } from "@/lib/showcase-audit";
import type { ReportCheck, ShowcaseAuditReport } from "@/lib/showcase-report";

export const Route = createFileRoute("/dashboard/visibilite")({ component: Page });

const STATUS_LABEL: Record<ReportCheck["status"], string> = {
  passed: "Validé",
  missing: "Manquant",
  invalid: "À corriger",
  pending: "En attente de validation",
  blocked: "Bloqué",
};
const SEVERITY_META: Record<AuditSeverity, { label: string; cls: string; icon: typeof AlertTriangle }> = {
  critical: { label: "Bloquant", cls: "text-red-600", icon: ShieldAlert },
  warning: { label: "Important", cls: "text-amber-600", icon: AlertTriangle },
  info: { label: "Recommandé", cls: "text-sky-600", icon: Info },
};

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ScoreGauge({ score, status }: { score: number; status: string }) {
  const r = 66;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * c;
  const color = score >= 85 ? "#059669" : score >= 70 ? "#0d9488" : score >= 50 ? "#d97706" : "#dc2626";
  return (
    <div
      role="img"
      aria-label={`Score de visibilité : ${score} sur 100. Statut : ${status}.`}
      className="relative shrink-0"
    >
      <svg width="168" height="168" viewBox="0 0 168 168" aria-hidden="true">
        <circle cx="84" cy="84" r={r} fill="none" stroke="currentColor" strokeWidth="14" className="text-muted" />
        <circle
          cx="84"
          cy="84"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform="rotate(-90 84 84)"
          style={{ transition: "stroke-dasharray 300ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-foreground">{score}</span>
        <span className="text-xs text-muted-foreground">sur 100</span>
      </div>
    </div>
  );
}

function CategoryBar({ label, hint, value }: { label: string; hint: string; value: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-semibold">{value}/100</span>
      </div>
      <Progress value={value} className="mt-2 h-2" aria-label={`${label} : ${value} sur 100`} />
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function CheckRow({ check }: { check: ReportCheck }) {
  const meta = SEVERITY_META[check.severity];
  const Icon = meta.icon;
  return (
    <li className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start gap-2.5">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.cls}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {check.label}
            <span className={`ml-2 text-[11px] font-normal ${meta.cls}`}>{meta.label}</span>
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-foreground/70">
              {STATUS_LABEL[check.status]}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            {check.categoryLabel}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{check.explanation}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Attendu : {check.expectedValueSummary}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Actuel : {check.currentValueSummary}
          </p>
          <p className="mt-1 text-xs font-medium text-emerald-700">
            Gain potentiel estimé : +{check.points} points
          </p>
          {check.actionHref && (
            <Button asChild variant="outline" size="sm" className="mt-2 h-9 min-h-[36px] text-xs">
              <a href={check.actionHref}>{check.actionLabel}</a>
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

const IMPORTANCE_STYLE: Record<string, string> = {
  essentiel: "border-red-200 bg-red-50 text-red-700",
  important: "border-amber-200 bg-amber-50 text-amber-700",
  conseille: "border-sky-200 bg-sky-50 text-sky-700",
};

/** Ordre d'affichage prioritaire des éléments validés. */
const VALIDATED_ORDER = [
  "identity",
  "meta_title",
  "meta_description",
  "photo",
  "city",
  "canton",
  "address",
  "geo_consistency",
  "languages",
  "canton_language",
  "services",
  "durations",
  "price",
  "availability",
  "availability_fresh",
  "credentials",
  "ide_verified",
  "structured_data",
];

function ValidatedRow({ check }: { check: ReportCheck }) {
  const action = SHOWCASE_ACTIONS[check.id];
  return (
    <li className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
      <div className="flex items-start gap-2.5">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {check.label}
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-normal text-emerald-800">
              Validé
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{check.explanation}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Actuel : {check.currentValueSummary}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Dernière vérification : {formatDate(check.evaluatedAt)}
            {check.resolvedAt ? ` · Validé depuis le ${formatDate(check.resolvedAt)}` : ""}
          </p>
          {action && (
            <Button asChild variant="outline" size="sm" className="mt-2 h-9 min-h-[36px] gap-1.5 text-xs">
              <Link to={action.to} hash={action.hash}>
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Modifier cet élément
              </Link>
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function RecommendationCard({ reco }: { reco: Recommendation }) {
  const resolved = reco.status === "resolu";
  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${IMPORTANCE_STYLE[reco.importance]}`}
        >
          {reco.importanceLabel}
        </span>
        <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
          {reco.categoryLabel}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            resolved ? "bg-emerald-50 text-emerald-700" : "bg-muted text-foreground/70"
          }`}
        >
          {resolved ? (
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          )}
          {resolved ? "Résolu" : "À traiter"}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold">{reco.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{reco.explanation}</p>
      <p className={`mt-2 text-xs font-medium ${resolved ? "text-muted-foreground" : "text-emerald-700"}`}>
        {resolved
          ? `Acquis : ${reco.gain} point${reco.gain > 1 ? "s" : ""} sur votre score`
          : `Gain possible : +${reco.gain} point${reco.gain > 1 ? "s" : ""}`}
      </p>
      {resolved && reco.resolvedAt && (
        <p className="mt-1 text-xs text-muted-foreground">Résolu le {formatDate(reco.resolvedAt)}</p>
      )}
      {reco.action && (
        <Button asChild size="sm" variant="outline" className="mt-3 h-9 min-h-[36px] text-xs">
          <Link to={reco.action.to} hash={reco.action.hash}>{reco.action.cta}</Link>
        </Button>
      )}
    </li>
  );
}

function Page() {
  const load = useServerFn(getMyShowcaseReport);
  const rerun = useServerFn(runMyShowcaseAnalysis);
  const qc = useQueryClient();

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["my-showcase-report"],
    queryFn: () => load(),
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: () => rerun(),
    onSuccess: (res) => {
      qc.setQueryData(["my-showcase-report"], res);
      qc.invalidateQueries({ queryKey: ["my-showcase-audit"] });
      toast.success("Analyse relancée.");
    },
    onError: () => toast.error("L'analyse n'a pas pu être relancée. Réessayez dans un instant."),
  });

  const recalculating = mutation.isPending || (isFetching && !isLoading);
  const recalcFailed = mutation.isError && !mutation.isPending;

  // Source unique : tout provient de l'objet d'audit renvoyé par le serveur.
  // Aucune reconstruction ici.
  const report = (data?.report ?? null) as ShowcaseAuditReport | null;
  const checks: ReportCheck[] = report
    ? [...report.visibility.checks, ...report.conversion.checks]
    : [];
  const recommendations: Recommendation[] = report
    ? [...report.visibility.recommendations, ...report.conversion.recommendations]
    : [];
  const todo = recommendations.filter((r) => r.status === "a_traiter");
  const resolved = recommendations.filter((r) => r.status === "resolu");
  const blocking = report ? [...report.visibility.blocking, ...report.conversion.blocking] : [];
  const blockingIds = new Set(blocking.map((c) => c.id));
  const missing = report ? report.missingItems.filter((c) => !blockingIds.has(c.id)) : [];
  const done = checks.filter((c) => c.status === "passed");
  const validated = [...done].sort((a, b) => {
    const ia = VALIDATED_ORDER.indexOf(a.id);
    const ib = VALIDATED_ORDER.indexOf(b.id);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || b.weight - a.weight;
  });
  const priority = report?.priorityActions ?? [];

  if (isLoading) {
    return (
      <div className="p-6 md:p-10">
        <div className="h-6 w-64 animate-pulse rounded bg-muted" />
        <div className="mt-6 h-48 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6 md:p-10">
        <h1 className="text-2xl font-bold">Score de visibilité</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Votre fiche n'est pas encore accessible. Complétez d'abord votre profil.
        </p>
        <Button asChild className="mt-4">
          <Link to="/dashboard/profil">Compléter mon profil</Link>
        </Button>
      </div>
    );
  }

  const status = SHOWCASE_STATUS_LABEL[data.status] ?? SHOWCASE_STATUS_LABEL.a_renforcer;
  const delta = data.delta;
  const DeltaIcon = delta == null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const deltaCls = delta == null || delta === 0 ? "text-muted-foreground" : delta > 0 ? "text-emerald-700" : "text-red-600";

  return (
    <div className="space-y-6 p-6 md:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Visibilité de ma vitrine</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Qualité et préparation de votre fiche publique à l'indexation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => mutation.mutate()}
            disabled={recalculating}
            className="h-11 min-h-[44px] gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${recalculating ? "animate-spin" : ""}`} aria-hidden="true" />
            {recalculating ? "Analyse en cours…" : recalcFailed ? "Réessayer l'analyse" : "Relancer l'analyse"}
          </Button>
          {data.slug && (
            <Button asChild variant="outline" className="h-11 min-h-[44px] gap-2">
              <a href={`/fr/therapeute/${data.slug}`} target="_blank" rel="noopener noreferrer">
                Voir ma fiche
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          )}
        </div>
      </header>

      {recalculating && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm"
        >
          <RefreshCw className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
          <span className="font-medium">Analyse en cours…</span>
          <span className="text-muted-foreground">
            Le résultat affiché ci-dessous date du {formatDate(data.analyzedAt)} et est temporairement obsolète.
          </span>
        </div>
      )}

      {recalcFailed && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">L'analyse n'a pas pu être relancée.</span>
          <span>
            Aucun score n'a été modifié : les résultats et recommandations ci-dessous restent ceux de l'analyse du{" "}
            {formatDate(data.analyzedAt)}.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-9 min-h-[36px] border-red-300 text-xs text-red-700"
            onClick={() => mutation.mutate()}
          >
            Réessayer l'analyse
          </Button>
        </div>
      )}

      <Card className={recalculating ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={recalculating}>
        <CardContent className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start">
          <ScoreGauge score={data.score} status={status.label} />
          <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-sm font-semibold">
                {status.label}
              </span>
              <span className={`inline-flex items-center gap-1 text-sm font-medium ${deltaCls}`}>
                <DeltaIcon className="h-4 w-4" aria-hidden="true" />
                {delta == null
                  ? "Première analyse"
                  : delta === 0
                    ? "Stable depuis la dernière analyse"
                    : `${delta > 0 ? "+" : ""}${delta} points depuis la dernière analyse`}
              </span>
            </div>
            <p className="text-sm text-foreground/80">
              Votre score est de {data.score}/100. {status.message}
            </p>
            <p className="text-xs text-muted-foreground">
              Dernière analyse : {formatDate(data.analyzedAt)}
              {data.previousAt ? ` · Analyse précédente : ${formatDate(data.previousAt)} (${data.previousScore}/100)` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {data.basic.completed} élément{data.basic.completed > 1 ? "s" : ""} validé
              {data.basic.completed > 1 ? "s" : ""} sur {data.basic.total} contrôles.
            </p>
          </div>
        </CardContent>
      </Card>

      {data.categories && data.categories.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Catégories de score</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            {data.categories.map((cat) => (
              <CategoryBar
                key={cat.id}
                label={cat.label}
                hint={`${cat.hint} — ${cat.passed}/${cat.total} critères validés.`}
                value={cat.score}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {priority.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Actions prioritaires</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {priority.map((a) => {
                return (
                  <li key={a.checkId} className="rounded-lg border border-border bg-surface p-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-xlight text-xs font-bold text-primary">
                        {a.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{a.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{a.explanation}</p>
                        <p className="mt-1 text-xs font-medium text-emerald-700">
                          Gain potentiel estimé : +{a.points} points
                        </p>
                        {a.actionHref && (
                          <Button asChild size="sm" className="mt-2 h-9 min-h-[36px] text-xs">
                            <a href={a.actionHref}>{a.actionLabel}</a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}

      {recommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recommandations ({todo.length} à traiter)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {todo.length > 0 ? (
              <ul className="space-y-3">
                {todo.map((r) => (
                  <RecommendationCard key={r.id} reco={r} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucune recommandation en attente : votre vitrine couvre tous les points contrôlés.
              </p>
            )}
            {resolved.length > 0 && (
              <details className="rounded-lg border border-border bg-surface p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Points déjà résolus ({resolved.length})
                </summary>
                <ul className="mt-3 space-y-3">
                  {resolved.map((r) => (
                    <RecommendationCard key={r.id} reco={r} />
                  ))}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {blocking.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-red-600" aria-hidden="true" />
              Éléments bloquants ({blocking.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {blocking.map((c) => (
                <CheckRow key={c.id} check={c} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {missing.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Éléments manquants ({missing.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {missing.map((c) => (
                <CheckRow key={c.id} check={c} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {validated.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <details className="group" open>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 min-h-[44px] rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex items-center gap-2 text-base font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  Éléments validés ({validated.length})
                </span>
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="px-4 pb-4">
                <p className="mb-3 text-xs text-muted-foreground">
                  Ces points sont conformes : ils n'apparaissent pas dans les éléments manquants. Vous
                  pouvez les modifier à tout moment sans perdre les points acquis.
                </p>
                <ul className="space-y-2">
                  {validated.map((c) => (
                    <ValidatedRow key={c.id} check={c} />
                  ))}
                </ul>
              </div>
            </details>
          </CardContent>
        </Card>
      )}

      {checks.length === 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Essentiels à compléter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.basic.essentials.map((e) => {
              const action = SHOWCASE_ACTIONS[e.id];
              return (
                <div key={e.id} className="rounded-lg border border-border bg-surface p-3">
                  <p className="text-sm font-medium">{e.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{e.hint}</p>
                  {action && (
                    <Button asChild size="sm" variant="outline" className="mt-2 h-9 min-h-[36px] text-xs">
                      <Link to={action.to} hash={action.hash}>{action.cta}</Link>
                    </Button>
                  )}
                </div>
              );
            })}
            {data.basic.recommendations.map((r) => (
              <p key={r} className="text-xs text-muted-foreground">{r}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="rounded-lg border border-border bg-surface p-4 text-xs leading-relaxed text-muted-foreground">
        Ce score mesure la qualité et la préparation de votre vitrine pour la visibilité. Il ne
        garantit pas une position dans Google ni une recommandation par une IA.
      </p>
    </div>
  );
}
