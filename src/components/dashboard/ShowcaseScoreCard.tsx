import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, AlertTriangle, Info, ChevronDown, Gauge, ArrowUpRight, RefreshCw, Lock, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { auditMyShowcase } from "@/lib/therapist-health.functions";
import type { AuditCheck, AuditSeverity } from "@/lib/showcase-audit";

/** Où corriger chaque point manquant, dans le tableau de bord. */
const ACTIONS: Record<string, { to: string; cta: string }> = {
  bio_length: { to: "/dashboard/profil", cta: "Compléter ma biographie" },
  short_bio: { to: "/dashboard/profil", cta: "Écrire mon accroche" },
  meta: { to: "/dashboard/profil", cta: "Renseigner titre et description SEO" },
  specialties: { to: "/dashboard/profil", cta: "Ajouter mes spécialités" },
  geo: { to: "/dashboard/profil", cta: "Compléter mon adresse" },
  languages: { to: "/dashboard/profil", cta: "Déclarer mes langues" },
  photo: { to: "/dashboard/profil", cta: "Ajouter ma photo" },
  credentials: { to: "/dashboard/profil", cta: "Déposer une certification" },
  price: { to: "/dashboard/profil", cta: "Indiquer mon tarif" },
  modes: { to: "/dashboard/profil", cta: "Choisir mes modes de consultation" },
  availability: { to: "/dashboard/agenda", cta: "Publier mes disponibilités" },
  booking_note: { to: "/dashboard/profil", cta: "Écrire mon message d'accueil" },
  reviews: { to: "/dashboard/avis", cta: "Inviter mes clients à témoigner" },
  gallery: { to: "/dashboard/profil", cta: "Ajouter des photos du cabinet" },
  verified: { to: "/dashboard/profil", cta: "Compléter mon profil pour la vérification" },
};

const SEVERITY_RANK: Record<AuditSeverity, number> = { critical: 0, warning: 1, info: 2 };

const SEVERITY_STYLE: Record<AuditSeverity, { icon: typeof AlertTriangle; cls: string; label: string }> = {
  critical: { icon: AlertTriangle, cls: "text-red-300", label: "Prioritaire" },
  warning: { icon: AlertTriangle, cls: "text-orange-300", label: "Important" },
  info: { icon: Info, cls: "text-sky-300", label: "Recommandé" },
};

function tone(score: number) {
  return score >= 80 ? "text-emerald-300" : score >= 50 ? "text-orange-300" : "text-red-300";
}

function ScoreBar({ label, hint, value }: { label: string; hint: string; value: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-foreground/90">{label}</span>
        <span className={`text-xl font-bold ${tone(value)}`}>
          {value}
          <span className="text-sm text-muted-foreground">/100</span>
        </span>
      </div>
      <Progress value={value} className="mt-2 h-2" aria-label={`${label} : ${value} sur 100`} />
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/**
 * Score individuel de vitrine du thérapeute.
 * Aucun calcul local : les contrôles et les totaux viennent de
 * `auditMyShowcase`, qui utilise le même moteur (`showcase-audit.ts`) que
 * l'audit administrateur. Ce score mesure la qualité et la préparation à
 * l'indexation d'une fiche — il ne prédit ni un classement Google ni une
 * citation par un moteur IA.
 */
export function ShowcaseScoreCard() {
  const run = useServerFn(auditMyShowcase);
  const [showDone, setShowDone] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["my-showcase-audit"],
    queryFn: () => run(),
    staleTime: 60_000,
  });

  const { missing, done } = useMemo(() => {
    const checks = (data?.checks ?? []) as AuditCheck[];
    const sorter = (a: AuditCheck, b: AuditCheck) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.weight - a.weight;
    return {
      missing: checks.filter((c) => !c.passed).sort(sorter),
      done: checks.filter((c) => c.passed).sort(sorter),
    };
  }, [data]);

  if (isLoading) {
    return (
      <Card className="border-[rgba(184,110,249,0.25)] bg-[#2d1248]/70">
        <CardContent className="p-5">
          <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
          <div className="mt-4 h-2 animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-2 animate-pulse rounded bg-white/10" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) return null;

  const advanced = data.access?.advanced === true;
  const basic = data.basic;
  const total = basic.total;
  const okCount = basic.completed;
  const founder = data.access?.seatStatus === "active";
  const seatNumber = data.access?.showSeatNumber ? data.access?.seatNumber : null;

  return (
    <Card className="border-[rgba(184,110,249,0.25)] bg-[#2d1248]/70">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-[#b86ef9]" aria-hidden="true" />
            <div>
              <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-foreground">
                Qualité de ma vitrine
                <span className="inline-flex items-center gap-1 rounded-full border border-[#b86ef9]/40 bg-[#b86ef9]/10 px-2 py-0.5 text-[11px] font-medium text-[#d9b4ff]">
                  {advanced ? <Sparkles className="h-3 w-3" aria-hidden="true" /> : <Lock className="h-3 w-3" aria-hidden="true" />}
                  {advanced ? "Score avancé" : "Score de base"}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                {okCount} élément{okCount > 1 ? "s" : ""} optimisé{okCount > 1 ? "s" : ""} sur {total}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 min-h-[36px] gap-1.5 text-xs text-foreground/80"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
              Recalculer
            </Button>
            {data.slug && (
              <Button asChild variant="outline" size="sm" className="h-9 min-h-[36px] gap-1.5 text-xs">
                <a href={`/fr/therapeute/${data.slug}`} target="_blank" rel="noopener noreferrer">
                  Voir ma fiche
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </Button>
            )}
          </div>
        </div>

        {founder && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#b86ef9]/35 bg-[#b86ef9]/10 p-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#d9b4ff]" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-[#e7d3ff]">
              Vous bénéficiez de l’accès fondateur au scoring avancé Holiswiss.
              {seatNumber ? ` Accès fondateur — place n°${seatNumber} sur ${data.access?.earlySlots ?? 70}.` : ""}
            </p>
          </div>
        )}

        {advanced && data.totals ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <ScoreBar
              label="Visibilité"
              hint="Ce qui aide Google et les moteurs IA à comprendre et indexer votre fiche."
              value={data.totals.visibilite}
            />
            <ScoreBar
              label="Conversion"
              hint="Ce qui transforme une visite en demande de rendez-vous."
              value={data.totals.conversion}
            />
          </div>
        ) : (
          <div className="mt-5">
            <ScoreBar
              label="Score global"
              hint="Niveau de complétion de votre fiche publique."
              value={basic.score}
            />
          </div>
        )}

        {!advanced && (
          <div className="mt-5 space-y-3">
            {basic.essentials.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground/90">Éléments essentiels à compléter</h3>
                <ul className="mt-2 space-y-2">
                  {basic.essentials.map((e) => {
                    const action = ACTIONS[e.id];
                    return (
                      <li key={e.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-sm font-medium text-foreground/90">{e.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{e.hint}</p>
                        {action && (
                          <Button asChild variant="link" size="sm" className="mt-1 h-auto min-h-[32px] p-0 text-xs text-[#d9b4ff] hover:text-white">
                            <Link to={action.to}>{action.cta}</Link>
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {basic.recommendations.length > 0 && (
              <ul className="space-y-1.5">
                {basic.recommendations.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-xs text-foreground/75">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" aria-hidden="true" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="flex items-start gap-2 rounded-lg border border-[#b86ef9]/25 bg-[#b86ef9]/10 p-3 text-xs text-[#e6ccff]">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                Le score avancé — visibilité et conversion détaillées, actions prioritaires point par
                point — est disponible avec la formule Elite Pro, l’accès fondateur ou un accompagnement
                accordé par Holiswiss. Votre tableau de bord reste complet sans lui.
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" className="min-h-[40px] bg-[#b86ef9] text-white hover:bg-[#a css]">
                <Link to="/dashboard/abonnement">Découvrir Elite Pro</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="min-h-[40px]">
                <a href="/fr/contact">Demander un accompagnement commercial</a>
              </Button>
            </div>
          </div>
        )}

        {advanced && (missing.length === 0 ? (
          <p className="mt-5 flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            Votre vitrine est complète : tous les contrôles sont validés.
          </p>
        ) : (
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-foreground/90">Actions prioritaires</h3>
            <ul className="mt-2 space-y-2">
              {missing.map((c) => {
                const s = SEVERITY_STYLE[c.severity];
                const Icon = s.icon;
                const action = ACTIONS[c.id];
                return (
                  <li
                    key={c.id}
                    className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.cls}`} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground/90">
                          {c.label}
                          <span className={`ml-2 text-[11px] font-normal ${s.cls}`}>{s.label}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{c.hint}</p>
                        {action && (
                          <Button
                            asChild
                            variant="link"
                            size="sm"
                            className="mt-1 h-auto min-h-[32px] p-0 text-xs text-[#d9b4ff] hover:text-white"
                          >
                            <Link to={action.to}>{action.cta}</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {advanced && done.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              aria-expanded={showDone}
              className="flex min-h-[44px] items-center gap-1.5 text-sm text-foreground/80 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-[#b86ef9]"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showDone ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
              Éléments déjà optimisés ({done.length})
            </button>
            {showDone && (
              <ul className="mt-1 space-y-1.5">
                {done.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 text-xs text-foreground/75">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
                    <span>{c.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <p className="mt-4 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-muted-foreground">
          Indicateur de qualité et de préparation à l'indexation. Il ne garantit ni une position
          dans Google ni une citation par un moteur IA. L'abonnement Pro, la vérification du profil
          et les certifications professionnelles restent des éléments distincts.
        </p>
      </CardContent>
    </Card>
  );
}
