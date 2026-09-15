import { describe, it, expect } from "vitest";
import i18nSingleton, { createI18nForLang, detectLangFromPath, SUPPORTED_LANGS } from "./i18n";

/**
 * Régression 15/09/2026 — le rendu serveur partageait UNE instance i18next entre
 * toutes les requêtes : 8 GET parallèles sur /fr, /de et /it renvoyaient le même
 * menu, dans la langue de la dernière requête à avoir appelé changeLanguage().
 */
describe("isolation i18n par requête (SSR)", () => {
  it("déduit la langue du premier segment d'URL, sinon FR", () => {
    expect(detectLangFromPath("/fr/specialites/reiki")).toBe("fr");
    expect(detectLangFromPath("/de/blog/yoga")).toBe("de");
    expect(detectLangFromPath("/it/specialites/reiki")).toBe("it");
    expect(detectLangFromPath("/en")).toBe("en");
    expect(detectLangFromPath("/therapeutes")).toBe("fr");
    expect(detectLangFromPath("")).toBe("fr");
    expect(detectLangFromPath(undefined)).toBe("fr");
  });

  it("chaque instance garde sa langue quand une autre change de langue", async () => {
    const fr = createI18nForLang("fr");
    const it = createI18nForLang("it");
    expect(fr.t("nav.therapistSpace")).toBe("Espace thérapeutes");
    expect(it.t("nav.therapistSpace")).toBe("Area terapeuti");

    await it.changeLanguage("de");
    // L'instance FR est intacte : c'est exactement ce qui échouait avant.
    expect(fr.t("nav.therapistSpace")).toBe("Espace thérapeutes");
    expect(fr.language).toBe("fr");
  });

  it("n'altère jamais le singleton, même sous requêtes entrelacées", async () => {
    const before = i18nSingleton.language;
    const instances = SUPPORTED_LANGS.map((l) => createI18nForLang(l));
    await Promise.all(instances.map((inst, i) => inst.changeLanguage(SUPPORTED_LANGS[i])));
    expect(i18nSingleton.language).toBe(before);
  });

  it("8 rendus simultanés entrelacés restituent chacun leur langue", async () => {
    const plan = ["fr", "de", "it", "fr", "en", "it", "de", "fr"] as const;
    const results = await Promise.all(
      plan.map(async (lang, i) => {
        const inst = createI18nForLang(lang);
        // Entrelacement réel : chaque « requête » rend son menu après une pause.
        await new Promise((r) => setTimeout(r, (i % 3) * 5));
        return { lang, nav: inst.t("nav.therapists"), cta: inst.t("nav.therapistSpace") };
      }),
    );
    const expected: Record<string, string> = {
      fr: "Thérapeutes",
      de: "Therapeuten",
      it: "Terapeuti",
      en: "Therapists",
    };
    for (const r of results) expect(r.nav).toBe(expected[r.lang]);
    expect(new Set(results.map((r) => r.cta)).size).toBe(4);
  });
});
