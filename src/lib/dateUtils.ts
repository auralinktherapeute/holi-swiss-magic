/**
 * Parse a `YYYY-MM-DD` string as a local date (no timezone shift).
 * Returns null for invalid input.
 */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  return isNaN(date.getTime()) ? null : date;
}

export function localeForI18n(lang: string): string {
  const base = (lang || "fr").slice(0, 2).toLowerCase();
  switch (base) {
    case "de": return "de-CH";
    case "it": return "it-CH";
    case "en": return "en-GB";
    default:   return "fr-CH";
  }
}

/** Format a JS Date as a local `YYYY-MM-DD` string (no UTC shift). */
export function formatDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * CONVENTION UNIQUE des jours de semaine dans Holiswiss.
 *
 * Stockage (`availabilities.day_of_week`) = index JS `Date.getDay()` :
 * 0 = dimanche, 1 = lundi … 6 = samedi.
 *
 * L'affichage calendrier est lundi-first (0 = lundi … 6 = dimanche) : c'est
 * UNIQUEMENT une position de colonne, jamais une valeur de base de données.
 * Utiliser `storageDow()` pour toute comparaison avec `day_of_week`, et
 * `gridColumnIndex()` uniquement pour positionner les cases.
 */
/**
 * Date d'un instant dans le fuseau LOCAL, au format `AAAA-MM-JJ`.
 *
 * À utiliser partout où une date accompagne une heure locale. `toISOString()`
 * rend la date en UTC : associée à `toTimeString()`, qui rend l'heure locale,
 * elle produit un enregistrement incohérent. Un rendez-vous du 2 septembre à
 * 00:30 heure suisse était ainsi stocké au 1er septembre — le défaut mordait
 * entre minuit et le décalage UTC (00:00–02:00 en été, 00:00–01:00 en hiver).
 */
export function localDateISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function storageDow(d: Date): number {
  return d.getDay();
}

/** Index de colonne dans une grille lundi→dimanche (0 = lundi, 6 = dimanche). */
export function gridColumnIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Convertit un index de colonne lundi-first en `day_of_week` de stockage. */
export function gridIndexToStorageDow(index: number): number {
  return (index + 1) % 7;
}
