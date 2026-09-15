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

/** Jour civil suivant, en arithmétique de calendrier (pas d'ajout de 24 h). */
export function nextDateISO(dateISO: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
  return d.toISOString().slice(0, 10);
}

/**
 * Bornes INSTANTANÉES d'une journée à l'heure du praticien.
 *
 * Sert à chercher les rendez-vous qui RECOUVRENT la journée, y compris celui
 * de la veille qui franchit minuit : filtrer sur `appointment_date = jour`
 * laissait ce cas entièrement invisible.
 *
 * La borne de fin passe par la date civile suivante, jamais par « +24 h » :
 * les jours de changement d'heure font 23 ou 25 heures.
 */
export function swissDayWindow(
  dateISO: string,
  tz = "Europe/Zurich",
): { from: string; to: string } | null {
  const next = nextDateISO(dateISO);
  if (!next) return null;
  const from = localDateTimeToUtc(dateISO, "00:00", tz);
  const to = localDateTimeToUtc(next, "00:00", tz);
  if (!from || !to) return null;
  return { from: from.toISOString(), to: to.toISOString() };
}


export interface BookedAppointment {
  date?: string | null;
  time?: string | null;
  durationMinutes?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

/**
 * Convertit des rendez-vous existants en périodes occupées.
 *
 * On garde l'INTERVALLE ENTIER, pas seulement l'heure de départ : une séance
 * de 90 min à 10:00 doit fermer aussi le créneau de 11:00, ce qu'une simple
 * comparaison d'heures de début laissait ouvert.
 *
 * Les instants stockés (`startsAt`/`endsAt`) font foi quand ils existent ;
 * sinon on reconstruit l'intervalle depuis l'heure murale du praticien.
 * Une ligne inexploitable est ignorée plutôt que de fermer tout l'agenda.
 */
export function appointmentsToBusyRanges(
  rows: BookedAppointment[],
  tz = "Europe/Zurich",
): BusyRange[] {
  const out: BusyRange[] = [];
  for (const r of rows) {
    const dur = Math.max(1, Number(r.durationMinutes) || 60);
    if (r.startsAt) {
      const s = Date.parse(r.startsAt);
      if (Number.isNaN(s)) continue;
      const e = r.endsAt && !Number.isNaN(Date.parse(r.endsAt))
        ? Date.parse(r.endsAt)
        : s + dur * 60000;
      out.push({ startsAt: new Date(s).toISOString(), endsAt: new Date(e).toISOString() });
      continue;
    }
    if (!r.date || !r.time) continue;
    const start = localDateTimeToUtc(r.date, r.time, tz);
    if (!start) continue;
    out.push({
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + dur * 60000).toISOString(),
    });
  }
  return out;
}

