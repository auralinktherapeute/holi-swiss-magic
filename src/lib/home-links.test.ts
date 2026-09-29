import { describe, it, expect } from "vitest";
import {
  canonicalProfileLang,
  cantonCounts,
  indexableCities,
  isHomeCityIndexable,
  pickNearby,
  pickNewest,
  toHomeArticles,
  toHomeTherapists,
  type HomeTherapistRow,
} from "./home-links";
import { resolveProfileLang } from "./seo";

const row = (o: Partial<HomeTherapistRow> & { id: string }): HomeTherapistRow => ({
  slug: o.id,
  first_name: "A",
  last_name: "B",
  title: null,
  photo_url: null,
  city: null,
  canton: null,
  languages: null,
  verified: false,
  specialties: null,
  created_at: "2026-09-01T00:00:00Z",
  latitude: null,
  longitude: null,
  price_min: null,
  currency: null,
  ...o,
});

// `cities` réduit aux lignes utiles, telles que lues sur qqwud le 29/09/2026.
const CITIES = [
  {
    slug: "geneve",
    canonical_name: "Geneva",
    aliases: ["acacias", "ge", "geneva", "geneve", "genève", "genf", "ginevra", "les acacias"],
  },
  { slug: "biel-bienne", canonical_name: "Biel/Bienne", aliases: ["bienne", "biel"] },
];

describe("canonicalProfileLang — même règle que le canonical de la fiche et le sitemap", () => {
  it("délègue à resolveProfileLang sans langue d'URL", () => {
    for (const [canton, langs] of [
      ["GE", null],
      ["ZH", ["Deutsch"]],
      ["TI", null],
      [null, ["it"]],
      [null, null],
    ] as const) {
      expect(canonicalProfileLang({ canton, languages: langs as string[] | null })).toBe(
        resolveProfileLang(null, canton, langs as string[] | null),
      );
    }
    expect(canonicalProfileLang({ canton: "ZH", languages: null })).toBe("de");
    expect(canonicalProfileLang({ canton: "TI", languages: null })).toBe("it");
  });
});

describe("toHomeTherapists", () => {
  it("écarte les fiches sans slug (lien mort) et pose la langue canonique", () => {
    const out = toHomeTherapists([
      row({ id: "a", canton: "GE" }),
      row({ id: "b", slug: null }),
      row({ id: "c", slug: "  " }),
      row({ id: "d", canton: "BS" }),
    ]);
    expect(out.map((t) => [t.slug, t.profileLang])).toEqual([
      ["a", "fr"],
      ["d", "de"],
    ]);
  });
});

describe("pickNewest / pickNearby", () => {
  const list = toHomeTherapists([
    row({ id: "old-photo", photo_url: "x.jpg", created_at: "2026-06-01T00:00:00Z" }),
    row({ id: "new-nophoto", photo_url: null, created_at: "2026-09-28T00:00:00Z" }),
    row({ id: "empty-photo", photo_url: "", created_at: "2026-09-27T00:00:00Z" }),
    row({
      id: "mid-photo",
      photo_url: "y.jpg",
      created_at: "2026-08-01T00:00:00Z",
      verified: true,
    }),
  ]);

  it("Nouveaux : avec photo seulement, du plus récent au plus ancien", () => {
    expect(pickNewest(list, 4).map((t) => t.slug)).toEqual(["mid-photo", "old-photo"]);
    expect(pickNewest(list, 1).map((t) => t.slug)).toEqual(["mid-photo"]);
  });

  it("À proximité : vérifiés d'abord, puis les plus récents ; ne modifie pas l'entrée", () => {
    const before = list.map((t) => t.slug);
    expect(pickNearby(list, 20).map((t) => t.slug)).toEqual([
      "mid-photo",
      "new-nophoto",
      "empty-photo",
      "old-photo",
    ]);
    expect(list.map((t) => t.slug)).toEqual(before);
    expect(pickNearby(list, 2)).toHaveLength(2);
  });
});

describe("indexableCities — seuil de 2 fiches, compté comme la page ville", () => {
  it("le seuil local vaut 2 (à remplacer par isCityIndexable après la PR #22)", () => {
    expect(isHomeCityIndexable(1)).toBe(false);
    expect(isHomeCityIndexable(2)).toBe(true);
  });

  it("reproduit la production du 29/09/2026 : seule Genève est liée", () => {
    // Les 13 fiches actives de qqwud (ville, canton) au 29/09/2026.
    const prod: Array<[string | null, string | null]> = [
      ["Thônex", "GE"],
      [null, null],
      [null, null],
      [null, null],
      ["Bienne", "BE"],
      ["Le Grand Saconnex", "GE"],
      ["Coppet", "VD"],
      ["Genève", "GE"],
      ["Genève", "GE"],
      ["Lausanne", "VD"],
      ["Le Chenit", "VD"],
      ["Basel", "BS"],
      ["Payerne", "VD"],
    ];
    const rows = prod.map(([city, canton], i) => ({ slug: `t${i}`, city, canton }));
    expect(indexableCities(rows, CITIES)).toEqual([
      { slug: "geneve", name: "Genève", canton: "GE", count: 2 },
    ]);
  });

  it("rattache les alias à la ville canonique (« ge » + « Genève » = 2 → liée)", () => {
    const out = indexableCities(
      [
        { slug: "a", city: "Genève", canton: "GE" },
        { slug: "b", city: "Genf", canton: "GE" },
      ],
      CITIES,
    );
    expect(out).toEqual([{ slug: "geneve", name: "Genève", canton: "GE", count: 2 }]);
  });

  it("apparaît d'elle-même quand une ville atteint 2 fiches", () => {
    const one = [{ slug: "a", city: "Lausanne", canton: "VD" }];
    expect(indexableCities(one, CITIES)).toEqual([]);
    const two = [...one, { slug: "b", city: "Lausanne", canton: "VD" }];
    expect(indexableCities(two, CITIES).map((c) => c.slug)).toEqual(["lausanne"]);
  });

  it("ne compte pas une fiche sans slug ni sans ville (la page ne l'affiche pas)", () => {
    const out = indexableCities(
      [
        { slug: "a", city: "Lausanne", canton: "VD" },
        { slug: null, city: "Lausanne", canton: "VD" },
        { slug: "c", city: null, canton: "VD" },
      ],
      CITIES,
    );
    expect(out).toEqual([]);
  });

  it("sans table `cities` : repli sur la slugification directe, comme la page ville", () => {
    const out = indexableCities(
      [
        { slug: "a", city: "Bienne", canton: "BE" },
        { slug: "b", city: "Bienne", canton: "BE" },
      ],
      [],
    );
    expect(out.map((c) => c.slug)).toEqual(["bienne"]);
    // Avec la table : l'alias « Bienne » pointe vers l'URL publiée.
    expect(
      indexableCities(
        [
          { slug: "a", city: "Bienne", canton: "BE" },
          { slug: "b", city: "Biel", canton: "BE" },
        ],
        CITIES,
      ).map((c) => c.slug),
    ).toEqual(["biel-bienne"]);
  });

  it("trie par nombre de fiches puis par nom", () => {
    const rows = [
      ...["a", "b"].map((s) => ({ slug: s, city: "Sion", canton: "VS" })),
      ...["c", "d", "e"].map((s) => ({ slug: s, city: "Genève", canton: "GE" })),
      ...["f", "g"].map((s) => ({ slug: s, city: "Aarau", canton: "AG" })),
    ];
    expect(indexableCities(rows, CITIES).map((c) => c.slug)).toEqual(["geneve", "aarau", "sion"]);
  });
});

describe("cantonCounts", () => {
  it("compte par code en majuscules, ignore les vides", () => {
    expect(
      cantonCounts([{ canton: "GE" }, { canton: "ge " }, { canton: null }, { canton: "VD" }]),
    ).toEqual({
      GE: 2,
      VD: 1,
    });
  });
});

describe("toHomeArticles — titre et slug dans la langue de la page", () => {
  const articles = [
    {
      id: "1",
      slug: "respiration",
      slug_de: "atmung",
      title_fr: "La respiration",
      title_de: "Die Atmung",
      category: "bien-etre",
      published_at: "2026-09-20T08:00:00Z",
      cover_image_url: "c.jpg",
    },
    { id: "2", slug: "sans-titre", title_fr: "" },
    { id: "3", slug: "", title_fr: "Sans slug" },
    { id: "4", slug: "meditation", title_fr: "Méditer", cover_image_url: "" },
  ];

  it("FR : slug de base et titre français", () => {
    expect(toHomeArticles(articles, "fr").map((a) => [a.slug, a.title])).toEqual([
      ["respiration", "La respiration"],
      ["meditation", "Méditer"],
    ]);
  });

  it("DE : slug_de et titre allemand, repli sur le français sinon (comme /blog)", () => {
    expect(toHomeArticles(articles, "de").map((a) => [a.slug, a.title])).toEqual([
      ["atmung", "Die Atmung"],
      ["meditation", "Méditer"],
    ]);
  });

  it("écarte les articles sans titre ou sans slug, respecte la limite", () => {
    expect(toHomeArticles(articles, "en", 1)).toHaveLength(1);
    const first = toHomeArticles(articles, "fr")[0];
    expect(first).toMatchObject({
      cover: "c.jpg",
      category: "bien-etre",
      publishedAt: "2026-09-20T08:00:00Z",
    });
    expect(toHomeArticles(articles, "fr")[1].cover).toBeNull();
  });
});
