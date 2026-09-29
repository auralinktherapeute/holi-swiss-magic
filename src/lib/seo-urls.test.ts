import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cityToSlug } from "./city-slug";
import {
  hreflangLinks,
  normalizeSeoLang,
  profileCanonicalUrl,
  profileContentLang,
  profileSourceLang,
  resolveProfileLang,
  LANGS,
  PROFILE_LANG_COLUMNS,
  SITE,
} from "./seo";
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

/** Forme réelle de `profile_translations` en production (relevé du 29/09/2026). */
const translated = (source_lang: unknown) => ({
  source_lang,
  source_hash: "7296200d",
  langs: { de: { status: "auto" }, en: { status: "auto" }, it: { status: "auto" } },
});

describe("Langue de rédaction d'une fiche — prime sur le canton (29/09/2026)", () => {
  it("une fiche rédigée en français à Bâle ou Berne reste française", () => {
    // Cas réels : henry-gerald (BS) et susanna-probst (BE), rédigées en
    // français, étaient canonicalisées sur /de/ — une traduction automatique
    // désignée comme l'original.
    expect(
      profileContentLang({ canton: "BS", languages: ["Français", "Deutsch", "English"], profile_translations: translated("fr") }),
    ).toBe("fr");
    expect(
      profileContentLang({ canton: "BE", languages: ["Français", "Italiano"], profile_translations: translated("fr") }),
    ).toBe("fr");
    expect(resolveProfileLang(null, "BS", null, "fr")).toBe("fr");
  });

  it("une fiche rédigée en allemand à Genève est allemande", () => {
    expect(profileContentLang({ canton: "GE", profile_translations: translated("de") })).toBe("de");
  });

  it("la langue de l'URL prime toujours (libellés, FAQ auto de la version consultée)", () => {
    expect(resolveProfileLang("it", "BS", null, "fr")).toBe("it");
  });

  it("normalise les variantes régionales et la casse", () => {
    expect(normalizeSeoLang("fr-CH")).toBe("fr");
    expect(normalizeSeoLang("DE")).toBe("de");
    expect(normalizeSeoLang(" it_CH ")).toBe("it");
    expect(normalizeSeoLang("en")).toBe("en");
    expect(profileContentLang({ canton: "GE", profile_translations: translated("DE-ch") })).toBe("de");
  });

  it("rejette les valeurs hors fr/de/it/en et retombe sur le canton", () => {
    for (const bad of ["es", "french", "", "  ", null, undefined, 42, {}]) {
      expect(normalizeSeoLang(bad)).toBeNull();
      expect(profileContentLang({ canton: "ZH", profile_translations: translated(bad) })).toBe("de");
    }
  });

  it("ignore un source_lang posé par défaut sans détection (profil vide, aucune traduction)", () => {
    // translateTherapistRow pose source_lang: "fr" sans appeler le modèle quand
    // le profil est vide : ce n'est pas une langue de rédaction constatée.
    const undetected = { source_lang: "fr", source_hash: "x", langs: {} };
    expect(profileSourceLang(undetected)).toBeNull();
    expect(profileContentLang({ canton: "ZH", profile_translations: undetected })).toBe("de");
  });

  it("sans profile_translations : canton, puis langues parlées, puis français", () => {
    expect(profileContentLang({ canton: "TI", profile_translations: null })).toBe("it");
    expect(profileContentLang({ canton: null, languages: ["Deutsch"], profile_translations: null })).toBe("de");
    expect(profileContentLang({ canton: null, languages: ["Italiano", "Français"] })).toBe("it");
    expect(profileContentLang(null)).toBe("fr");
    expect(profileContentLang(undefined)).toBe("fr");
  });

  it("profileCanonicalUrl compose l'URL absolue dans la langue de rédaction", () => {
    expect(profileCanonicalUrl("henry-gerald", { canton: "BS", profile_translations: translated("fr") })).toBe(
      `${SITE}/fr/therapeute/henry-gerald`,
    );
  });
});

describe("Sitemap ↔ canonical de la fiche — même fonction, même donnée", () => {
  // Les routes importent du code serveur et ne se chargent pas dans vitest : on
  // verrouille donc leur source. Si le sitemap ou la fiche recompose la langue
  // à la main, ou ne lit pas les colonnes dont elle dépend, ce test tombe.
  const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
  const sitemap = read("routes/sitemap[.]xml.ts");
  const route = read("routes/$lang.therapeute.$slug.tsx");
  const publicFns = read("lib/public.functions.ts");
  const articleFns = read("lib/therapist-articles.functions.ts");
  const cols = PROFILE_LANG_COLUMNS.split(",");

  it("les deux passent par profileCanonicalUrl", () => {
    expect(sitemap).toMatch(/profileCanonicalUrl\(t\.slug, t\)/);
    expect(route).toMatch(/const canonicalUrl = profileCanonicalUrl\(params\.slug, t\)/);
  });

  it("aucun des deux ne recompose l'URL de fiche ni la règle de langue", () => {
    expect(sitemap).not.toMatch(/\/therapeute\/\$\{/);
    expect(sitemap).not.toMatch(/resolveProfileLang\(/);
    expect(route).not.toMatch(/resolveProfileLang\(\s*null/);
    expect(route).not.toMatch(/\$\{[a-zA-Z]+Lang\}\/therapeute\//);
  });

  it("le sitemap et la fiche lisent toutes les colonnes dont dépend la langue", () => {
    expect(sitemap).toContain("${PROFILE_LANG_COLUMNS}");
    const ficheSelect = publicFns.match(/from\("therapists"\)\s*\.select\(`([^`]*)`\)/)?.[1] ?? "";
    expect(ficheSelect).not.toBe("");
    const eventSelect = publicFns.match(/select\("(id,slug,first_name,last_name,photo_url,city,canton[^"]*)"\)/)?.[1] ?? "";
    expect(eventSelect).not.toBe("");
    const articleBlock = articleFns.slice(articleFns.indexOf("getPublishedTherapistArticleBySlug ="));
    const authorSelect = articleBlock.match(/therapists\(([^)]*)\)/)?.[1] ?? "";
    expect(authorSelect).not.toBe("");
    for (const c of cols) {
      expect(ficheSelect.split(",")).toContain(c);
      expect(eventSelect.split(",")).toContain(c);
      expect(authorSelect.split(",")).toContain(c);
    }
  });

  it("donne la même URL que la fiche pour les 13 fiches actives relevées en production", () => {
    // Relevé qqwud du 29/09/2026 (tous source_lang = fr, sauf 2 profils vides
    // sans traduction). Seules henry-gerald et susanna-probst changent (de → fr).
    const rows: Array<[string, string | null, string[] | null, boolean, string]> = [
      ["alexiacalluy-c56e54", null, ["Français"], true, "fr"],
      ["carine-9ffd3d", "GE", ["Français"], true, "fr"],
      ["caroline-roch-the-undiet-plan", "VD", ["Français", "English"], true, "fr"],
      ["d-jourdain-5de6e6", "VD", ["Français", "English"], true, "fr"],
      ["dominique-marine-oberhofer-bb2a1b", "VD", ["Français"], true, "fr"],
      ["emilie-chardon-8df145", "GE", ["Français"], true, "fr"],
      ["fajeiv-pm-69192a", null, null, false, "fr"],
      ["greg-arshakuni-67e978", "VD", ["Français", "Deutsch", "English"], true, "fr"],
      ["henry-gerald", "BS", ["Français", "Deutsch", "English"], true, "fr"],
      ["olivier-larue-efbaa6", "GE", null, true, "fr"],
      ["susanna-probst-bio-nerg-ticienne-2ea5be", "BE", ["Français", "Italiano"], true, "fr"],
      ["vanessa-novel-df680b", null, null, false, "fr"],
      ["zorana-38b08b", "GE", ["Français", "English"], true, "fr"],
    ];
    for (const [slug, canton, languages, detected, want] of rows) {
      const row = {
        canton,
        languages,
        profile_translations: detected ? translated("fr") : { source_lang: "fr", langs: {} },
      };
      expect(profileCanonicalUrl(slug, row)).toBe(`${SITE}/${want}/therapeute/${slug}`);
    }
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
