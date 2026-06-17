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
