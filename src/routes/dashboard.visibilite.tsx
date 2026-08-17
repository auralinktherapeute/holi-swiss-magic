import { useMemo } from "react";
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
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getMyShowcaseReport, runMyShowcaseAnalysis } from "@/lib/therapist-health.functions";
import { SHOWCASE_ACTIONS, SHOWCASE_STATUS_LABEL } from "@/lib/showcase-actions";
import { AUDIT_CATEGORY_LABEL, type AuditCategory, type AuditSeverity } from "@/lib/showcase-audit";

export const Route = createFileRoute("/dashboard/visibilite")({ component: Page });

type ReportCheck = {
  id: string;
  axis: "visibilite" | "conversion";
  category: AuditCategory;
  label: string;
  hint: string;
  weight: number;
  passed: boolean;
  severity: AuditSeverity;
  gain: number;
};

const SEVERITY_RANK: Record<AuditSeverity, number> = { critical: 0, warning: 1, info: 2 };
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
  const action = SHOWCASE_ACTIONS[check.id];
  return (
    <li className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start gap-2.5">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.cls}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {check.label}
            <span className={`ml-2 text-[11px] font-normal ${meta.cls}`}>{meta.label}</span>
          </p>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            {AUDIT_CATEGORY_LABEL[check.category]}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{check.hint}</p>
          <p className="mt-1 text-xs font-medium text-emerald-700">
            Gain potentiel estimé : +{check.gain} points
          </p>
          {action && (
            <Button asChild variant="outline" size="sm" className="mt-2 h-9 min-h-[36px] text-xs">
              <Link to={action.to}>{action.cta}</Link>
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function Page() {
  const load = useServerFn(getMyShowcaseReport);
  const rerun = useServerFn(runMyShowcaseAnalysis);
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
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

  const checks = (data?.checks ?? []) as ReportCheck[];
  const { blocking, missing, done, priority } = useMemo(() => {
    const sorter = (a: ReportCheck, b: ReportCheck) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.weight - a.weight;
    const ko = checks.filter((c) => !c.passed).sort(sorter);
    return {
      blocking: ko.filter((c) => c.severity === "critical"),
      missing: ko.filter((c) => c.severity !== "critical"),
      done: checks.filter((c) => c.passed).sort(sorter),
      priority: ko.slice(0, 3),
    };
  }, [checks]);

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
            disabled={mutation.isPending}
            className="h-11 min-h-[44px] gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${mutation.isPending ? "animate-spin" : ""}`} aria-hidden="true" />
            {mutation.isPending ? "Analyse en cours…" : "Relancer l'analyse"}
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

      <Card>
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
              {priority.map((c, i) => {
                const action = SHOWCASE_ACTIONS[c.id];
                return (
                  <li key={c.id} className="rounded-lg border border-border bg-surface p-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-xlight text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{c.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{c.hint}</p>
                        <p className="mt-1 text-xs font-medium text-emerald-700">
                          Gain potentiel estimé : +{c.gain} points
                        </p>
                        {action && (
                          <Button asChild size="sm" className="mt-2 h-9 min-h-[36px] text-xs">
                            <Link to={action.to}>{action.cta}</Link>
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

      {done.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Éléments réussis ({done.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {done.map((c) => (
                <li key={c.id} className="flex items-start gap-2.5 rounded-lg border border-border bg-surface p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{c.hint}</p>
                  </div>
                </li>
              ))}
            </ul>
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
                      <Link to={action.to}>{action.cta}</Link>
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
