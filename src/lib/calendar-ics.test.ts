import { describe, it, expect } from "vitest";
import {
  buildIcs, escapeIcsText, foldIcsLine, toIcsUtc, unfoldIcs, parseIcsBusy, appointmentSummary, localDateTimeToUtc,
} from "./calendar-ics";

const STAMP = new Date(Date.UTC(2026, 7, 27, 9, 0, 0));
const WIN = {
  windowStart: new Date(Date.UTC(2026, 0, 1)),
  windowEnd: new Date(Date.UTC(2027, 0, 1)),
};

describe("écriture iCal", () => {
  it("échappe l'antislash avant le reste, sinon on ré-échappe", () => {
    expect(escapeIcsText("a\\b;c,d")).toBe("a\\\\b\\;c\\,d");
    expect(escapeIcsText("ligne1\nligne2")).toBe("ligne1\\nligne2");
  });

  it("plie à 75 OCTETS, pas 75 caractères", () => {
    // « é » pèse 2 octets : compter en caractères produirait une ligne trop
    // longue, que certains clients tronquent.
    const line = "SUMMARY:" + "é".repeat(60);
    const folded = foldIcsLine(line);
    for (const l of folded.split("\r\n")) {
      expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    }
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });

  it("ne plie pas une ligne courte", () => {
    expect(foldIcsLine("SUMMARY:Marie")).toBe("SUMMARY:Marie");
  });

  it("écrit les instants en UTC", () => {
    expect(toIcsUtc(new Date(Date.UTC(2026, 0, 5, 8, 30, 0)))).toBe("20260105T083000Z");
  });

  it("produit un flux clos et en CRLF", () => {
    const ics = buildIcs(
      [{
        uid: "rdv-1", summary: "Marie — Suivi",
        start: new Date(Date.UTC(2026, 8, 1, 7, 0)),
        end: new Date(Date.UTC(2026, 8, 1, 8, 0)),
      }],
      { name: "Holiswiss", stamp: STAMP },
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("\r\n");
    expect(ics.split("\r\n").filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
    expect(ics).toContain("DTSTART:20260901T070000Z");
  });

  it("n'écrit aucune donnée non fournie", () => {
    // Le flux d'export ne doit jamais porter e-mail, téléphone ni notes.
    const ics = buildIcs(
      [{
        uid: "u", summary: "Marie — Première séance",
        start: new Date(Date.UTC(2026, 8, 1, 7, 0)), end: new Date(Date.UTC(2026, 8, 1, 8, 0)),
      }],
      { name: "Holiswiss", stamp: STAMP },
    );
    expect(ics).not.toMatch(/@/);
    expect(ics).not.toMatch(/ATTENDEE|DESCRIPTION/);
  });
});

describe("lecture iCal — périodes occupées", () => {
  const wrap = (body: string) =>
    `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR\r\n`;

  it("déplie les lignes de continuation", () => {
    expect(unfoldIcs("SUMMARY:abc\r\n def")).toEqual(["SUMMARY:abcdef"]);
  });

  it("lit un événement simple en UTC", () => {
    const { busy } = parseIcsBusy(wrap(
      "BEGIN:VEVENT\r\nUID:a\r\nDTSTART:20260901T070000Z\r\nDTEND:20260901T080000Z\r\nEND:VEVENT",
    ), WIN);
    expect(busy).toHaveLength(1);
    expect(busy[0].startsAt.toISOString()).toBe("2026-09-01T07:00:00.000Z");
  });

  it("convertit une heure locale TZID en UTC", () => {
    // 1er septembre, Europe/Zurich = UTC+2 (heure d'été). 09:00 local = 07:00Z.
    // Sans conversion, le créneau serait bloqué deux heures trop tard.
    const { busy } = parseIcsBusy(wrap(
      "BEGIN:VEVENT\r\nUID:b\r\nDTSTART;TZID=Europe/Zurich:20260901T090000\r\n" +
      "DTEND;TZID=Europe/Zurich:20260901T100000\r\nEND:VEVENT",
    ), WIN);
    expect(busy[0].startsAt.toISOString()).toBe("2026-09-01T07:00:00.000Z");
  });

  it("tient compte du changement d'heure", () => {
    // 1er janvier : UTC+1. Le même 09:00 local vaut 08:00Z, pas 07:00Z.
    const { busy } = parseIcsBusy(wrap(
      "BEGIN:VEVENT\r\nUID:c\r\nDTSTART;TZID=Europe/Zurich:20260115T090000\r\n" +
      "DTEND;TZID=Europe/Zurich:20260115T100000\r\nEND:VEVENT",
    ), WIN);
    expect(busy[0].startsAt.toISOString()).toBe("2026-01-15T08:00:00.000Z");
  });

  it("accepte DURATION à la place de DTEND", () => {
    const { busy } = parseIcsBusy(wrap(
      "BEGIN:VEVENT\r\nUID:d\r\nDTSTART:20260901T070000Z\r\nDURATION:PT1H30M\r\nEND:VEVENT",
    ), WIN);
    expect(busy[0].endsAt.toISOString()).toBe("2026-09-01T08:30:00.000Z");
  });

  it("ignore un créneau marqué comme n'occupant pas le temps", () => {
    // Bloquer un TRANSPARENT priverait le praticien de plages réellement libres.
    const { busy } = parseIcsBusy(wrap(
      "BEGIN:VEVENT\r\nUID:e\r\nDTSTART:20260901T070000Z\r\nDTEND:20260901T080000Z\r\n" +
      "TRANSP:TRANSPARENT\r\nEND:VEVENT",
    ), WIN);
    expect(busy).toHaveLength(0);
  });

  it("ignore un événement annulé", () => {
    const { busy } = parseIcsBusy(wrap(
      "BEGIN:VEVENT\r\nUID:f\r\nDTSTART:20260901T070000Z\r\nDTEND:20260901T080000Z\r\n" +
      "STATUS:CANCELLED\r\nEND:VEVENT",
    ), WIN);
    expect(busy).toHaveLength(0);
  });

  it("développe une récurrence hebdomadaire bornée par COUNT", () => {
    const { busy } = parseIcsBusy(wrap(
      "BEGIN:VEVENT\r\nUID:g\r\nDTSTART:20260901T070000Z\r\nDTEND:20260901T080000Z\r\n" +
      "RRULE:FREQ=WEEKLY;COUNT=3\r\nEND:VEVENT",
    ), WIN);
    expect(busy).toHaveLength(3);
    expect(busy.map((b) => b.startsAt.toISOString().slice(0, 10)))
      .toEqual(["2026-09-01", "2026-09-08", "2026-09-15"]);
  });

  it("respecte UNTIL", () => {
    const { busy } = parseIcsBusy(wrap(
      "BEGIN:VEVENT\r\nUID:h\r\nDTSTART:20260901T070000Z\r\nDTEND:20260901T080000Z\r\n" +
      "RRULE:FREQ=DAILY;UNTIL=20260903T235959Z\r\nEND:VEVENT",
    ), WIN);
    expect(busy).toHaveLength(3);
  });

  it("borne une récurrence sans fin sur la fenêtre demandée", () => {
    // `FREQ=WEEKLY` seul est infini : sans borne, la boucle ne rendrait jamais.
    const { busy } = parseIcsBusy(wrap(
      "BEGIN:VEVENT\r\nUID:i\r\nDTSTART:20260901T070000Z\r\nDTEND:20260901T080000Z\r\n" +
      "RRULE:FREQ=WEEKLY\r\nEND:VEVENT",
    ), { windowStart: new Date(Date.UTC(2026, 7, 1)), windowEnd: new Date(Date.UTC(2026, 9, 1)) });
    expect(busy.length).toBeGreaterThan(3);
    expect(busy.length).toBeLessThan(10);
    for (const b of busy) expect(b.startsAt.getTime()).toBeLessThan(Date.UTC(2026, 9, 1));
  });

  it("signale les récurrences non développées au lieu de les taire", () => {
    // Un créneau manqué est un double booking : le praticien doit le savoir.
    const r = parseIcsBusy(wrap(
      "BEGIN:VEVENT\r\nUID:j\r\nDTSTART:20260901T070000Z\r\nDTEND:20260901T080000Z\r\n" +
      "RRULE:FREQ=MONTHLY\r\nEND:VEVENT",
    ), WIN);
    expect(r.skippedRecurring).toBe(1);
    expect(r.busy).toHaveLength(1); // la première occurrence reste bloquée
  });

  it("traite une date seule comme une journée entière", () => {
    const { busy } = parseIcsBusy(wrap(
      "BEGIN:VEVENT\r\nUID:k\r\nDTSTART;VALUE=DATE:20260901\r\nEND:VEVENT",
    ), WIN);
    expect(busy).toHaveLength(1);
    expect(busy[0].endsAt.getTime() - busy[0].startsAt.getTime()).toBe(86400000);
  });

  it("écarte les événements hors fenêtre", () => {
    const { busy } = parseIcsBusy(wrap(
      "BEGIN:VEVENT\r\nUID:l\r\nDTSTART:20200901T070000Z\r\nDTEND:20200901T080000Z\r\nEND:VEVENT",
    ), WIN);
    expect(busy).toHaveLength(0);
  });

  it("compte ce qu'il a vu et ce qu'il a écarté", () => {
    // Sans ces compteurs, un import qui rend zéro créneau est indiscernable
    // d'une panne. Cas réel du 27/08/2026 : le calendrier des jours fériés
    // suisses de Google contient 325 événements, TOUS transparents — un jour
    // férié ne rend pas indisponible. Zéro créneau y est la bonne réponse,
    // encore faut-il pouvoir l'expliquer au praticien.
    const r = parseIcsBusy(wrap(
      "BEGIN:VEVENT\r\nUID:t1\r\nDTSTART;VALUE=DATE:20260801\r\nDTEND;VALUE=DATE:20260802\r\n" +
      "TRANSP:TRANSPARENT\r\nEND:VEVENT\r\n" +
      "BEGIN:VEVENT\r\nUID:t2\r\nDTSTART:20260901T070000Z\r\nDTEND:20260901T080000Z\r\nEND:VEVENT",
    ), WIN);
    expect(r.seen).toBe(2);
    expect(r.ignored).toBe(1);
    expect(r.busy).toHaveLength(1);
  });

  it("distingue un flux vide d'un flux entièrement transparent", () => {
    const vide = parseIcsBusy(wrap(""), WIN);
    expect(vide.seen).toBe(0);
    expect(vide.ignored).toBe(0);
  });

  it("ne rend rien sur un flux vide ou illisible", () => {
    expect(parseIcsBusy("", WIN).busy).toHaveLength(0);
    expect(parseIcsBusy("ceci n'est pas un agenda", WIN).busy).toHaveLength(0);
  });

  it("relit ce qu'il a écrit", () => {
    const ics = buildIcs(
      [{
        uid: "aller-retour", summary: "Marie — Suivi",
        start: new Date(Date.UTC(2026, 8, 1, 7, 0)), end: new Date(Date.UTC(2026, 8, 1, 8, 0)),
      }],
      { name: "Holiswiss", stamp: STAMP },
    );
    const { busy } = parseIcsBusy(ics, WIN);
    expect(busy).toHaveLength(1);
    expect(busy[0].startsAt.toISOString()).toBe("2026-09-01T07:00:00.000Z");
    expect(busy[0].endsAt.toISOString()).toBe("2026-09-01T08:00:00.000Z");
  });
});

describe("appointmentSummary — ce qui sort dans le flux", () => {
  it("ne garde que le prénom", () => {
    // Le nom de famille ne doit jamais quitter Holiswiss par le flux iCal.
    expect(appointmentSummary("Marie Dubois", "Suivi")).toBe("Marie — Suivi");
    expect(appointmentSummary("Marie Dubois", "Suivi")).not.toContain("Dubois");
  });

  it("gère les prénoms composés et les espaces superflus", () => {
    expect(appointmentSummary("  Jean-Pierre  Rey ", "Première séance"))
      .toBe("Jean-Pierre — Première séance");
  });

  it("reste lisible quand une donnée manque", () => {
    expect(appointmentSummary("Marie", null)).toBe("Marie");
    expect(appointmentSummary(null, "Suivi")).toBe("Suivi");
    expect(appointmentSummary(null, null)).toBe("Réservé");
    expect(appointmentSummary("   ", "  ")).toBe("Réservé");
  });

  it("ne laisse passer ni e-mail ni téléphone même s'ils sont dans le nom", () => {
    // Garde-fou : un nom saisi de travers ne doit pas devenir une fuite.
    const s = appointmentSummary("Marie marie@example.com +41791234567", "Suivi");
    expect(s).toBe("Marie — Suivi");
    expect(s).not.toMatch(/@|\+41/);
  });
});

describe("localDateTimeToUtc — heure murale suisse → UTC", () => {
  it("applique l'heure d'été", () => {
    // 1er septembre, Europe/Zurich = UTC+2.
    expect(localDateTimeToUtc("2026-09-01", "09:00")?.toISOString()).toBe("2026-09-01T07:00:00.000Z");
  });

  it("applique l'heure d'hiver", () => {
    expect(localDateTimeToUtc("2026-01-15", "09:00")?.toISOString()).toBe("2026-01-15T08:00:00.000Z");
  });

  it("accepte les secondes et une heure sur un chiffre", () => {
    expect(localDateTimeToUtc("2026-09-01", "9:30:00")?.toISOString()).toBe("2026-09-01T07:30:00.000Z");
  });

  it("suppose minuit si l'heure manque", () => {
    expect(localDateTimeToUtc("2026-09-01", null)?.toISOString()).toBe("2026-08-31T22:00:00.000Z");
  });

  it("rend null sur une entrée illisible plutôt qu'une date fausse", () => {
    expect(localDateTimeToUtc("", "09:00")).toBeNull();
    expect(localDateTimeToUtc("2026-09-01", "midi")).toBeNull();
  });
});
