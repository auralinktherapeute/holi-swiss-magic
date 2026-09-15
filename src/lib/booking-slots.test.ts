import { describe, it, expect } from "vitest";
import { isSlotBlocked, filterAvailableSlots, appointmentsToBusyRanges, type BusyRange } from "./booking-slots";

// Réunion privée de 09:00 à 11:00 heure suisse, un jour d'été (UTC+2).
const MATIN: BusyRange[] = [
  { startsAt: "2026-09-01T07:00:00.000Z", endsAt: "2026-09-01T09:00:00.000Z" },
];
const D = "2026-09-01";

describe("isSlotBlocked", () => {
  it("bloque un créneau qui commence dans la période", () => {
    expect(isSlotBlocked("09:00", D, 60, MATIN)).toBe(true);
    expect(isSlotBlocked("10:00", D, 60, MATIN)).toBe(true);
  });

  it("bloque un créneau qui n'y commence pas mais la chevauche", () => {
    // C'est le cas que rate une comparaison d'heures de début : le créneau de
    // 08:30 déborde sur une réunion qui commence à 09:00.
    expect(isSlotBlocked("08:30", D, 60, MATIN)).toBe(true);
  });

  it("laisse libre un créneau qui se termine quand la période commence", () => {
    // Bornes exclusives : deux rendez-vous qui s'enchaînent ne se gênent pas.
    expect(isSlotBlocked("08:00", D, 60, MATIN)).toBe(false);
  });

  it("laisse libre un créneau qui commence quand la période finit", () => {
    expect(isSlotBlocked("11:00", D, 60, MATIN)).toBe(false);
  });

  it("laisse libre un créneau franchement en dehors", () => {
    expect(isSlotBlocked("14:00", D, 60, MATIN)).toBe(false);
    expect(isSlotBlocked("07:00", D, 60, MATIN)).toBe(false);
  });

  it("compare des INSTANTS, pas des heures affichées", () => {
    // Même heure murale, saison différente : en janvier la Suisse est à UTC+1,
    // donc 09:00 local vaut 08:00Z. Une période 07:00Z–09:00Z couvre alors
    // 08:00 et 09:00 locales, pas 09:00 et 10:00.
    const hiver: BusyRange[] = [
      { startsAt: "2026-01-15T07:00:00.000Z", endsAt: "2026-01-15T09:00:00.000Z" },
    ];
    expect(isSlotBlocked("08:00", "2026-01-15", 60, hiver)).toBe(true);
    expect(isSlotBlocked("09:00", "2026-01-15", 60, hiver)).toBe(true);
    expect(isSlotBlocked("10:00", "2026-01-15", 60, hiver)).toBe(false);
  });

  it("tient compte de la durée du créneau", () => {
    // Un créneau de 15 min à 08:45 ne touche pas 09:00 ; un de 30 min, si.
    expect(isSlotBlocked("08:45", D, 15, MATIN)).toBe(false);
    expect(isSlotBlocked("08:45", D, 30, MATIN)).toBe(true);
  });

  it("gère une journée entière importée", () => {
    const jour: BusyRange[] = [
      { startsAt: "2026-08-31T22:00:00.000Z", endsAt: "2026-09-01T22:00:00.000Z" },
    ];
    for (const h of ["08:00", "12:00", "18:00", "21:00"]) {
      expect(isSlotBlocked(h, D, 60, jour)).toBe(true);
    }
  });

  it("ne bloque rien quand aucune période n'est importée", () => {
    expect(isSlotBlocked("09:00", D, 60, [])).toBe(false);
  });

  it("ignore une période illisible plutôt que de tout bloquer", () => {
    // Défaut sûr : une donnée abîmée ne doit pas fermer l'agenda entier.
    const abime: BusyRange[] = [{ startsAt: "pas une date", endsAt: "non plus" }];
    expect(isSlotBlocked("09:00", D, 60, abime)).toBe(false);
  });
});

describe("filterAvailableSlots", () => {
  it("retire les créneaux couverts et conserve les autres", () => {
    const slots = ["08:00", "09:00", "10:00", "11:00", "14:00"];
    expect(filterAvailableSlots(slots, D, 60, MATIN)).toEqual(["08:00", "11:00", "14:00"]);
  });

  it("rend la liste intacte sans période importée", () => {
    const slots = ["08:00", "09:00"];
    expect(filterAvailableSlots(slots, D, 60, [])).toBe(slots);
  });
});

describe("appointmentsToBusyRanges", () => {
  it("garde la durée entière d'un rendez-vous existant", () => {
    // 10:00 + 90 min = 11:30 heure suisse (été, UTC+2) → 08:00Z–09:30Z.
    const r = appointmentsToBusyRanges([{ date: D, time: "10:00:00", durationMinutes: 90 }]);
    expect(r).toEqual([{ startsAt: "2026-09-01T08:00:00.000Z", endsAt: "2026-09-01T09:30:00.000Z" }]);
    // Le créneau de 11:00 est fermé, ce qu'une comparaison d'heures de départ
    // laissait ouvert ; celui de 11:30 reste libre (bord adjacent).
    expect(isSlotBlocked("11:00", D, 60, r)).toBe(true);
    expect(isSlotBlocked("11:30", D, 60, r)).toBe(false);
    expect(isSlotBlocked("09:00", D, 60, r)).toBe(false);
  });

  it("préfère les instants stockés quand ils existent", () => {
    const r = appointmentsToBusyRanges([
      { date: D, time: "10:00:00", durationMinutes: 60, startsAt: "2026-09-01T13:00:00.000Z", endsAt: "2026-09-01T14:00:00.000Z" },
    ]);
    expect(r).toEqual([{ startsAt: "2026-09-01T13:00:00.000Z", endsAt: "2026-09-01T14:00:00.000Z" }]);
  });

  it("complète une fin manquante avec la durée", () => {
    const r = appointmentsToBusyRanges([{ startsAt: "2026-09-01T13:00:00.000Z", durationMinutes: 30 }]);
    expect(r).toEqual([{ startsAt: "2026-09-01T13:00:00.000Z", endsAt: "2026-09-01T13:30:00.000Z" }]);
  });

  it("retient 60 minutes par défaut quand la durée manque", () => {
    const r = appointmentsToBusyRanges([{ date: D, time: "10:00" }]);
    expect(r[0].endsAt).toBe("2026-09-01T09:00:00.000Z");
  });

  it("ignore une ligne inexploitable au lieu de fermer l'agenda", () => {
    expect(appointmentsToBusyRanges([{ date: null, time: null }, { startsAt: "n'importe quoi" }])).toEqual([]);
  });

  it("chevauchement partiel entre durées différentes", () => {
    // Séance existante 10:00–11:00 ; une demande de 30 min à 10:30 chevauche.
    const r = appointmentsToBusyRanges([{ date: D, time: "10:00", durationMinutes: 60 }]);
    expect(isSlotBlocked("10:30", D, 30, r)).toBe(true);
    expect(isSlotBlocked("09:30", D, 30, r)).toBe(false);
  });
});
