import { describe, it, expect } from "vitest";
import { cityToSlug } from "./city-slug";
import { hreflangLinks, resolveProfileLang, LANGS, SITE } from "./seo";
import { slugForLang, titleForLang } from "./articles.functions";
import { specialtySlugForLang } from "./specialties.functions";

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

  /**
   * Valeurs de référence partagées avec `public.city_slug()`, défini dans la
   * migration 20260825140000_cities_slug_foundation.sql. Les deux
   * implémentations doivent produire exactement la même chose : leur
   * divergence est ce qui a redirigé des URLs du sitemap vers des URLs
   * absentes du sitemap le 25/08/2026.
   *
   * Accord vérifié sur PostgreSQL 16 en UTF-8, 0 divergence sur ces 12 cas.
   * Si l'un de ces tests tombe, la migration doit être corrigée en même temps
   * — sinon la base et le code ne parleront plus de la même URL.
   */
  it("reste d'accord avec public.city_slug() côté base", () => {
    const golden: Array<[string, string]> = [
      ["Genève", "geneve"],
      ["Basel", "basel"],
      ["Le Chenit", "le-chenit"],
      ["Neuchâtel", "neuchatel"],
      ["Zürich", "zurich"],
      ["Coppet", "coppet"],
      ["Boudevilliers", "boudevilliers"],
      ["Payerne", "payerne"],
      ["St. Gallen", "st-gallen"],
      ["Biel/Bienne", "biel-bienne"],
      ["Genève, Suisse", "geneve-suisse"],
      ["  Lausanne  ", "lausanne"],
    ];
    for (const [input, expected] of golden) {
      expect(cityToSlug(input)).toBe(expected);
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

describe("specialtySlugForLang — slug de spécialité par langue", () => {
  // Constat du 27/08/2026 : seule `slug_de` existait en base. L'anglais et
  // l'italien retombaient donc sur `slug`, qui EST le slug français — d'où des
  // URL comme /en/specialites/coaching-de-vie/payerne.
  const coaching = {
    slug: "coaching-de-vie",
    slug_de: "life-coaching",
    slug_it: "coaching-di-vita",
    slug_en: "life-coaching",
  };

  it("sert le slug de la langue demandée", () => {
    expect(specialtySlugForLang(coaching, "fr")).toBe("coaching-de-vie");
    expect(specialtySlugForLang(coaching, "de")).toBe("life-coaching");
    expect(specialtySlugForLang(coaching, "it")).toBe("coaching-di-vita");
    expect(specialtySlugForLang(coaching, "en")).toBe("life-coaching");
  });

  it("n'attend jamais de colonne slug_fr", () => {
    // Le slug de base EST le slug français : une colonne slug_fr serait une
    // seconde source de vérité. Le français doit donc marcher sans elle.
    expect(specialtySlugForLang({ slug: "hypnose" }, "fr")).toBe("hypnose");
  });

  it("replie sur le slug de base quand la langue n'a pas de slug propre", () => {
    // Yoga, Reiki, Shiatsu… portent le même mot partout : c'est le cas normal,
    // pas une donnée manquante.
    const yoga = { slug: "yoga", slug_de: null, slug_it: null, slug_en: null };
    for (const l of ["fr", "de", "it", "en"]) {
      expect(specialtySlugForLang(yoga, l)).toBe("yoga");
    }
  });

  it("replie aussi si la migration n'est pas encore appliquée", () => {
    // Colonnes absentes ⇒ undefined. Doit servir le slug de base, jamais "".
    expect(specialtySlugForLang({ slug: "reiki" }, "en")).toBe("reiki");
  });

  it("traite une langue inconnue comme du français", () => {
    expect(specialtySlugForLang(coaching, "es")).toBe("coaching-de-vie");
  });
});
