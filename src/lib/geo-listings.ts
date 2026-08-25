/**
 * Helpers partagés (client + serveur) pour les pages d'annuaire géographiques
 * `/therapeutes/canton/{code}` et `/therapeutes/ville/{slug}`.
 * Données pures : aucun accès réseau, aucun JSX.
 */
import { CANTONS } from "@/lib/constants";
import type { SeoLang } from "@/lib/seo";

export function citySlug(city: string): string {
  return city
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const CANTON_CODES = CANTONS.map((c) => c.code);

/** Nom du canton par langue. Les cantons alémaniques gardent leur endonyme. */
const CANTON_NAMES: Record<string, Partial<Record<SeoLang, string>>> = {
  AG: { fr: "Argovie", de: "Aargau", it: "Argovia", en: "Aargau" },
  AI: { fr: "Appenzell Rhodes-Intérieures", de: "Appenzell Innerrhoden", it: "Appenzello Interno", en: "Appenzell Innerrhoden" },
  AR: { fr: "Appenzell Rhodes-Extérieures", de: "Appenzell Ausserrhoden", it: "Appenzello Esterno", en: "Appenzell Ausserrhoden" },
  BE: { fr: "Berne", de: "Bern", it: "Berna", en: "Bern" },
  BL: { fr: "Bâle-Campagne", de: "Basel-Landschaft", it: "Basilea Campagna", en: "Basel-Landschaft" },
  BS: { fr: "Bâle-Ville", de: "Basel-Stadt", it: "Basilea Città", en: "Basel-Stadt" },
  FR: { fr: "Fribourg", de: "Freiburg", it: "Friburgo", en: "Fribourg" },
  GE: { fr: "Genève", de: "Genf", it: "Ginevra", en: "Geneva" },
  GL: { fr: "Glaris", de: "Glarus", it: "Glarona", en: "Glarus" },
  GR: { fr: "Grisons", de: "Graubünden", it: "Grigioni", en: "Grisons" },
  JU: { fr: "Jura", de: "Jura", it: "Giura", en: "Jura" },
  LU: { fr: "Lucerne", de: "Luzern", it: "Lucerna", en: "Lucerne" },
  NE: { fr: "Neuchâtel", de: "Neuenburg", it: "Neuchâtel", en: "Neuchâtel" },
  NW: { fr: "Nidwald", de: "Nidwalden", it: "Nidvaldo", en: "Nidwalden" },
  OW: { fr: "Obwald", de: "Obwalden", it: "Obvaldo", en: "Obwalden" },
  SG: { fr: "Saint-Gall", de: "St. Gallen", it: "San Gallo", en: "St. Gallen" },
  SH: { fr: "Schaffhouse", de: "Schaffhausen", it: "Sciaffusa", en: "Schaffhausen" },
  SO: { fr: "Soleure", de: "Solothurn", it: "Soletta", en: "Solothurn" },
  SZ: { fr: "Schwytz", de: "Schwyz", it: "Svitto", en: "Schwyz" },
  TG: { fr: "Thurgovie", de: "Thurgau", it: "Turgovia", en: "Thurgau" },
  TI: { fr: "Tessin", de: "Tessin", it: "Ticino", en: "Ticino" },
  UR: { fr: "Uri", de: "Uri", it: "Uri", en: "Uri" },
  VD: { fr: "Vaud", de: "Waadt", it: "Vaud", en: "Vaud" },
  VS: { fr: "Valais", de: "Wallis", it: "Vallese", en: "Valais" },
  ZG: { fr: "Zoug", de: "Zug", it: "Zugo", en: "Zug" },
  ZH: { fr: "Zurich", de: "Zürich", it: "Zurigo", en: "Zurich" },
};

export function cantonName(code: string, lang: string): string {
  const c = (code ?? "").toUpperCase();
  const entry = CANTON_NAMES[c];
  if (!entry) return c;
  return entry[(lang.slice(0, 2) as SeoLang)] ?? entry.fr ?? c;
}

export function isCantonCode(code: string): boolean {
  return CANTON_CODES.includes((code ?? "").toUpperCase());
}
