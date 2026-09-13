import { describe, expect, it } from "vitest";
import {
  PILLAR,
  PILLAR_LANGS,
  pillarHead,
  pillarUrl,
  isPillarLang,
} from "./visibility-pillar-content";

const FORBIDDEN = [
  /vérification automatique/i,
  /automatisch geprüft/i,
  /remboursement garanti/i,
  /garantie de remboursement/i,
  /partenaire officiel/i,
  /en partenariat avec (asca|rme|emr)/i,
  /certifié par holiswiss/i,
];

describe("page pilier visibilité — contenu", () => {
  it("expose exactement les trois slugs validés", () => {
    expect(PILLAR.fr.slug).toBe("visibilite-therapeute-suisse");
    expect(PILLAR.de.slug).toBe("sichtbarkeit-therapeuten-schweiz");
    expect(PILLAR.it.slug).toBe("visibilita-terapeuti-svizzera");
    expect([...PILLAR_LANGS]).toEqual(["fr", "de", "it"]);
    expect(isPillarLang("en")).toBe(false);
  });

  it("chaque langue a un H1, une intro, des sections et une FAQ", () => {
    for (const lang of PILLAR_LANGS) {
      const c = PILLAR[lang];
      expect(c.h1.length).toBeGreaterThan(20);
      expect(c.intro.length).toBeGreaterThan(0);
      expect(c.blocks.length).toBeGreaterThanOrEqual(4);
      expect(c.faq.length).toBeGreaterThanOrEqual(4);
      expect(c.title.length).toBeLessThanOrEqual(70);
      expect(c.description.length).toBeLessThanOrEqual(165);
    }
  });

  it("n'affirme ni vérification automatique, ni remboursement, ni partenariat", () => {
    for (const lang of PILLAR_LANGS) {
      const c = PILLAR[lang];
      const text = JSON.stringify(c);
      for (const re of FORBIDDEN) expect(text).not.toMatch(re);
    }
  });

  it("décrit les trois états de certification, sans promotion automatique", () => {
    expect(JSON.stringify(PILLAR.fr)).toContain("Déclaré par le thérapeute");
    expect(JSON.stringify(PILLAR.fr)).toContain("Justificatif examiné par Holiswiss");
    expect(JSON.stringify(PILLAR.fr)).toContain("Inscription confirmée auprès du registre");
    expect(JSON.stringify(PILLAR.de)).toContain("Nachweis von Holiswiss geprüft");
    expect(JSON.stringify(PILLAR.it)).toContain("Documento esaminato da Holiswiss");
  });

  it("ne promet aucune citation par une IA", () => {
    for (const lang of PILLAR_LANGS) {
      const faq = PILLAR[lang].faq.map((f) => `${f.q} ${f.a}`).join(" ");
      expect(faq).toMatch(/(garanti|garantieren|garantire)/i);
      expect(faq).toMatch(/(Non|Nein|No)\./);
    }
  });
});

describe("page pilier visibilité — head()", () => {
  it("canonical de production, auto-référent par langue", () => {
    for (const lang of PILLAR_LANGS) {
      const head = pillarHead(lang);
      const canonical = head.links.find((l) => l.rel === "canonical")!;
      expect(canonical.href).toBe(`https://holiswiss.ch/${lang}/${PILLAR[lang].slug}`);
      const ogUrl = head.meta.find((m) => "property" in m && m.property === "og:url")!;
      expect((ogUrl as { content: string }).content).toBe(canonical.href);
    }
  });

  it("hreflang : uniquement les trois variantes existantes + x-default", () => {
    const alts = pillarHead("de").links.filter((l) => l.rel === "alternate") as Array<{
      hrefLang: string;
      href: string;
    }>;
    expect(alts.map((a) => a.hrefLang)).toEqual(["fr", "de", "it", "x-default"]);
    expect(alts.find((a) => a.hrefLang === "fr")!.href).toBe(pillarUrl("fr"));
    expect(alts.find((a) => a.hrefLang === "x-default")!.href).toBe(pillarUrl("fr"));
    expect(alts.some((a) => a.hrefLang === "en")).toBe(false);
  });

  it("hreflang réciproques entre les trois langues", () => {
    for (const lang of PILLAR_LANGS) {
      const alts = pillarHead(lang).links.filter((l) => l.rel === "alternate") as Array<{
        hrefLang: string;
        href: string;
      }>;
      for (const other of PILLAR_LANGS) {
        expect(alts.find((a) => a.hrefLang === other)!.href).toBe(pillarUrl(other));
      }
    }
  });

  it("JSON-LD : WebPage + BreadcrumbList + FAQPage, liés aux entités existantes", () => {
    const head = pillarHead("fr");
    const graph = head.scripts.map((s) => JSON.parse(s.children));
    expect(graph.map((n) => n["@type"])).toEqual(["WebPage", "BreadcrumbList", "FAQPage"]);
    const [webPage, breadcrumb, faq] = graph;
    expect(webPage.publisher["@id"]).toBe("https://holiswiss.ch/#organization");
    expect(webPage.isPartOf["@id"]).toBe("https://holiswiss.ch/#website");
    // Aucune organisation dupliquée : uniquement des références @id.
    expect(JSON.stringify(webPage)).not.toContain('"@type":"Organization"');
    expect(breadcrumb.itemListElement).toHaveLength(2);
    expect(breadcrumb.itemListElement[1].item).toBe(pillarUrl("fr"));
    // Le balisage FAQ reprend exactement les questions visibles de la page.
    expect(faq.mainEntity.map((q: { name: string }) => q.name)).toEqual(
      PILLAR.fr.faq.map((f) => f.q),
    );
    expect(faq.mainEntity.map((q: { acceptedAnswer: { text: string } }) => q.acceptedAnswer.text)).toEqual(
      PILLAR.fr.faq.map((f) => f.a),
    );
  });

  it("aucun balisage Article (pas de date de publication à affirmer)", () => {
    for (const lang of PILLAR_LANGS) {
      const types = pillarHead(lang).scripts.map((s) => JSON.parse(s.children)["@type"]);
      expect(types).not.toContain("Article");
    }
  });
});
