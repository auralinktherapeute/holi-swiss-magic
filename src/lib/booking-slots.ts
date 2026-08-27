import { localDateTimeToUtc } from "@/lib/calendar-ics";

/**
 * Filtrage des créneaux réservables par les périodes occupées importées.
 *
 * Module PUR, séparé du widget, parce que la règle est facile à écrire de
 * travers et coûteuse à rater : un créneau laissé ouvert pendant que le
 * praticien est ailleurs, c'est un patient qui se déplace pour rien.
 *
 * Deux référentiels se croisent ici, et c'est tout le sujet :
 * - les créneaux proposés sont en HEURE MURALE suisse (« 09:00 »), telle que
 *   la base la stocke dans `appointments.appointment_time` ;
 * - les périodes importées sont des INSTANTS (`timestamptz`), parce qu'elles
 *   viennent d'agendas qui peuvent être dans n'importe quel fuseau.
 * On convertit donc le créneau en instant avant de comparer, jamais l'inverse.
 */

export interface BusyRange {
  /** Instant de début, ISO 8601 avec fuseau. */
  startsAt: string;
  endsAt: string;
}

/**
 * Un créneau est écarté dès qu'il CHEVAUCHE une période occupée — pas
 * seulement quand il commence dessus.
 *
 * Comparer les heures de début suffit pour deux rendez-vous de même durée sur
 * une même grille ; cela ne suffit pas face à un agenda extérieur, où une
 * réunion de 9 h à 11 h ne « commence » sur aucun créneau de l'après-midi mais
 * en occupe plusieurs du matin.
 *
 * Les bornes sont exclusives : une période qui finit à 10:00 laisse le créneau
 * de 10:00 libre. C'est le comportement attendu de deux rendez-vous qui
 * s'enchaînent.
 */
export function isSlotBlocked(
  slotHHMM: string,
  dateISO: string,
  slotMinutes: number,
  ranges: BusyRange[],
  tz = "Europe/Zurich",
): boolean {
  if (!ranges.length) return false;
  const start = localDateTimeToUtc(dateISO, slotHHMM, tz);
  if (!start) return false;
  const s = start.getTime();
  const e = s + Math.max(1, slotMinutes) * 60000;

  for (const r of ranges) {
    const rs = Date.parse(r.startsAt);
    const re = Date.parse(r.endsAt);
    if (Number.isNaN(rs) || Number.isNaN(re)) continue;
    // Chevauchement strict : [s,e) ∩ [rs,re) ≠ ∅
    if (s < re && rs < e) return true;
  }
  return false;
}

/** Applique `isSlotBlocked` à une liste de créneaux « HH:MM ». */
export function filterAvailableSlots(
  slots: string[],
  dateISO: string,
  slotMinutes: number,
  ranges: BusyRange[],
  tz = "Europe/Zurich",
): string[] {
  if (!ranges.length) return slots;
  return slots.filter((s) => !isSlotBlocked(s, dateISO, slotMinutes, ranges, tz));
}
