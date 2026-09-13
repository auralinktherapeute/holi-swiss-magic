import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FaqSection } from "@/components/holiswiss/FaqSection";
import { PILLAR, PILLAR_SOURCES, type PillarLang } from "@/lib/visibility-pillar-content";

/**
 * Page pilier « visibilité » — rendu SSR pur : aucun état, aucun fetch, aucun
 * effet. Le texte et la FAQ sont donc présents dans le HTML servi, lisibles
 * sans JavaScript. La navigation et le pied de page viennent du layout `$lang`.
 *
 * La FAQ réutilise `FaqSection` (details/summary natifs) : elle porte déjà son
 * propre balisage FAQPage, désactivé ici (`jsonLd={false}`) car la page émet un
 * graphe unique depuis `head()`.
 */
export function VisibilityPillar({ lang }: { lang: PillarLang }) {
  const c = PILLAR[lang];

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#1a0a2e]">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-[#b86ef9]/20 blur-[120px]" />
        <div className="absolute top-1/2 right-0 h-[400px] w-[400px] rounded-full bg-[#5cc8fa]/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <nav aria-label={c.breadcrumb} className="text-sm text-[#d4c4e0]">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link
                to="/$lang"
                params={{ lang }}
                className="inline-flex min-h-[44px] items-center rounded px-1 hover:text-white focus-visible:ring-2 focus-visible:ring-[#b86ef9] focus-visible:outline-none"
              >
                {c.breadcrumbHome}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-white/90">{c.breadcrumb}</li>
          </ol>
        </nav>

        <header className="mt-4 max-w-3xl">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            {c.h1}
          </h1>
          {c.intro.map((p, i) => (
            <p key={i} className="mt-5 text-base leading-relaxed text-[#d4c4e0] sm:text-lg">
              {p}
            </p>
          ))}
        </header>

        <div className="mt-10 space-y-10">
          {c.blocks.map((b, i) => (
            <section key={i} className="max-w-3xl">
              <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{b.h2}</h2>
              {b.paras?.map((p, j) => (
                <p key={j} className="mt-4 text-base leading-relaxed text-[#d4c4e0]">
                  {p}
                </p>
              ))}
              {b.bullets && (
                <ul className="mt-4 space-y-2">
                  {b.bullets.map((li, j) => (
                    <li key={j} className="flex gap-3 text-base leading-relaxed text-[#d4c4e0]">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-[#b86ef9]" aria-hidden="true" />
                      <span>{li}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* CTA — liens réels vers des parcours existants */}
        <section className="mt-14 rounded-3xl border border-[rgba(184,110,249,0.25)] bg-[#3d1a5c]/60 p-6 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{c.cta.title}</h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#d4c4e0]">{c.cta.text}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="min-h-[44px] gap-2 bg-[#b86ef9] font-semibold text-[#1a0a2e] shadow-lg shadow-[#b86ef9]/40 hover:bg-[#a855f7] hover:text-[#1a0a2e]"
            >
              <Link to="/$lang/inscription" params={{ lang }}>
                {c.cta.primary}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-h-[44px] border-[#b86ef9]/40 bg-transparent text-white hover:bg-[#b86ef9]/10"
            >
              <Link to="/$lang/tarifs" params={{ lang }}>
                {c.cta.secondary}
              </Link>
            </Button>
          </div>
          <p className="mt-5">
            <Link
              to="/$lang/therapeutes"
              params={{ lang }}
              className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-[#5cc8fa] underline hover:text-white focus-visible:ring-2 focus-visible:ring-[#b86ef9] focus-visible:outline-none"
            >
              {c.cta.directory}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </p>
        </section>
      </div>

      <FaqSection items={c.faq} title={c.faqTitle} subtitle="" jsonLd={false} />

      <div className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <section className="max-w-3xl">
          <h2 className="text-lg font-semibold text-white">{c.sourcesTitle}</h2>
          <ul className="mt-3 space-y-2">
            {PILLAR_SOURCES.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-2 text-sm text-[#5cc8fa] underline hover:text-white focus-visible:ring-2 focus-visible:ring-[#b86ef9] focus-visible:outline-none"
                >
                  {s.label}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
