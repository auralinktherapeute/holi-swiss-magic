import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  articleDates,
  formatPublishedDate,
  visibleArticleUpdate,
  formatLongDate,
  formatUpdatedLabel,
  latestTimestamp,
  listModified,
  pageModified,
  parseDbTimestamp,
  toZurichIso,
  zurichDayOf,
  zurichOffsetMinutes,
} from "./page-dates";

// Horodatages RÉELS relevés sur qqwud le 25/09/2026 (fiches actives).
const REAL = [
  "2026-09-25T14:35:42.775415+00:00", // emilie-chardon (la plus récente)
  "2026-09-25T14:31:47.76814+00:00",
  "2026-09-25T09:08:28.744876+00:00",
  "2026-09-25T08:51:45.282149+00:00",
];

afterEach(() => {
  vi.useRealTimers();
});

describe("parseDbTimestamp", () => {
  it("lit le format PostgREST, Z, espace et décalages variés", () => {
    const a = parseDbTimestamp("2026-09-25T14:35:42.775415+00:00");
    const b = parseDbTimestamp("2026-09-25T14:35:42.775415Z");
    const c = parseDbTimestamp("2026-09-25 16:35:42.775415+02:00");
    const d = parseDbTimestamp("2026-09-25T16:35:42.775415+0200");
    expect(a?.epochMs).toBe(Date.UTC(2026, 8, 25, 14, 35, 42, 775));
    expect(b?.epochMs).toBe(a?.epochMs);
    expect(c?.epochMs).toBe(a?.epochMs);
    expect(d?.epochMs).toBe(a?.epochMs);
    expect(a?.subMs).toBe(415);
  });

  it("sans décalage : lu comme UTC", () => {
    expect(parseDbTimestamp("2026-09-16T06:15:08.323137")?.epochMs).toBe(
      Date.UTC(2026, 8, 16, 6, 15, 8, 323),
    );
  });

  it("refuse null, vide, nombres, dates seules et dates impossibles", () => {
    for (const v of [null, undefined, "", 0, 1727000000000, "2026-09-25", "hier", "2026-02-30T10:00:00Z", "2026-13-01T00:00:00Z"]) {
      expect(parseDbTimestamp(v)).toBeNull();
    }
  });
});

describe("fuseau Europe/Zurich", () => {
  it("heure d'été / d'hiver : bascules du dernier dimanche de mars et d'octobre à 01:00 UTC", () => {
    // 2026 : 29 mars et 25 octobre.
    expect(zurichOffsetMinutes(Date.UTC(2026, 2, 29, 0, 59, 59))).toBe(60);
    expect(zurichOffsetMinutes(Date.UTC(2026, 2, 29, 1, 0, 0))).toBe(120);
    expect(zurichOffsetMinutes(Date.UTC(2026, 9, 25, 0, 59, 59))).toBe(120);
    expect(zurichOffsetMinutes(Date.UTC(2026, 9, 25, 1, 0, 0))).toBe(60);
    expect(zurichOffsetMinutes(Date.UTC(2026, 0, 15, 12))).toBe(60);
    expect(zurichOffsetMinutes(Date.UTC(2026, 6, 15, 12))).toBe(120);
  });

  it("23h30 UTC en été = lendemain à Zurich", () => {
    expect(zurichDayOf("2026-09-24T23:30:00+00:00")).toBe("2026-09-25");
    expect(zurichDayOf("2026-09-24T21:59:59.999+00:00")).toBe("2026-09-24");
    expect(zurichDayOf("2026-09-24T22:00:00+00:00")).toBe("2026-09-25");
  });

  it("23h30 UTC en hiver = lendemain aussi, mais 22h59 UTC reste le même jour", () => {
    expect(zurichDayOf("2026-12-31T23:30:00Z")).toBe("2027-01-01");
    expect(zurichDayOf("2026-12-31T22:59:59Z")).toBe("2026-12-31");
  });

  it("cas réel : article publié le 14/09 à 21:43 UTC → 14/09 à Zurich (23:43)", () => {
    expect(zurichDayOf("2026-09-14T21:43:19.352526+00:00")).toBe("2026-09-14");
    expect(toZurichIso("2026-09-14T21:43:19.352526+00:00")).toBe("2026-09-14T23:43:19.352526+02:00");
  });

  it("oracle : même jour que la base tz de l'ICU, heure par heure sur 2025–2027", () => {
    // Le module n'utilise pas l'ICU ; le test s'en sert seulement de témoin.
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Zurich",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const mismatches: string[] = [];
    for (let t = Date.UTC(2025, 0, 1); t < Date.UTC(2028, 0, 1); t += 3_600_000 / 2) {
      const iso = new Date(t).toISOString();
      if (zurichDayOf(iso) !== fmt.format(new Date(t))) mismatches.push(iso);
    }
    expect(mismatches).toEqual([]);
  });

  it("toZurichIso conserve l'instant et la fraction de la base", () => {
    expect(toZurichIso(REAL[0])).toBe("2026-09-25T16:35:42.775415+02:00");
    expect(toZurichIso("2026-01-10T08:00:00Z")).toBe("2026-01-10T09:00:00+01:00");
    expect(parseDbTimestamp(toZurichIso(REAL[0]))?.epochMs).toBe(parseDbTimestamp(REAL[0])?.epochMs);
  });

  it("la date du JSON-LD et le jour affiché coïncident, y compris autour de minuit", () => {
    for (const raw of [...REAL, "2026-09-24T23:30:00+00:00", "2026-12-31T23:30:00Z", "2026-03-29T00:30:00Z"]) {
      const m = pageModified(raw)!;
      expect(m.iso.slice(0, 10)).toBe(m.day);
    }
  });
});

describe("latestTimestamp / listModified", () => {
  it("renvoie la valeur brute la plus récente, quel que soit l'ordre", () => {
    expect(latestTimestamp([REAL[2], REAL[0], REAL[3], REAL[1]])).toBe(REAL[0]);
  });

  it("compare des instants, pas des chaînes (décalages différents)", () => {
    // 10:00+02:00 = 08:00Z, plus ancien que 09:00Z malgré un tri lexical inverse.
    expect(latestTimestamp(["2026-09-25T10:00:00+02:00", "2026-09-25T09:00:00Z"])).toBe(
      "2026-09-25T09:00:00Z",
    );
  });

  it("départage à la microseconde", () => {
    expect(latestTimestamp(["2026-09-25T09:08:28.472586+00:00", "2026-09-25T09:08:28.472999+00:00"])).toBe(
      "2026-09-25T09:08:28.472999+00:00",
    );
  });

  it("ignore null / illisible ; liste vide ou sans date → null", () => {
    expect(latestTimestamp([null, "n'importe quoi", REAL[3], undefined])).toBe(REAL[3]);
    expect(latestTimestamp([])).toBeNull();
    expect(latestTimestamp([null, undefined, ""])).toBeNull();
    expect(listModified([])).toBeNull();
    expect(listModified([{ updated_at: null }, {}])).toBeNull();
  });

  it("listModified lit la colonne demandée (bascule vers content_updated_at)", () => {
    const rows = [
      { updated_at: "2026-09-25T14:35:42Z", content_updated_at: "2026-08-01T10:00:00Z" },
      { updated_at: "2026-09-25T09:00:00Z", content_updated_at: null },
    ];
    expect(listModified(rows)?.day).toBe("2026-09-25");
    expect(listModified(rows, "content_updated_at")?.raw).toBe("2026-08-01T10:00:00Z");
    expect(listModified([{ updated_at: "2026-09-25T09:00:00Z" }], "content_updated_at")).toBeNull();
  });

  it("listModified sur les lignes réelles", () => {
    expect(listModified(REAL.map((updated_at) => ({ updated_at })))).toEqual({
      raw: REAL[0],
      iso: "2026-09-25T16:35:42.775415+02:00",
      day: "2026-09-25",
    });
  });
});

describe("articleDates", () => {
  it("publication et modification réelles", () => {
    const r = articleDates("2026-09-24T12:34:14.1+00:00", "2026-09-25T11:54:55.1284+00:00");
    expect(r.published?.day).toBe("2026-09-24");
    expect(r.modified?.iso).toBe("2026-09-25T13:54:55.1284+02:00");
  });

  it("pas de repli : sans updated_at, pas de dateModified", () => {
    expect(articleDates("2026-09-24T12:34:14.1+00:00", null).modified).toBeNull();
    expect(articleDates(null, null)).toEqual({ published: null, modified: null });
  });

  it("même jour que la publication : pas de ligne visible en double, dateModified conservée", () => {
    // Cas réel therapist_articles : updated_at = date_publication + 30 ms.
    const d = articleDates("2026-09-15T13:05:56.205+00:00", "2026-09-15T13:05:56.234193+00:00");
    expect(d.modified?.day).toBe("2026-09-15");
    expect(visibleArticleUpdate(d)).toBeNull();
    const later = articleDates("2026-09-24T12:34:14.1+00:00", "2026-09-25T11:54:55.1284+00:00");
    expect(visibleArticleUpdate(later)?.day).toBe("2026-09-25");
    expect(visibleArticleUpdate({ published: null, modified: later.modified })?.day).toBe("2026-09-25");
    expect(visibleArticleUpdate({ published: later.published, modified: null })).toBeNull();
  });

  it("date de publication au jour de Zurich", () => {
    expect(formatPublishedDate("2026-07-13T22:33:35.431+00:00", "fr")).toBe("14 juillet 2026");
    expect(formatPublishedDate(null, "fr")).toBe("");
  });

  it("modification antérieure à la publication → aucune dateModified", () => {
    expect(articleDates("2026-09-24T12:00:00Z", "2026-09-20T12:00:00Z").modified).toBeNull();
  });
});

describe("formatage 4 langues (sans Intl)", () => {
  it("date longue", () => {
    expect(formatLongDate("2026-09-25", "fr")).toBe("25 septembre 2026");
    expect(formatLongDate("2026-09-25", "de")).toBe("25. September 2026");
    expect(formatLongDate("2026-09-25", "it")).toBe("25 settembre 2026");
    expect(formatLongDate("2026-09-25", "en")).toBe("25 September 2026");
    expect(formatLongDate("2026-10-01", "fr")).toBe("1er octobre 2026");
    expect(formatLongDate("2026-10-01", "it")).toBe("1º ottobre 2026");
    expect(formatLongDate("2026-03-01", "de")).toBe("1. März 2026");
    expect(formatLongDate("2026-08-05", "fr")).toBe("5 août 2026");
  });

  it("libellé « Mis à jour le »", () => {
    expect(formatUpdatedLabel("2026-09-25", "fr")).toBe("Mis à jour le 25 septembre 2026");
    expect(formatUpdatedLabel("2026-09-25", "de")).toBe("Aktualisiert am 25. September 2026");
    expect(formatUpdatedLabel("2026-09-25", "it")).toBe("Aggiornato il 25 settembre 2026");
    expect(formatUpdatedLabel("2026-09-25", "en")).toBe("Updated 25 September 2026");
    expect(formatUpdatedLabel("2026-09-25", "xx")).toBe("Mis à jour le 25 septembre 2026");
  });

  it("jour absent ou illisible → chaîne vide (rien n'est affiché)", () => {
    expect(formatUpdatedLabel(null, "fr")).toBe("");
    expect(formatUpdatedLabel("", "de")).toBe("");
    expect(formatUpdatedLabel("25.09.2026", "it")).toBe("");
  });
});

describe("indépendance vis-à-vis de l'horloge", () => {
  it("les résultats ne changent pas quand l'horloge système change", () => {
    const before = [pageModified(REAL[0]), listModified(REAL.map((u) => ({ updated_at: u })))];
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2031-01-01T03:00:00Z"));
    const after = [pageModified(REAL[0]), listModified(REAL.map((u) => ({ updated_at: u })))];
    expect(after).toEqual(before);
    expect(pageModified(null)).toBeNull();
  });

  it("le module n'appelle jamais new Date() ni Date.now()", () => {
    const src = readFileSync(fileURLToPath(new URL("./page-dates.ts", import.meta.url)), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/new Date\(\s*\)/);
    expect(code).not.toMatch(/Date\.now\(/);
    expect(code).not.toMatch(/Intl\./);
    expect(code).not.toMatch(/toLocale/);
  });
});
