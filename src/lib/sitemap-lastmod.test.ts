import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { articleLastmod, contentDay, paroleLastmod } from "./sitemap-lastmod";

describe("contentDay", () => {
  it("lit content_updated_at, jamais updated_at", () => {
    // Cas réel du 25/09/2026 : updated_at avancé par la traduction automatique.
    const row = { content_updated_at: "2026-07-07T11:56:26.624522+00:00", updated_at: "2026-09-25T14:35:42Z" };
    expect(contentDay(row)).toBe("2026-07-07");
    expect(contentDay({ updated_at: "2026-09-25T14:35:42Z" } as never)).toBeUndefined();
    expect(contentDay({ content_updated_at: null })).toBeUndefined();
    expect(contentDay(null)).toBeUndefined();
  });

  it("jour de Zurich, comme la date affichée sur la page", () => {
    // 22:33 UTC le 13/07 = 00:33 le 14/07 à Zurich (heure d'été).
    expect(contentDay({ content_updated_at: "2026-07-13T22:33:35.431+00:00" })).toBe("2026-07-14");
    // 23:30 UTC le 15/01 = 00:30 le 16/01 à Zurich (heure d'hiver).
    expect(contentDay({ content_updated_at: "2026-01-15T23:30:00+00:00" })).toBe("2026-01-16");
    expect(contentDay({ content_updated_at: "2026-01-15T22:59:59+00:00" })).toBe("2026-01-15");
  });

  it("valeur illisible → undefined (aucun lastmod plutôt qu'un faux)", () => {
    expect(contentDay({ content_updated_at: "n'importe quoi" })).toBeUndefined();
  });
});

describe("articleLastmod / paroleLastmod", () => {
  it("date éditoriale en priorité", () => {
    expect(
      articleLastmod({ content_updated_at: "2026-08-25T12:11:15Z", published_at: "2026-06-29T10:04:36Z" }),
    ).toBe("2026-08-25");
    expect(
      paroleLastmod({ content_updated_at: "2026-09-15T13:05:56.205Z", date_publication: "2026-09-10T08:00:00Z" }),
    ).toBe("2026-09-15");
  });

  it("repli sur la date de publication, jamais sur updated_at", () => {
    expect(articleLastmod({ content_updated_at: null, published_at: "2026-06-29T10:04:36Z" })).toBe("2026-06-29");
    expect(paroleLastmod({ content_updated_at: null, date_publication: "2026-09-10T08:00:00Z" })).toBe("2026-09-10");
    expect(articleLastmod({ content_updated_at: null, published_at: null })).toBeUndefined();
  });
});

describe("sitemap : plus aucune lecture de updated_at pour les contenus éditoriaux", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../routes/sitemap[.]xml.ts", import.meta.url)),
    "utf8",
  );

  it("therapists, articles et therapist_articles sont lus via CONTENT_DATE_COLUMN", () => {
    for (const table of ["therapists", "articles", "therapist_articles"]) {
      const re = new RegExp(`from\\("${table}"\\)\\s*\\.select\\(([^)]*)\\)`, "g");
      const selects = [...src.matchAll(re)].map((m) => m[1]);
      expect(selects.length, table).toBeGreaterThan(0);
      for (const sel of selects) {
        expect(sel, `${table} : ${sel}`).toContain("CONTENT_DATE_COLUMN");
        expect(sel, `${table} : ${sel}`).not.toMatch(/\bupdated_at\b/);
      }
    }
  });
});
