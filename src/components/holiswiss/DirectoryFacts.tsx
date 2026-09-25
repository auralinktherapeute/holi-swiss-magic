import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  computeListingFacts,
  formatChfAmount,
  formatSwissDate,
  type DirectoryFacts,
  type FactsRow,
  type ListingFacts,
} from "@/lib/directory-stats";
import type { PageModified } from "@/lib/page-dates";
import { LastUpdated } from "@/components/holiswiss/LastUpdated";

/**
 * Chiffres sourcés de l'annuaire, rendus dans le HTML initial (SSR).
 *
 * Tout vient des données déjà chargées par le loader de la page : rien n'est
 * lu dans un effet ni côté navigateur, rien n'est écrit en dur. Si la page ne
 * liste personne, le bloc ne s'affiche pas (jamais « 0 thérapeute »).
 * La mention « vérifié » n'apparaît que si au moins une fiche l'est.
 */

export type FactsScope =
  | { kind: "city"; name: string }
  | { kind: "canton"; name: string }
  | { kind: "specialty"; name: string }
  | { kind: "specialtyCity"; name: string; city: string; km: number };

type TFn = ReturnType<typeof useTranslation>["t"];

function leadSentence(t: TFn, facts: ListingFacts, date: string, scope: string): string {
  const therapists = t("directoryFacts.therapists", { count: facts.count });
  if (facts.verifiedCount > 0) {
    return t("directoryFacts.lead_verified", {
      date,
      therapists,
      scope,
      verified: t("directoryFacts.verified", { count: facts.verifiedCount }),
    });
  }
  return t("directoryFacts.lead", { date, therapists, scope });
}

function spreadSentence(
  t: TFn,
  facts: ListingFacts,
  withCantons: boolean,
  withCities: boolean,
): string | null {
  const parts: string[] = [];
  if (withCantons && facts.cantonCount > 0)
    parts.push(t("directoryFacts.cantons", { count: facts.cantonCount }));
  if (withCities && facts.cityCount > 0)
    parts.push(t("directoryFacts.cities", { count: facts.cityCount }));
  return parts.length ? t("directoryFacts.spread", { parts: parts.join(", ") }) : null;
}

function FactsFrame({
  label,
  children,
  compact,
}: {
  label: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <aside
      aria-label={label}
      data-directory-facts=""
      className={
        compact
          ? "mb-6 max-w-3xl border-l-2 border-[#5cc8fa]/60 pl-4 text-sm leading-relaxed text-white/75"
          : "mx-auto max-w-3xl rounded-2xl border border-[rgba(184,110,249,0.25)] bg-[rgba(45,27,78,0.6)] px-6 py-7 text-center backdrop-blur sm:px-10"
      }
    >
      {children}
    </aside>
  );
}

/** Pages spécialité / ville / canton : chiffres de CETTE page, depuis sa liste. */
export function ListingFactsBlock({
  rows,
  asOf,
  scope,
  showCantons = false,
  showCities = false,
}: {
  rows: ReadonlyArray<FactsRow>;
  asOf: string | null | undefined;
  scope: FactsScope;
  showCantons?: boolean;
  showCities?: boolean;
}) {
  const { t } = useTranslation();
  const date = formatSwissDate(asOf ?? "");
  const facts = computeListingFacts(rows);
  if (facts.count === 0 || !date) return null;

  const scopeText =
    scope.kind === "city"
      ? t("directoryFacts.scope_city", { name: scope.name })
      : scope.kind === "canton"
        ? t("directoryFacts.scope_canton", { name: scope.name })
        : scope.kind === "specialty"
          ? t("directoryFacts.scope_specialty", { name: scope.name })
          : t("directoryFacts.scope_specialty_city", {
              name: scope.name,
              city: scope.city,
              km: scope.km,
            });

  const spread = spreadSentence(t, facts, showCantons, showCities);

  return (
    <FactsFrame label={t("directoryFacts.home_title")} compact>
      <p>
        {leadSentence(t, facts, date, scopeText)}
        {spread && <> {spread}</>}
        {facts.priceFrom !== null && (
          <>
            {" "}
            {t("directoryFacts.price", {
              count: facts.pricedCount,
              price: formatChfAmount(facts.priceFrom),
            })}
          </>
        )}
      </p>
      <p className="mt-1 text-xs text-white/45">{t("directoryFacts.source", { date })}</p>
    </FactsFrame>
  );
}

/** Accueil : chiffres globaux, calculés par `getDirectoryStats` au SSR. */
export function HomeDirectoryFacts({
  stats,
  lang,
  lastModified,
}: {
  stats: DirectoryFacts | null | undefined;
  /** Langue de l'URL (et non `i18n.language`) : identique au SSR et au client. */
  lang: string;
  /** Fiche listée modifiée le plus récemment — même valeur que le `dateModified` de l'accueil. */
  lastModified?: PageModified | null;
}) {
  const { t } = useTranslation();
  if (!stats || stats.count === 0) return null;
  const date = formatSwissDate(stats.asOf);
  if (!date) return null;

  const spread = spreadSentence(t, stats, true, true);
  const languageList = stats.languages
    .map((l) => `${t(`directoryFacts.lang_${l.code}`)} (${l.count})`)
    .join(", ");

  return (
    <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
      <FactsFrame label={t("directoryFacts.home_title")}>
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5cc8fa]">
          {t("directoryFacts.home_title")}
        </h2>
        <p
          className="mt-4 text-xl leading-snug text-white sm:text-2xl"
          style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 }}
        >
          {leadSentence(t, stats, date, "")}
        </p>
        <div className="mt-4 space-y-1 text-sm leading-relaxed text-white/75">
          {spread && <p>{spread}</p>}
          {stats.specialtyCount !== null && stats.specialtyCount > 0 && (
            <p>{t("directoryFacts.specialties", { count: stats.specialtyCount })}</p>
          )}
          {stats.priceFrom !== null && (
            <p>
              {t("directoryFacts.price_share", {
                count: stats.pricedCount,
                total: stats.count,
                price: formatChfAmount(stats.priceFrom),
              })}
            </p>
          )}
          {languageList && <p>{t("directoryFacts.languages", { list: languageList })}</p>}
        </div>
        <p className="mt-4 text-xs text-white/45">{t("directoryFacts.source", { date })}</p>
        <LastUpdated modified={lastModified} lang={lang} className="mt-1 text-white/45" />
      </FactsFrame>
    </section>
  );
}
