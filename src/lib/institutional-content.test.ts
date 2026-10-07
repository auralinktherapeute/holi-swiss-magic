import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { aboutHead, INSTITUTION, institutionalCopy, legalHead } from "./institutional-content";
import { getOrganizationNode, LOGO_URL } from "./organization-schema";
import { LANGS } from "./seo";
import { buildTrustBadges } from "./therapist-badges";

describe("identité institutionnelle validée", () => {
  it("conserve les seuls faits validés", () => {
    expect(INSTITUTION.address).toBe("9 Impasse Nussbaum, 68300 Saint-Louis, France");
    expect(INSTITUTION.siren).toBe("103 987 061");
    expect(INSTITUTION.email).toBe("contact@holiswiss.ch");
    expect(INSTITUTION.infrastructure).toBe("Infrastructure applicative : Lovable et Supabase. Gestion du nom de domaine : IONOS.");
  });
  for (const lang of LANGS) {
    it(`${lang} : texte complet, référencement localisé et liens réciproques`, () => {
      const c = institutionalCopy(lang);
      expect(c.identity).toContain("Gérald Henry");
      expect(c.identity).toMatch(/France|Frankreich|Francia/);
      expect(c.method).toMatch(/téléphone|Telefon|telefono|telephone/);
      expect(c.limit.length).toBeGreaterThan(100);
      const h = aboutHead(lang);
      const url = `https://holiswiss.ch/${lang}/a-propos`;
      expect(h.meta).toContainEqual({ title: c.title });
      for (const field of ["og:title", "twitter:title"]) expect(h.meta).toContainEqual({ [field.startsWith("og") ? "property" : "name"]: field, content: c.title });
      expect(h.meta).toContainEqual({ name: "robots", content: "index, follow" });
      expect(h.links.filter(x => x.rel === "canonical")).toEqual([{ rel: "canonical", href: url }]);
      expect(h.links.filter(x => x.rel === "alternate")).toHaveLength(5);
      for (const l of LANGS) expect(h.links).toContainEqual({ rel: "alternate", hrefLang: l, href: `https://holiswiss.ch/${l}/a-propos` });
      expect(h.links).toContainEqual({ rel: "alternate", hrefLang: "x-default", href: "https://holiswiss.ch/fr/a-propos" });
      expect(JSON.parse(h.scripts[0].children)["@type"]).toBe("BreadcrumbList");
      expect(JSON.parse(h.scripts[0].children).itemListElement[1].item).toBe(url);
    });
    it(`${lang} : Organization identique et sans propriété non autorisée`, () => {
      const node = getOrganizationNode(lang);
      expect(Object.keys(node).sort()).toEqual(["@type", "@id", "name", "url", "logo", "email", "founder", "address", "areaServed"].sort());
      expect(node.name).toBe("Holiswiss");
      expect(node.logo.url).toBe(LOGO_URL);
      expect(node.address.streetAddress).toBe("9 Impasse Nussbaum");
      expect(node.address.addressCountry).toBe("FR");
      expect(node.areaServed).toEqual({ "@type": "Country", name: "Switzerland" });
      expect(node).toEqual(getOrganizationNode("fr"));
    });
    it(`${lang} : affiliations déclaratives et contrôle jamais généralisé au diplôme`, () => {
      const badges = buildTrustBadges({ lang, verified: true, accreditations: [{ org: "ASCA", number: "123" }], certifications: [{ name: "Diplôme", verification_status: "declared" }] });
      expect(badges.find(b => b.kind === "accreditation")?.description).toContain(institutionalCopy(lang).affiliation);
      expect(badges.find(b => b.kind === "accreditation")?.verified).toBe(false);
      expect(badges.find(b => b.kind === "certification")?.verified).toBe(false);
      expect(badges.find(b => b.kind === "verified")?.description).toContain(institutionalCopy(lang).limit);
    });
  }
  it("les documents juridiques ne déclarent jamais d’alternates", () => {
    for (const page of ["impressum", "conditions", "confidentialite"]) {
      const h = legalHead(`/${page}`, "Document — Holiswiss", "Texte français.");
      expect(h.links).toEqual([{ rel: "canonical", href: `https://holiswiss.ch/fr/${page}` }]);
      expect(h.meta).toContainEqual({ name: "robots", content: "noindex, follow" });
      const src = readFileSync(`src/routes/$lang.${page}.index.tsx`, "utf8");
      expect(src).toContain("LegalLanguageNotice lang={lang}");
      expect(src).not.toMatch(/Groupe Holi|seoLinks/);
    }
  });
  it("footer et sitemap relient la vraie page dans les quatre langues", () => {
    const footer = readFileSync("src/components/layout/Footer.tsx", "utf8");
    expect(footer).toContain('to="/$lang/a-propos" params={{ lang }}');
    expect(footer).toContain("institutionalCopy(lang).about");
    expect(footer).not.toContain("Groupe Holi");
    const sitemap = readFileSync("src/lib/sitemap-build.server.ts", "utf8");
    expect(sitemap).toContain('{ path: "/a-propos"');
    expect(sitemap).toContain("for (const lang of LANGS)");
  });
  it("retire les affirmations interdites des textes institutionnels publics", () => {
    for (const path of ["src/routes/$lang.contact.index.tsx", "src/routes/__root.tsx", "src/routes/$lang.index.tsx", "src/routes/$lang.therapeutes.index.tsx", "public/llms.txt", ...LANGS.map(l => `src/i18n/${l}.json`)]) {
      const src = readFileSync(path, "utf8");
      expect(src, path).not.toMatch(/avis authentiques|authentic reviews|recensioni autentiche|echte Bewertungen|sous 48 heures|within 48 hours|entro 48 ore|innerhalb von 48 Stunden|plateforme suisse|Swiss platform|Schweizer Plattform|piattaforma svizzera/i);
      expect(src, path).not.toContain("HoliSwiss");
    }
  });
});