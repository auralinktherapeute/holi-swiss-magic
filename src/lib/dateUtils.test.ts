import { describe, expect, it } from "vitest";
import { gridColumnIndex, gridIndexToStorageDow, parseDateOnly, storageDow } from "./dateUtils";

// Non-régression : mapping des jours du calendrier de réservation.
// Convention unique : availabilities.day_of_week === Date.getDay() (0 = dimanche).
describe("weekday mapping", () => {
  const week = [
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
