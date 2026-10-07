import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { completeSocialHtml } from "./social-meta-html";
import { checkTranslation, completeLangs } from "./article-translation";

const page = (lang: string, canonical: string, extra = "") =>
  `<html lang="${lang}"><head><title>Titre ${lang}</title><meta name="description" content="Desc ${lang}"/><meta property="og:locale" content="fr_CH"/><link rel="canonical" href="${canonical}"/>${extra}</head><body></body></html>`;

describe("balises de partage", () => {
  it("page DE canonique d'elle-même : og:locale de_CH + twitter depuis ses propres textes", () => {
    const out = completeSocialHtml(page("de", "https://holiswiss.ch/de/blog/x"));
    expect(out).toContain('property="og:locale" content="de_CH"');
    expect(out).toContain('name="twitter:title" content="Titre de"');
    expect(out).toContain('name="twitter:description" content="Desc de"');
    expect(out).toContain('name="twitter:card" content="summary"');
  });
  it("variante qui renvoie vers le français (profil) : og:locale reste fr_CH", () => {
    const out = completeSocialHtml(page("de", "https://holiswiss.ch/fr/therapeute/x"));
    expect(out).toContain('content="fr_CH"');
    expect(out).not.toContain("de_CH");
  });
  it("ne remplace jamais une valeur posée par la page", () => {
    const out = completeSocialHtml(page("it", "https://holiswiss.ch/it/x", '<meta name="twitter:title" content="Propre"/><meta property="og:image" content="i"/>'));
    expect(out.match(/twitter:title/g)?.length).toBe(1);
    expect(out).toContain('content="summary_large_image"');
  });
});

describe("Fil Holiswiss multilingue", () => {
  const src = readFileSync("src/lib/fil.functions.ts", "utf8");
  it("métadonnées de la langue servie, jamais celles du français", () => {
    expect(src).not.toContain("seoTitle: (row.meta_title_fr");
    expect(src).toContain("meta_title_${lang}");
  });
  it("page : incomplète → noindex + canonique FR, hreflang seulement entre versions complètes", () => {
    const r = readFileSync("src/routes/$lang.fil-holiswiss.$slug.tsx", "utf8");
    expect(r).toContain('"noindex,follow"');
    expect(r).toContain("canonical\", href: frUrl");
    expect(r).toContain("post.completeLangs");
  });
  it("plan du site : uniquement les langues complètes", () => {
    const s = readFileSync("src/lib/sitemap-build.server.ts", "utf8");
    expect(s).toContain("completeLangs(a as Record<string, unknown>)");
  });
  it("une variante sans meta title localisé n'est pas complète", () => {
    const row = { title_fr: "Bonjour", excerpt_fr: "Résumé", body_fr: "Texte", meta_title_fr: "T", meta_description_fr: "D",
      title_de: "Hallo Welt", excerpt_de: "Zusammenfassung", body_de: "Ein Text auf Deutsch", meta_title_de: "", meta_description_de: "Beschreibung" };
    expect(checkTranslation(row, "de").complete).toBe(false);
    expect(completeLangs(row)).not.toContain("de");
  });
});

describe("Contact", () => {
  it("titres distincts par langue", () => {
    const s = readFileSync("src/routes/$lang.contact.index.tsx", "utf8");
    const titles = [...s.matchAll(/^\s+(fr|de|it|en): "([^"]+— Holiswiss)"/gm)].map((m) => m[2]);
    expect(new Set(titles).size).toBe(4);
  });
});
