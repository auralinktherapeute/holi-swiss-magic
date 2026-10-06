import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  articleIndexing,
  checkTranslation,
  cleanInlineText,
  completeLangs,
  isTranslationComplete,
} from "./article-translation";
import { groupBlocks, partForLoc, sitemapIndexXml, SITEMAP_PARTS } from "./sitemap-groups";

const frBody =
  "La sophrologie est une méthode douce pour vous aider à gérer le stress dans votre quotidien. Elle combine respiration et détente musculaire pour les personnes qui le souhaitent.";
const base: Record<string, unknown> = {
  slug: "sophrologie-stress",
  slug_de: "sophrologie-stress-de",
  title_fr: "Sophrologie et stress",
  excerpt_fr: "Une méthode douce pour gérer le stress.",
  body_fr: frBody,
  meta_title_fr: "Sophrologie et stress",
  meta_description_fr: "Une méthode douce pour gérer le stress.",
  title_de: "Sophrologie und Stress",
  excerpt_de: "Eine sanfte Methode zur Stressbewältigung.",
  body_de:
    "Sophrologie ist eine sanfte Methode, die Ihnen hilft, Stress im Alltag zu bewältigen. Sie verbindet Atmung und Muskelentspannung für Menschen, die dies wünschen, ganz ohne Druck.",
  meta_title_de: "Sophrologie und Stress",
  meta_description_de: "Eine sanfte Methode zur Stressbewältigung im Alltag.",
  // IT : simple repli français
  title_it: "Sophrologie et stress",
  body_it: frBody,
  excerpt_it: "Une méthode douce pour gérer le stress.",
  meta_title_it: "Sophrologie et stress",
  meta_description_it: "Une méthode douce.",
  // EN : titre avec Markdown, meta manquante
  title_en: "## Sophrology and stress",
  body_en:
    "Sophrology is a gentle method that helps you manage stress in everyday life. It combines breathing and muscle relaxation for people who want it, without any pressure at all.",
  excerpt_en: "A gentle method to manage stress.",
  meta_title_en: "",
  meta_description_en: "A gentle method to manage stress.",
};

describe("translation_complete", () => {
  it("variante complète", () => {
    expect(isTranslationComplete(base, "fr")).toBe(true);
    expect(isTranslationComplete(base, "de")).toBe(true);
  });
  it("repli français = incomplet", () => {
    const r = checkTranslation(base, "it");
    expect(r.complete).toBe(false);
    expect(r.reasons).toContain("corps identique au français");
  });
  it("Markdown parasite et meta manquante = incomplet", () => {
    const r = checkTranslation(base, "en");
    expect(r.reasons).toEqual(expect.arrayContaining(["Markdown dans titre", "meta title manquant"]));
  });
  it("français résiduel détecté", () => {
    const a = { ...base, body_de: base.body_de + " " + frBody + " " + frBody };
    expect(checkTranslation(a, "de").reasons.some((x) => x.startsWith("français résiduel"))).toBe(true);
  });
  it("cleanInlineText retire « ## » et le gras", () => {
    expect(cleanInlineText("## **Titre** propre")).toBe("Titre propre");
  });
});

describe("canonical, noindex, hreflang", () => {
  it("complète : index, canonical propre, hreflang réciproques + x-default FR", () => {
    const de = articleIndexing(base, "de");
    expect(de.robots).toBe("index,follow");
    expect(de.canonical).toBe("https://holiswiss.ch/de/blog/sophrologie-stress-de");
    const fr = articleIndexing(base, "fr");
    expect(fr.alternates).toEqual(de.alternates);
    expect(de.alternates.map((x) => x.hreflang)).toEqual(["fr", "de", "x-default"]);
    expect(de.alternates.at(-1)?.href).toBe("https://holiswiss.ch/fr/blog/sophrologie-stress");
  });
  it("incomplète : noindex,follow, canonical vers FR, aucun hreflang", () => {
    const it_ = articleIndexing(base, "it");
    expect(it_.robots).toBe("noindex,follow");
    expect(it_.canonical).toBe("https://holiswiss.ch/fr/blog/sophrologie-stress");
    expect(it_.alternates).toEqual([]);
  });
  it("aucune variante incomplète déclarée", () => {
    expect(completeLangs(base)).toEqual(["fr", "de"]);
  });
});

describe("sitemaps séparés", () => {
  it("classe chaque URL dans la bonne partie", () => {
    expect(partForLoc("https://holiswiss.ch/de/blog/x")).toBe("articles-de");
    expect(partForLoc("https://holiswiss.ch/fr/blog/categorie/x")).toBe("pages");
    expect(partForLoc("https://holiswiss.ch/fr/therapeute/henry-gerald")).toBe("profils");
    expect(partForLoc("https://holiswiss.ch/fr/therapeutes/canton/ge")).toBe("annuaire");
    expect(partForLoc("https://holiswiss.ch/fr/specialites/reiki")).toBe("annuaire");
    expect(partForLoc("https://holiswiss.ch/fr/tarifs")).toBe("pages");
  });
  it("l'index liste les parties non vides avec leur lastmod", () => {
    const g = groupBlocks([
      "  <url>\n    <loc>https://holiswiss.ch/fr/blog/a</loc>\n    <lastmod>2026-09-01</lastmod>\n  </url>",
      "  <url>\n    <loc>https://holiswiss.ch/fr/tarifs</loc>\n  </url>",
    ]);
    const xml = sitemapIndexXml(g);
    expect(xml).toContain("<loc>https://holiswiss.ch/sitemaps/articles-fr.xml</loc>\n    <lastmod>2026-09-01</lastmod>");
    expect(xml).toContain("/sitemaps/pages.xml</loc>\n  </sitemap>");
    expect(xml).not.toContain("articles-de");
    expect(SITEMAP_PARTS).toHaveLength(7);
  });
  it("le générateur ne déclare que les variantes complètes", () => {
    const src = readFileSync("src/lib/sitemap-build.server.ts", "utf8");
    expect(src).toMatch(/for \(const lang of completeLangs\(row\)\)/);
  });
});

describe("variante étrangère incomplète", () => {
  it("champs vides = incomplète, retirée des hreflang", () => {
    const a = { ...base, title_de: " ", excerpt_de: "", body_de: "", meta_title_de: "", meta_description_de: "" };
    expect(checkTranslation(a, "de").complete).toBe(false);
    expect(articleIndexing(a, "de").robots).toBe("noindex,follow");
    expect(completeLangs(a)).toEqual(["fr"]);
    expect(articleIndexing(a, "fr").robots).toBe("index,follow");
  });
  it("la page n'affiche jamais le corps français sous une URL étrangère incomplète", () => {
    const src = readFileSync("src/routes/$lang.blog.$slug.tsx", "utf8");
    expect(src).toMatch(/l !== "fr" && !checkTranslation\(raw, l\)\.complete/);
    expect(src).toMatch(/lang !== "fr" && !indexing\.complete/);
  });
});

describe("redirections d'anciens slugs", () => {
  it("la page article redirige en 301 un slug de base vers le slug localisé", () => {
    const src = readFileSync("src/routes/$lang.blog.$slug.tsx", "utf8");
    expect(src).toMatch(/canonicalSlug !== params\.slug[\s\S]{0,400}statusCode: 301/);
  });
});
