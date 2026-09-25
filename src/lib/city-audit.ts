/**
 * Audit admin « ville × NPA » (lecture seule) — séparé de city-normalize.ts
 * pour ne pas alourdir le fragment du formulaire, qui n'en a pas besoin.
 */
import {
  COUNTRY_SUFFIX,
  communesForNpa,
  findCommunesByName,
  isValidSwissNpaFormat,
  normalizeCityInput,
  normalizePostalCode,
  resolveCity,
  uniqueCommunes,
  type NpaIndex,
} from "@/lib/city-normalize";

export type CityIssueCode =
  | "missing_city"
  | "missing_npa"
  | "npa_invalid"
  | "npa_unknown"
  | "npa_mismatch"
  | "locality_not_commune"
  | "not_official_form"
  | "lowercase_initial"
  | "country_suffix"
  | "whitespace"
  | "canton_mismatch"
  | "canton_missing";

export type CityIssue = { code: CityIssueCode; severity: "critical" | "warning" | "info"; label: string };

export type CityAudit = {
  issues: CityIssue[];
  /** Valeurs officielles proposées (non appliquées). null si indéterminable. */
  suggestion: { city: string; canton: string } | null;
  /** Communes possibles quand la suggestion n'est pas unique. */
  alternatives: string[];
};

export function auditTherapistCity(
  index: NpaIndex,
  row: { city: string | null; postal_code: string | null; canton: string | null; status?: string | null },
): CityAudit {
  const issues: CityIssue[] = [];
  const raw = row.city ?? "";
  const city = normalizeCityInput(raw);
  const npaRaw = row.postal_code ?? "";
  const npa = normalizePostalCode(npaRaw);
  const isActive = row.status === "active";
  let suggestion: CityAudit["suggestion"] = null;
  let alternatives: string[] = [];

  if (!city) {
    issues.push({
      code: "missing_city",
      severity: isActive ? "critical" : "warning",
      label: isActive ? "Ville absente sur une fiche publiée" : "Ville absente",
    });
  } else {
    if (raw !== raw.trim() || /\s{2,}/.test(raw)) {
      issues.push({ code: "whitespace", severity: "info", label: "Espaces superflus" });
    }
    if (COUNTRY_SUFFIX.test(raw.trim()) && normalizeCityInput(raw) !== raw.trim()) {
      issues.push({ code: "country_suffix", severity: "warning", label: "Suffixe pays dans la ville (« , Suisse »…)" });
    }
    const firstLetter = raw.trim().match(/\p{L}/u)?.[0];
    if (firstLetter && firstLetter === firstLetter.toLowerCase() && firstLetter !== firstLetter.toUpperCase()) {
      issues.push({ code: "lowercase_initial", severity: "warning", label: "Ville en minuscules" });
    }
  }

  if (!npa) {
    issues.push({ code: "missing_npa", severity: "warning", label: "NPA absent — ville invérifiable" });
    if (city) {
      const named = uniqueCommunes(findCommunesByName(index, city));
      const cantons = new Set(named.map((c) => c.canton));
      if (named.length > 0 && cantons.size === 1) {
        suggestion = { city: named[0].name, canton: named[0].canton };
        if (named[0].name !== city) {
          issues.push({ code: "not_official_form", severity: "warning", label: `Forme non officielle (commune : « ${named[0].name} »)` });
        }
      } else if (named.length === 0) {
        issues.push({ code: "npa_mismatch", severity: "warning", label: "Nom absent du référentiel des communes" });
      }
    }
  } else if (!isValidSwissNpaFormat(npa)) {
    issues.push({ code: "npa_invalid", severity: "critical", label: `NPA invalide (« ${npaRaw} »)` });
  } else if (communesForNpa(index, npa).length === 0) {
    issues.push({ code: "npa_unknown", severity: "critical", label: `NPA ${npa} inconnu du répertoire officiel` });
  } else if (city) {
    const r = resolveCity(index, npa, city);
    if (r.kind === "exact" || r.kind === "variant") {
      suggestion = { city: r.commune.name, canton: r.commune.canton };
      // Casse, suffixe pays et espaces sont signalés à part : on ne parle de
      // « forme non officielle » que si la normalisation seule ne suffit pas
      // (trait d'union, accent, exonyme, « Bienne » pour « Biel/Bienne »…).
      if (city !== r.commune.name) {
        issues.push({ code: "not_official_form", severity: "warning", label: `Forme non officielle (commune : « ${r.commune.name} »)` });
      }
    } else if (r.kind === "locality") {
      issues.push({
        code: "locality_not_commune",
        severity: "critical",
        label: `« ${r.locality} » est une localité/quartier, pas une commune`,
      });
      if (r.communes.length === 1) suggestion = { city: r.communes[0].name, canton: r.communes[0].canton };
      else alternatives = r.communes.map((c) => c.name);
    } else if (r.kind === "mismatch") {
      // Où se trouve réellement une commune de ce nom (ex. « Basel » : BS, NPA 4001…).
      const allElsewhere = findCommunesByName(index, city);
      const where = r.elsewhere.length
        ? ` (« ${r.elsewhere[0].name} » : ${[...new Set(r.elsewhere.map((c) => c.canton))].join("/")}, NPA ${[...new Set(allElsewhere.map((c) => c.npa))].slice(0, 2).join(", ")}…)`
        : " (nom absent du référentiel des communes)";
      issues.push({
        code: "npa_mismatch",
        severity: "critical",
        label: `La ville ne correspond pas au NPA ${npa}${where}`,
      });
      alternatives = r.candidates.map((c) => c.name);
    }
  } else {
    const communes = uniqueCommunes(communesForNpa(index, npa));
    if (communes.length === 1) suggestion = { city: communes[0].name, canton: communes[0].canton };
    else alternatives = communes.map((c) => c.name);
  }

  if (suggestion) {
    if (!row.canton) {
      issues.push({ code: "canton_missing", severity: "info", label: `Canton absent (attendu : ${suggestion.canton})` });
    } else if (row.canton !== suggestion.canton) {
      issues.push({ code: "canton_mismatch", severity: "critical", label: `Canton ${row.canton} ≠ ${suggestion.canton} (commune ${suggestion.city})` });
    }
  }

  return { issues, suggestion, alternatives };
}
