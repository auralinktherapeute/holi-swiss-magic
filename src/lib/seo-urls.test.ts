import { describe, it, expect } from "vitest";
import { cityToSlug } from "./city-slug";
import { hreflangLinks, resolveProfileLang, LANGS, SITE } from "./seo";
import { slugForLang, titleForLang } from "./articles.functions";

/**
 * Ces tests verrouillent les décisions d'URL et d'indexation qui, si elles
 * dérivent, désindexent des pages ou créent des doublons. Chaque bloc porte le
 * numéro du constat de l'audit SEO/GEO du 25/08/2026 qu'il protège.
 */

describe("cityToSlug — slug de ville (source unique)", () => {
  it("retire les accents plutôt que de traduire le nom", () => {
    // Régression du 25/08 : la RPC resolve_city renvoie « Geneva » (anglais) et
    // « Genève, Suisse ». Slugifier l'un ou l'autre produisait geneva /
    // geneve-suisse, alors que le sitemap publie geneve. Des URL du sitemap
    // avaient ainsi été redirigées vers des URL absentes du sitemap.
    expect(cityToSlug("Genève")).toBe("geneve");
    expect(cityToSlug("Genève")).not.toBe("geneva");
    expect(cityToSlug("Genève, Suisse")).not.toBe("geneve");
  });

  it("gère les villes réellement présentes en base", () => {
    expect(cityToSlug("Basel")).toBe("basel");
    expect(cityToSlug("Le Chenit")).toBe("le-chenit");
    expect(cityToSlug("Boudevilliers")).toBe("boudevilliers");
    expect(cityToSlug("Payerne")).toBe("payerne");
    expect(cityToSlug("Coppet")).toBe("coppet");
    expect(cityToSlug("Zürich")).toBe("zurich");
  });

  it("est idempotent : re-slugifier ne change rien", () => {
    for (const c of ["Genève", "Le Chenit", "Zürich", "Basel"]) {
      expect(cityToSlug(cityToSlug(c))).toBe(cityToSlug(c));
    }
  });

  it("ne produit jamais de tiret en tête ou en fin", () => {
    for (const c of [" Genève ", "—Basel—", "Le  Chenit"]) {
      const s = cityToSlug(c);
      expect(s.startsWith("-")).toBe(false);
      expect(s.endsWith("-")).toBe(false);
    }
  });
});

describe("resolveProfileLang — langue indexable d'une fiche (R2)", () => {
  it("suit le canton, pas la langue de l'URL, quand l'URL n'est pas imposée", () => {
    // Le canonical des fiches et le sitemap s'appuient tous deux dessus : s'ils
    // divergent, le sitemap déclare une URL que la page canonicalise ailleurs.
    expect(resolveProfileLang(null, "GE", null)).toBe("fr");
    expect(resolveProfileLang(null, "VD", null)).toBe("fr");
    expect(resolveProfileLang(null, "ZH", null)).toBe("de");
    expect(resolveProfileLang(null, "BS", null)).toBe("de");
    expect(resolveProfileLang(null, "TI", null)).toBe("it");
  });

  it("retombe sur les langues parlées quand le canton est absent", () => {
    expect(resolveProfileLang(null, null, ["de-CH"])).toBe("de");
    expect(resolveProfileLang(null, null, ["it"])).toBe("it");
  });

  it("retombe sur le français quand rien n'est exploitable", () => {
    expect(resolveProfileLang(null, null, null)).toBe("fr");
    expect(resolveProfileLang(null, "XX", [])).toBe("fr");
  });

  it("respecte la langue de l'URL quand elle est fournie et valide", () => {
    expect(resolveProfileLang("de", "GE", null)).toBe("de");
  });
});

describe("hreflangLinks — grappe de langues", () => {
  it("déclare les quatre langues plus x-default", () => {
    const links = hreflangLinks("/therapeutes");
    expect(links).toHaveLength(LANGS.length + 1);
    expect(links.filter((l) => l.hrefLang === "x-default")).toHaveLength(1);
  });

  it("pointe vers des URL absolues du bon domaine", () => {
    for (const l of hreflangLinks("/therapeutes")) {
      expect(l.href.startsWith(`${SITE}/`)).toBe(true);
    }
  });

  it("x-default vise le français par défaut", () => {
    const xd = hreflangLinks("/faq").find((l) => l.hrefLang === "x-default");
    expect(xd?.href).toBe(`${SITE}/fr/faq`);
  });
});

describe("slugForLang — slug d'article localisé (R3)", () => {
  it("préfère le slug allemand quand il existe", () => {
    const a = { slug: "hypnose-therapeutique-suisse", slug_de: "hypnose-schweiz-mythen" };
    expect(slugForLang(a, "de")).toBe("hypnose-schweiz-mythen");
    expect(slugForLang(a, "fr")).toBe("hypnose-therapeutique-suisse");
  });

  it("retombe sur le slug de base sans slug localisé", () => {
    const a = { slug: "bienfaits-reiki-guide-complet", slug_de: null };
    expect(slugForLang(a, "de")).toBe("bienfaits-reiki-guide-complet");
    expect(slugForLang(a, "it")).toBe("bienfaits-reiki-guide-complet");
  });

  it("ne renvoie jamais une chaîne vide pour un article valide", () => {
    expect(slugForLang({ slug: "x" }, "en")).toBe("x");
  });
});

describe("titleForLang — repli de titre", () => {
  it("utilise la langue demandée quand elle est traduite", () => {
    expect(titleForLang({ title_fr: "Reiki", title_de: "Reiki DE" }, "de")).toBe("Reiki DE");
  });

  it("retombe sur le français plutôt que de rendre vide", () => {
    expect(titleForLang({ title_fr: "Reiki", title_de: "" }, "de")).toBe("Reiki");
  });
});
