/**
 * Référentiel NPA → commune → canton (swisstopo), indexé une seule fois.
 *
 * Côté serveur : `getSwissNpaIndex()` (import statique, ~160 Ko de texte).
 * Côté navigateur : NE PAS importer ce module statiquement. Utiliser
 * `await import("@/lib/swiss-npa")` : le référentiel devient un fragment
 * séparé, téléchargé seulement quand le formulaire de localisation s'affiche.
 */
import { SWISS_NPA_TSV, SWISS_NPA_GENERATED_AT, SWISS_NPA_SOURCE_SHA256 } from "@/data/swiss-npa.generated";
import { parseNpaTsv, type NpaIndex } from "@/lib/city-normalize";

let cached: NpaIndex | null = null;

export function getSwissNpaIndex(): NpaIndex {
  if (!cached) cached = parseNpaTsv(SWISS_NPA_TSV);
  return cached;
}

export const SWISS_NPA_SOURCE = {
  label: "swisstopo — Répertoire officiel des localités",
  url: "https://www.swisstopo.admin.ch/fr/repertoire-officiel-des-localites",
  generatedAt: SWISS_NPA_GENERATED_AT,
  sha256: SWISS_NPA_SOURCE_SHA256,
};

