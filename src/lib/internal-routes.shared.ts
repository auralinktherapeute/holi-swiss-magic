// Registre des routes RÉELLES du projet, dérivé des fichiers de src/routes.
// Sert à interdire tout lien fictif dans « La Lettre Holiswiss ».

const modules = import.meta.glob("/src/routes/**/*.{ts,tsx}");

const DOT_ESCAPE = "\u0000";

function fileToSegments(file: string): string[] | null {
  let key = file.replace("/src/routes/", "").replace(/\.(tsx|ts)$/, "");
  if (key.startsWith("__") || key.startsWith("api/") || key === "README") return null;
  key = key.replace(/\[\.\]/g, DOT_ESCAPE);
  const segments = key
    .replace(/\//g, ".")
    .split(".")
    .map((s) => s.replace(new RegExp(DOT_ESCAPE, "g"), "."))
    .filter((s) => s.length > 0);
  const last = segments[segments.length - 1];
  if (last === "index" || last === "route") segments.pop();
  return segments;
}

/** Toutes les routes déclarées, en segments (les segments dynamiques commencent par `$`). */
export const ROUTE_PATTERNS: string[][] = Object.keys(modules)
  .map(fileToSegments)
  .filter((s): s is string[] => s !== null);

/** Nettoie une valeur saisie : URL absolue Holiswiss ou chemin interne → segments. */
export function toInternalSegments(value: string): string[] | null {
  let path = value.trim();
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) {
    let url: URL;
    try {
      url = new URL(path);
    } catch {
      return null;
    }
    if (!/(^|\.)holiswiss\.ch$/i.test(url.hostname)) return null;
    path = url.pathname;
  }
  if (!path.startsWith("/")) return null;
  return path.split("?")[0].split("#")[0].split("/").filter(Boolean);
}

/** Vrai si la valeur correspond à une route réellement déclarée dans le projet. */
export function isRealInternalRoute(value: string): boolean {
  const segments = toInternalSegments(value);
  if (!segments) return false;
  return ROUTE_PATTERNS.some(
    (pattern) =>
      pattern.length === segments.length &&
      pattern.every((seg, i) => seg.startsWith("$") || seg === segments[i]),
  );
}

/** Vrai si la valeur est une URL externe (http/https hors holiswiss.ch). */
export function isExternalUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim()) && toInternalSegments(value) === null;
}
