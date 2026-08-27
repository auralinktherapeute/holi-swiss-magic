/**
 * Génération et lecture de flux iCalendar (RFC 5545).
 *
 * Module PUR : aucune entrée/sortie, aucun accès base. Tout ce qui touche au
 * réseau ou à Supabase vit dans `calendar-sync.functions.ts`. C'est ce qui
 * rend ces règles testables — et elles doivent l'être : une erreur de fuseau
 * ou une récurrence mal développée produit un double booking, c'est-à-dire
 * deux personnes dans le cabinet à la même heure.
 *
 * Aucune bibliothèque iCal n'est installée dans le dépôt, d'où cette
 * implémentation. Elle couvre volontairement un sous-ensemble, énoncé dans
 * `parseIcsBusy`.
 */

/* ────────────────────────────  Écriture  ──────────────────────────── */

/** Échappement RFC 5545 §3.3.11. L'antislash d'abord, sinon on ré-échappe. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Pliage à 75 OCTETS (RFC 5545 §3.1) — pas 75 caractères.
 * « Genève » ou un prénom accentué compte double en UTF-8 ; découper au
 * caractère produirait une ligne trop longue, voire un octet coupé en deux.
 */
export function foldIcsLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curBytes = 0;
  let first = true;
  for (const ch of line) {
    const chBytes = enc.encode(ch).length;
    const limit = first ? 75 : 74; // les lignes suivantes commencent par une espace
    if (curBytes + chBytes > limit) {
      out.push(cur);
      first = false;
      cur = ch;
      curBytes = chBytes;
    } else {
      cur += ch;
      curBytes += chBytes;
    }
  }
  out.push(cur);
  return out[0] + out.slice(1).map((l) => "\r\n " + l).join("");
}

/** Horodatage UTC `YYYYMMDDTHHMMSSZ`. */
export function toIcsUtc(d: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${p(d.getUTCFullYear(), 4)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

/**
 * `date` + `heure` stockés en heure locale → instant UTC.
 *
 * Les rendez-vous sont enregistrés en heure murale suisse (`appointment_date`
 * + `appointment_time`), sans fuseau. Les publier tels quels dans un flux iCal
 * les décalerait d'une à deux heures selon la saison — et un praticien qui se
 * présente une heure trop tard, c'est un patient qui attend.
 */
export function localDateTimeToUtc(
  dateISO: string,
  timeISO: string | null | undefined,
  tz = "Europe/Zurich",
): Date | null {
  const d = (dateISO ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!d) return null;
  const t = (timeISO ?? "00:00").match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!t) return null;
  return zonedToUtc(+d[1], +d[2], +d[3], +t[1], +t[2], +(t[3] ?? 0), tz);
}

export interface IcsEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  /** Description facultative. N'y mettre aucune donnée sensible. */
  description?: string;
}

/**
 * Construit un flux iCalendar complet.
 *
 * `stamp` est injectable pour que les tests soient déterministes.
 */
export function buildIcs(events: IcsEvent[], opts: { name: string; stamp?: Date }): string {
  const stamp = toIcsUtc(opts.stamp ?? new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Holiswiss//Agenda//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(opts.name)}`,
    // Les agendas qui l'honorent n'interrogent pas plus souvent que ça.
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcsText(e.uid)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toIcsUtc(e.start)}`,
      `DTEND:${toIcsUtc(e.end)}`,
      `SUMMARY:${escapeIcsText(e.summary)}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${escapeIcsText(e.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  // CRLF exigé par la RFC — plusieurs clients rejettent un flux en LF seul.
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

/**
 * Intitulé d'un rendez-vous exporté : PRÉNOM seul, puis type de séance.
 *
 * C'est la règle de confidentialité du flux, et elle vit ici pour être testée.
 * Une URL iCal est un secret porteur — qui la détient lit tout le flux, sans
 * mot de passe. Le nom de famille, l'e-mail, le téléphone et les notes ne
 * doivent donc jamais y figurer : le prénom suffit au praticien pour
 * reconnaître son rendez-vous dans son agenda.
 */
export function appointmentSummary(patientName?: string | null, serviceName?: string | null): string {
  const firstName = (patientName ?? "").trim().split(/\s+/)[0] ?? "";
  const service = (serviceName ?? "").trim();
  if (firstName && service) return `${firstName} — ${service}`;
  if (firstName) return firstName;
  if (service) return service;
  return "Réservé";
}

/* ────────────────────────────  Lecture  ──────────────────────────── */

/**
 * Décalage d'un fuseau à un instant donné, en minutes.
 *
 * Passe par `Intl` plutôt que par une table de fuseaux : le moteur en embarque
 * déjà une, à jour. Sans cela, une heure « Europe/Zurich » serait lue comme de
 * l'UTC et décalerait chaque créneau d'une ou deux heures selon la saison.
 */
function tzOffsetMinutes(tz: string, utcMs: number): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const parts = Object.fromEntries(dtf.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]));
    const asUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour) % 24, Number(parts.minute), Number(parts.second),
    );
    return (asUtc - utcMs) / 60000;
  } catch {
    return 0; // fuseau inconnu : traité comme UTC
  }
}

/** Heure locale d'un fuseau → instant UTC. Deux passes pour les bascules d'heure d'été. */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): Date {
  const naive = Date.UTC(y, mo - 1, d, h, mi, s);
  let ms = naive - tzOffsetMinutes(tz, naive) * 60000;
  ms = naive - tzOffsetMinutes(tz, ms) * 60000;
  return new Date(ms);
}

/** Déplie les lignes de continuation (RFC 5545 §3.1) avant toute analyse. */
export function unfoldIcs(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseIcsDate(value: string, params: Record<string, string>): { date: Date; allDay: boolean } | null {
  const v = value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (!h) {
    // Date seule : journée entière, en heure locale du fuseau indiqué.
    const tz = params.TZID || "UTC";
    return { date: zonedToUtc(+y, +mo, +d, 0, 0, 0, tz), allDay: true };
  }
  if (z) return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)), allDay: false };
  const tz = params.TZID || "UTC";
  return { date: zonedToUtc(+y, +mo, +d, +h, +mi, +s, tz), allDay: false };
}

/** Durée ISO 8601 (`PT1H30M`, `P1D`) → millisecondes. */
function parseDuration(v: string): number | null {
  const m = v.trim().match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const [, sign, w, d, h, mi, s] = m;
  const ms =
    (+(w ?? 0) * 604800 + +(d ?? 0) * 86400 + +(h ?? 0) * 3600 + +(mi ?? 0) * 60 + +(s ?? 0)) * 1000;
  return sign === "-" ? -ms : ms;
}

export interface BusySlot {
  uid: string;
  startsAt: Date;
  endsAt: Date;
}

export interface ParseResult {
  busy: BusySlot[];
  /** Événements récurrents dont la règle n'est pas développée ici. */
  skippedRecurring: number;
  /** Nombre total de VEVENT rencontrés, retenus ou non. */
  seen: number;
  /**
   * Écartés parce que marqués « ne m'occupe pas » (`TRANSP:TRANSPARENT`) ou
   * annulés. Compté pour pouvoir le DIRE : un import qui rend zéro créneau
   * sans explication ne se distingue pas d'une panne. Les calendriers de jours
   * fériés, par exemple, sont intégralement transparents — c'est normal, un
   * jour férié ne rend pas indisponible.
   */
  ignored: number;
}

const WEEKDAY = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 } as const;

/**
 * Extrait les périodes OCCUPÉES d'un flux iCalendar.
 *
 * Ce qui est volontairement ignoré :
 * - `TRANSP:TRANSPARENT` — l'auteur a marqué le créneau comme n'occupant pas
 *   son temps. Le bloquer priverait le praticien de plages libres.
 * - `STATUS:CANCELLED` — annulé.
 * - Les récurrences autres que DAILY et WEEKLY. Elles sont COMPTÉES et
 *   remontées (`skippedRecurring`) plutôt que tues : un créneau manqué est un
 *   double booking, le praticien doit savoir qu'il en reste.
 *
 * `windowEnd` borne le développement des récurrences sans UNTIL ni COUNT :
 * sans borne, `FREQ=WEEKLY` seul est infini.
 */
export function parseIcsBusy(
  text: string,
  opts: { windowStart: Date; windowEnd: Date; maxEvents?: number },
): ParseResult {
  const lines = unfoldIcs(text);
  const busy: BusySlot[] = [];
  let skippedRecurring = 0;
  let seen = 0;
  let ignored = 0;
  const maxEvents = opts.maxEvents ?? 5000;

  let inEvent = false;
  let cur: Record<string, { value: string; params: Record<string, string> }> = {};

  const flush = () => {
    const startRaw = cur.DTSTART;
    if (!startRaw) return;
    const transp = cur.TRANSP?.value?.trim().toUpperCase();
    const status = cur.STATUS?.value?.trim().toUpperCase();
    if (transp === "TRANSPARENT" || status === "CANCELLED") { ignored++; return; }

    const start = parseIcsDate(startRaw.value, startRaw.params);
    if (!start) return;

    let endMs: number;
    if (cur.DTEND) {
      const e = parseIcsDate(cur.DTEND.value, cur.DTEND.params);
      if (!e) return;
      endMs = e.date.getTime();
    } else if (cur.DURATION) {
      const d = parseDuration(cur.DURATION.value);
      if (d === null) return;
      endMs = start.date.getTime() + d;
    } else {
      // Sans fin ni durée : une journée si date seule, sinon instantané.
      endMs = start.date.getTime() + (start.allDay ? 86400000 : 0);
    }
    if (endMs <= start.date.getTime()) return;

    const uid = cur.UID?.value?.trim() || `${toIcsUtc(start.date)}-${endMs}`;
    const durMs = endMs - start.date.getTime();
    const rrule = cur.RRULE?.value?.trim();

    const push = (s: number) => {
      if (busy.length >= maxEvents) return;
      const e = s + durMs;
      if (e <= opts.windowStart.getTime() || s >= opts.windowEnd.getTime()) return;
      busy.push({ uid, startsAt: new Date(s), endsAt: new Date(e) });
    };

    if (!rrule) {
      push(start.date.getTime());
      return;
    }

    const parts = Object.fromEntries(
      rrule.split(";").map((kv) => {
        const [k, v] = kv.split("=");
        return [k.toUpperCase(), v ?? ""];
      }),
    );
    const freq = (parts.FREQ ?? "").toUpperCase();
    if (freq !== "DAILY" && freq !== "WEEKLY") {
      skippedRecurring++;
      push(start.date.getTime()); // au moins la première occurrence
      return;
    }

    const interval = Math.max(1, Number(parts.INTERVAL ?? 1) || 1);
    const count = parts.COUNT ? Number(parts.COUNT) : null;
    const untilParsed = parts.UNTIL ? parseIcsDate(parts.UNTIL, {}) : null;
    const untilMs = untilParsed ? untilParsed.date.getTime() : opts.windowEnd.getTime();
    const byDay = (parts.BYDAY ?? "")
      .split(",")
      .map((d) => d.trim().slice(-2).toUpperCase())
      .filter((d): d is keyof typeof WEEKDAY => d in WEEKDAY)
      .map((d) => WEEKDAY[d]);

    const stepMs = (freq === "DAILY" ? 86400000 : 604800000) * interval;
    let emitted = 0;
    let cursor = start.date.getTime();
    // Borne dure : protège d'une règle pathologique qui bouclerait sans fin.
    for (let guard = 0; guard < 4000; guard++) {
      if (cursor > untilMs || cursor > opts.windowEnd.getTime()) break;
      if (count !== null && emitted >= count) break;
      if (freq === "WEEKLY" && byDay.length) {
        const weekStart = cursor;
        for (const wd of byDay) {
          const base = new Date(weekStart);
          const delta = (wd - base.getUTCDay() + 7) % 7;
          const occ = weekStart + delta * 86400000;
          if (occ > untilMs || occ > opts.windowEnd.getTime()) continue;
          if (count !== null && emitted >= count) break;
          push(occ);
          emitted++;
        }
      } else {
        push(cursor);
        emitted++;
      }
      cursor += stepMs;
    }
  };

  for (const line of lines) {
    const t = line.trim();
    if (t === "BEGIN:VEVENT") { inEvent = true; cur = {}; continue; }
    if (t === "END:VEVENT") { if (inEvent) { seen++; flush(); } inEvent = false; cur = {}; continue; }
    if (!inEvent) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const head = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const [nameRaw, ...paramParts] = head.split(";");
    const params: Record<string, string> = {};
    for (const p of paramParts) {
      const eq = p.indexOf("=");
      if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
    }
    cur[nameRaw.toUpperCase()] = { value, params };
  }

  busy.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return { busy, skippedRecurring, seen, ignored };
}
