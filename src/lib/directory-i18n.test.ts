import { describe, it, expect } from "vitest";
import fr from "@/i18n/fr.json";
import de from "@/i18n/de.json";
import itJson from "@/i18n/it.json";
import en from "@/i18n/en.json";
import { createI18nForLang, SUPPORTED_LANGS } from "./i18n";

/**
 * Libellés de l'annuaire (/$lang/therapeutes) — restés en dur en français
 * jusqu'au 29/09/2026 (« Filtre actif », « Liste », « Carte », « pour »,
 * « autour de », « Thérapeutes par région »…).
 */
const FILES = { fr, de, it: itJson, en } as unknown as Record<string, Record<string, Record<string, string>>>;
const NAMESPACES = ["therapists_directory", "footer"] as const;

describe("libellés de l'annuaire — i18n", () => {
  for (const ns of NAMESPACES) {
    it(`« ${ns} » a exactement les mêmes clés dans les 4 langues`, () => {
      const ref = Object.keys(FILES.fr[ns]).sort();
      for (const lang of SUPPORTED_LANGS) {
        expect(Object.keys(FILES[lang][ns]).sort(), lang).toEqual(ref);
        for (const k of ref) expect(FILES[lang][ns][k], `${lang}.${ns}.${k}`).toBeTruthy();
      }
    });
  }

  it("aucune clé de l'annuaire ne retombe sur le français hors FR", () => {
    const keys = ["active_filter", "clear_filters", "view_map", "results_for", "results_near"];
    for (const lang of ["de", "it", "en"] as const) {
      const i = createI18nForLang(lang);
      for (const k of keys) {
        expect(i.t(`therapists_directory.${k}`), `${lang}.${k}`).not.toBe(
          FILES.fr.therapists_directory[k],
        );
      }
      expect(i.t("footer.by_region")).not.toBe(FILES.fr.footer.by_region);
    }
  });

  it("le compteur utilise les pluriels i18next de chaque langue", () => {
    const cases: Record<string, [number, string][]> = {
      fr: [[0, "0 thérapeute"], [1, "1 thérapeute"], [2, "2 thérapeutes"]],
      de: [[0, "0 Therapeuten"], [1, "1 Therapeut"], [12, "12 Therapeuten"]],
      it: [[0, "0 terapeuti"], [1, "1 terapeuta"], [3, "3 terapeuti"]],
      en: [[0, "0 therapists"], [1, "1 therapist"], [5, "5 therapists"]],
    };
    for (const [lang, rows] of Object.entries(cases)) {
      const i = createI18nForLang(lang as (typeof SUPPORTED_LANGS)[number]);
      for (const [count, expected] of rows) {
        expect(i.t("therapists_directory.results_count", { count }), `${lang} ${count}`).toBe(expected);
      }
    }
  });
});

describe("annuaire : aucun libellé d'interface en dur en français", () => {
  it("les libellés traduits ne reviennent pas en dur dans la route", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(
      fileURLToPath(new URL("../routes/$lang.therapeutes.index.tsx", import.meta.url)),
      "utf8",
    );
    // « Tous les thérapeutes » n'est pas listé : c'est l'entrée `fr` de la table
    // localisée DIRECTORY_INDEX_TITLE, pas un libellé en dur.
    for (const s of ["Filtre actif", "autour de", '"Liste"', '"Carte"', ">Liste<", ">Carte<"]) {
      expect(src, s).not.toContain(s);
    }
  });
});
