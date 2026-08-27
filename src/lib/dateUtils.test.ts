import { describe, expect, it } from "vitest";
import { gridColumnIndex, gridIndexToStorageDow, parseDateOnly, storageDow, localDateISO } from "./dateUtils";

// Non-régression : mapping des jours du calendrier de réservation.
// Convention unique : availabilities.day_of_week === Date.getDay() (0 = dimanche).
describe("weekday mapping", () => {
  type WeekDay = { iso: string; label: string; storage: number; column: number };
  const week: WeekDay[] = [
    { iso: "2026-08-03", label: "lundi", storage: 1, column: 0 },
    { iso: "2026-08-04", label: "mardi", storage: 2, column: 1 },
    { iso: "2026-08-05", label: "mercredi", storage: 3, column: 2 },
    { iso: "2026-08-06", label: "jeudi", storage: 4, column: 3 },
    { iso: "2026-08-07", label: "vendredi", storage: 5, column: 4 },
    { iso: "2026-08-08", label: "samedi", storage: 6, column: 5 },
    { iso: "2026-08-09", label: "dimanche", storage: 0, column: 6 },
  ];

  it.each(week)("$label → storage $storage / colonne $column", ({ iso, storage, column }) => {
    const d = parseDateOnly(iso)!;
    expect(storageDow(d)).toBe(storage);
    expect(gridColumnIndex(d)).toBe(column);
    expect(gridIndexToStorageDow(column)).toBe(storage);
  });

  it("un thérapeute dispo lundi→samedi ne rend jamais le dimanche sélectionnable", () => {
    const availability = [1, 2, 3, 4, 5, 6];
    const selectable = week.filter((d) => availability.includes(storageDow(parseDateOnly(d.iso)!)));
    expect(selectable.map((d) => d.label)).toEqual([
      "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi",
    ]);
  });

  it("parseDateOnly ne décale pas le jour (pas de conversion UTC)", () => {
    expect(parseDateOnly("2026-08-03")!.getDate()).toBe(3);
    expect(parseDateOnly("2026-01-01")!.getDay()).toBe(new Date(2026, 0, 1).getDay());
  });
});

describe("localDateISO — la date qui accompagne une heure locale", () => {
  it("rend la date locale, quel que soit le fuseau du lanceur", () => {
    // Construit avec des composantes LOCALES : le contrat vaut partout, et le
    // test ne peut pas devenir muet selon le fuseau de la machine.
    expect(localDateISO(new Date(2026, 8, 2, 0, 30))).toBe("2026-09-02");
    expect(localDateISO(new Date(2026, 8, 2, 23, 45))).toBe("2026-09-02");
  });

  it("ne suit PAS toISOString, qui rend la date UTC", () => {
    // Le piège corrigé le 27/08/2026 : `toISOString()` associé à
    // `toTimeString()` enregistrait un rendez-vous du 2 septembre à 00:30
    // heure suisse au 1er septembre. Ici l'instant est fixé avec un décalage
    // explicite, donc la démonstration ne dépend pas de la machine.
    const suisseEte = new Date("2026-09-02T00:30:00+02:00");
    expect(suisseEte.toISOString().slice(0, 10)).toBe("2026-09-01");
  });

  it("complète les mois et les jours sur deux chiffres", () => {
    expect(localDateISO(new Date(2026, 0, 5, 12, 0))).toBe("2026-01-05");
    expect(localDateISO(new Date(2026, 11, 31, 12, 0))).toBe("2026-12-31");
  });
});
