import { describe, expect, it } from "vitest";
import fr from "@/i18n/fr.json";
import de from "@/i18n/de.json";
import itJson from "@/i18n/it.json";
import en from "@/i18n/en.json";
import { createI18nForLang, SUPPORTED_LANGS, type Lang } from "@/lib/i18n";
import { computeListingFacts, formatChfAmount } from "@/lib/directory-stats";
import {
  buildLocalFaq,
  buildLocalFaqSection,
  localFaqJsonLd,
  LOCAL_FAQ_MAX,
  tallySpecialties,
  type LocalFaqInput,
  type LocalFaqItem,
  type LocalFaqRow,
  type SpecialtyLink,
} from "./local-faq";

function tFor(lang: Lang) {
  const t = createI18nForLang(lang).getFixedT(lang);
  return (key: string, vars?: Record<string, unknown>) => String(t(key, vars as never));
}

const allText = (items: LocalFaqItem[]) => items.map((i) => `${i.question} ${i.answer}`).join("\n");

// Fiches calquées sur des données réelles de production (lues le 26/09/2026).
const EMILIE: LocalFaqRow = {
  id: "e", city: "Genève", canton: "GE", price_min: 75, price_max: 210, currency: "CHF",
  consultation_modes: ["in_person", "online", "home"], languages: ["Français"],
};
const SHIATSU: LocalFaqRow = {
  id: "s", city: "Genève", canton: "GE", price_min: null, price_max: null, currency: "CHF",
  consultation_modes: null, languages: null,
};
const SACONNEX: LocalFaqRow = {
  id: "g", city: "Le Grand Saconnex", canton: "GE", price_min: 100, price_max: 150, currency: "CHF",
  consultation_modes: ["in_person", "online"], languages: ["Français"],
};
const LINKS: SpecialtyLink[] = [
  { therapist_id: "e", slug: "hypnose", name_fr: "Hypnose", name_de: "Hypnose", name_it: "Ipnosi", name_en: "Hypnosis" },
  { therapist_id: "e", slug: "breathwork", name_fr: "Breathwork", name_de: "Breathwork", name_it: "Breathwork", name_en: "Breathwork" },
  { therapist_id: "s", slug: "shiatsu", name_fr: "Shiatsu", name_de: "Shiatsu", name_it: "Shiatsu", name_en: "Shiatsu" },
  { therapist_id: "g", slug: "hypnose", name_fr: "Hypnose", name_de: "Hypnose", name_it: "Ipnosi", name_en: "Hypnosis" },
  // Fiche hors liste : jamais comptée.
  { therapist_id: "zzz", slug: "reiki", name_fr: "Reiki", name_de: "Reiki", name_it: "Reiki", name_en: "Reiki" },
];

function canton(lang: Lang = "fr", rows: LocalFaqRow[] = [EMILIE, SHIATSU, SACONNEX], extra: Partial<LocalFaqInput> = {}) {
  return buildLocalFaq(
    rows,
    { kind: "canton", place: "Genève (GE)", lang, specialtyLinks: LINKS, ...extra },
    tFor(lang),
  );
}

describe("clés i18n", () => {
  it("les quatre langues ont exactement les mêmes clés local_faq", () => {
    const keys = (j: any) => Object.keys(j.local_faq).sort();
    const ref = keys(fr);
    expect(ref.length).toBeGreaterThan(20);
    for (const j of [de, itJson, en]) expect(keys(j)).toEqual(ref);
  });

  it("aucune clé n'est renvoyée brute, dans aucune langue ni aucun gabarit", () => {
    for (const lang of SUPPORTED_LANGS) {
      for (const kind of ["city", "canton", "specialty"] as const) {
        const s = buildLocalFaqSection(
          [EMILIE, SHIATSU, SACONNEX],
          { kind, place: "Genève", lang, specialtyLinks: LINKS },
          tFor(lang),
        );
        const text = `${s?.title} ${s?.subtitle} ${allText(s?.items ?? [])}`;
        expect(text).not.toMatch(/local_faq\.|therapist_auto_faq\.|\{\{/);
      }
    }
  });
});

describe("seuils et données manquantes", () => {
  it("liste vide → rien", () => {
    expect(canton("fr", [])).toEqual([]);
    expect(buildLocalFaq(null, { kind: "city", place: "X", lang: "fr" }, tFor("fr"))).toEqual([]);
  });

  it("lieu absent → rien", () => {
    expect(canton("fr", [EMILIE], { place: "   " })).toEqual([]);
  });

  it("le décompte seul ne suffit pas : moins de 2 questions → rien", () => {
    expect(canton("fr", [SHIATSU], { specialtyLinks: [] })).toEqual([]);
    expect(canton("fr", [SHIATSU], { specialtyLinks: null })).toEqual([]);
    // Une spécialité rattachée : 2 questions, la FAQ existe.
    expect(canton("fr", [SHIATSU])).toHaveLength(2);
  });

  it("jamais plus de LOCAL_FAQ_MAX questions, dans l'ordre de priorité", () => {
    const items = canton();
    expect(items).toHaveLength(LOCAL_FAQ_MAX);
    expect(items[0].question).toMatch(/combien/);
    expect(items[1].question).toMatch(/spécialités/);
    expect(items[2].question).toMatch(/tarif/);
    expect(items[3].question).toMatch(/consulter en présentiel/);
  });

  it("pivot illisible (null) : la question spécialités disparaît, les autres restent", () => {
    const items = canton("fr", undefined, { specialtyLinks: null });
    expect(allText(items)).not.toMatch(/spécialités/i);
    expect(items.some((i) => /langues/.test(i.question))).toBe(true);
  });

  it("page spécialité : jamais de question « quelles spécialités »", () => {
    const items = buildLocalFaq(
      [EMILIE, SACONNEX],
      { kind: "specialty", place: "Hypnose", lang: "fr", specialtyLinks: LINKS },
      tFor("fr"),
    );
    expect(allText(items)).not.toMatch(/quelles spécialités/);
    expect(items[0].answer).toBe(
      "L'annuaire Holiswiss référence 2 fiches de thérapeutes rattachées à la spécialité Hypnose.",
    );
  });
});

describe("décompte", () => {
  it("singulier / pluriel dans les quatre langues", () => {
    const one = (lang: Lang) =>
      buildLocalFaq([EMILIE], { kind: "city", place: "Genève", lang }, tFor(lang))[0].answer;
    expect(one("fr")).toBe(
      "L'annuaire Holiswiss référence 1 fiche de thérapeute dont la localité indiquée est Genève.",
    );
    expect(one("de")).toMatch(/1 Therapeutenprofil mit/);
    expect(one("it")).toMatch(/1 profilo di terapeuta/);
    expect(one("en")).toMatch(/1 therapist profile whose/);
    expect(canton("en")[0].answer).toMatch(/3 therapist profiles whose stated canton is Genève \(GE\)\./);
  });
});

describe("spécialités du référentiel", () => {
  it("compte une fiche par spécialité, ignore les fiches hors liste, trie par nombre", () => {
    expect(tallySpecialties([EMILIE, SHIATSU, SACONNEX], LINKS, "fr")).toEqual([
      { name: "Hypnose", count: 2 },
      { name: "Breathwork", count: 1 },
      { name: "Shiatsu", count: 1 },
    ]);
  });

  it("nom dans la langue de la page, repli sur le français", () => {
    expect(tallySpecialties([EMILIE], LINKS, "it")[1]).toEqual({ name: "Ipnosi", count: 1 });
    const noIt = [{ therapist_id: "e", slug: "x", name_fr: "Nom FR", name_it: "" }];
    expect(tallySpecialties([EMILIE], noIt, "it")).toEqual([{ name: "Nom FR", count: 1 }]);
  });

  it("départage par slug : même sélection dans les quatre langues", () => {
    // Deux spécialités à égalité dont l'ordre alphabétique s'inverse selon la langue.
    const tie: SpecialtyLink[] = [
      { therapist_id: "e", slug: "a-slug", name_fr: "Zèbre", name_de: "Zebra", name_it: "Zebra", name_en: "Zebra" },
      { therapist_id: "e", slug: "b-slug", name_fr: "Abeille", name_de: "Biene", name_it: "Ape", name_en: "Bee" },
    ];
    expect(tallySpecialties([EMILIE], tie, "fr").map((x) => x.name)).toEqual(["Zèbre", "Abeille"]);
    expect(tallySpecialties([EMILIE], tie, "it").map((x) => x.name)).toEqual(["Zebra", "Ape"]);
  });

  it("au-delà de 6, « et N autres »", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ therapist_id: "e", slug: `s${i}`, name_fr: `S${i}` }));
    const items = canton("fr", [EMILIE], { specialtyLinks: many });
    expect(items[1].answer).toMatch(/S5 \(1\) et 2 autres\.$/);
  });
});

describe("tarifs", () => {
  it("fourchette : borne basse = « dès » du bloc de chiffres, borne haute = max indiqué", () => {
    const rows = [EMILIE, SHIATSU, SACONNEX];
    const price = canton("fr", rows).find((i) => /tarif/.test(i.question))!;
    expect(price.answer).toBe(
      "Tarifs par séance indiqués sur les fiches : de CHF 75 à CHF 210 (2 fiches sur 3 indiquent un tarif).",
    );
    expect(price.answer).toContain(formatChfAmount(computeListingFacts(rows).priceFrom!));
  });

  it("0, null, négatif et EUR exclus ; un max < min est ignoré", () => {
    const rows: LocalFaqRow[] = [
      { id: "a", price_min: 0, price_max: 150, currency: "CHF" },
      { id: "b", price_min: -5, currency: "CHF" },
      { id: "c", price_min: 40, price_max: 500, currency: "EUR" },
      { id: "d", price_min: 90, price_max: 20, currency: "CHF", languages: ["Deutsch"] },
    ];
    const items = buildLocalFaq(rows, { kind: "city", place: "Basel", lang: "fr" }, tFor("fr"));
    const price = items.find((i) => /tarif/.test(i.question))!;
    expect(price.answer).toBe("Tarif par séance indiqué sur les fiches : CHF 90 (1 fiche sur 4 indique un tarif).");
    expect(allText(items)).not.toMatch(/40|500|150|EUR/);
  });

  it("aucun tarif valide → pas de question tarif", () => {
    const rows: LocalFaqRow[] = [
      { id: "a", price_min: null, currency: "CHF", languages: ["Français"] },
      { id: "b", price_min: 0, currency: "CHF" },
    ];
    const items = buildLocalFaq(rows, { kind: "city", place: "X", lang: "fr" }, tFor("fr"));
    expect(allText(items)).not.toMatch(/tarif|CHF/i);
  });

  it("format CHF suisse sans Intl (apostrophe typographique)", () => {
    const rows: LocalFaqRow[] = [{ id: "a", price_min: 1250, price_max: 2500, currency: "CHF", languages: ["English"] }];
    const items = buildLocalFaq(rows, { kind: "city", place: "Zug", lang: "de" }, tFor("de"));
    expect(allText(items)).toContain("CHF 1’250 bis CHF 2’500");
  });
});

describe("modalités et langues", () => {
  it("modalités : part chiffrée par mode, fiches sans modalité signalées", () => {
    const items = buildLocalFaq(
      [EMILIE, SHIATSU, SACONNEX],
      { kind: "city", place: "Genève", lang: "fr" },
      tFor("fr"),
    );
    const modes = items.find((i) => /présentiel/.test(i.question))!;
    expect(modes.answer).toBe(
      "Modalités de consultation indiquées sur les fiches : en présentiel (2 sur 3), en ligne (2 sur 3) et à domicile (1 sur 3). 1 fiche n'en indique aucune.",
    );
  });

  it("valeurs de modalité inconnues ignorées ; aucune modalité → pas de question", () => {
    const rows: LocalFaqRow[] = [
      { id: "a", consultation_modes: ["telepathy"], price_min: 50, currency: "CHF" },
      { id: "b", consultation_modes: [], price_min: 60, currency: "CHF" },
    ];
    const items = buildLocalFaq(rows, { kind: "city", place: "X", lang: "en" }, tFor("en"));
    expect(allText(items)).not.toMatch(/in person|telepathy/);
  });

  it("langues : les quatre valeurs connues, traduites, chiffrées", () => {
    const rows: LocalFaqRow[] = [
      { id: "a", languages: ["Français", "English"] },
      { id: "b", languages: ["Français", "Deutsch", "Klingon"] },
    ];
    const items = buildLocalFaq(rows, { kind: "city", place: "Basel", lang: "de" }, tFor("de"));
    expect(items[1].answer).toBe(
      "In den Profilen angegebene Sprachen: Französisch (2 von 2), Deutsch (1 von 2) und Englisch (1 von 2).",
    );
    expect(allText(items)).not.toMatch(/Klingon/);
  });
});

describe("conformité rédactionnelle", () => {
  for (const lang of SUPPORTED_LANGS) {
    for (const kind of ["city", "canton", "specialty"] as const) {
      // Ce test couvre les textes de la FAQ (clés local_faq et libellés partagés),
      // PAS les noms de spécialités du référentiel, repris tels quels : un nom
      // comme « Geistiges Heilen » (ASCA/EMR) passerait sans être signalé ici.
      it(`${lang}/${kind} : jamais « verif », aucun verbe de soin, aucun superlatif`, () => {
        const s = buildLocalFaqSection(
          [EMILIE, SHIATSU, SACONNEX],
          { kind, place: "Le Grand Saconnex", lang, specialtyLinks: LINKS },
          tFor(lang),
        )!;
        const out = `${s.title} ${s.subtitle} ${allText(s.items)}`;
        expect(out.normalize("NFD").replace(/[̀-ͯ]/g, "")).not.toMatch(/verif/i);
        expect(out).not.toMatch(
          /\b(traite|traitent|soigne|soignent|guérit|guérir|heilt|heilen|behandelt|cura|curano|guarisce|cures?|heals?|treats?)\b/i,
        );
        expect(out).not.toMatch(/\b(meilleur|best|beste[nr]?|migliore)\b/i);
      });

      it(`${lang}/${kind} : aucune préposition devant le nom de lieu libre`, () => {
        const s = buildLocalFaqSection(
          [EMILIE, SACONNEX],
          { kind, place: "Le Grand Saconnex", lang, specialtyLinks: LINKS },
          tFor(lang),
        )!;
        const out = `${s.title}\n${allText(s.items)}`;
        expect(out).toContain("Le Grand Saconnex");
        expect(out).not.toMatch(
          // Mot entier (lettres Unicode) : « specialità Le … » n'est pas « à Le … ».
          /(?<!\p{L})(à|a|au|de|du|d'|in|im|nel|nella|di|dans|at|to|for|für|per|pour|en|zu|bei)\s+Le Grand Saconnex/iu,
        );
      });
    }
  }
});

describe("JSON-LD", () => {
  it("texte strictement identique aux items visibles, un nœud, @id #faq, inLanguage, rattaché à la page", () => {
    const url = "https://holiswiss.ch/fr/therapeutes/canton/GE";
    const items = canton();
    const ld = localFaqJsonLd(items, { url, lang: "fr", pageId: `${url}#webpage` })!;
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld["@id"]).toBe(`${url}#faq`);
    expect(ld.inLanguage).toBe("fr");
    expect(ld.isPartOf).toEqual({ "@id": `${url}#webpage` });
    const entities = ld.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>;
    expect(entities.map((e) => ({ question: e.name, answer: e.acceptedAnswer.text }))).toEqual(items);
  });

  it("aucune date dans le texte : le FAQPage ne change pas d'un jour à l'autre", () => {
    for (const lang of SUPPORTED_LANGS) {
      const s = buildLocalFaqSection(
        [EMILIE, SHIATSU, SACONNEX],
        { kind: "canton", place: "Genève (GE)", lang, specialtyLinks: LINKS },
        tFor(lang),
      )!;
      expect(`${s.subtitle} ${allText(s.items)}`).not.toMatch(/\d{2}\.\d{2}\.\d{4}|\{\{date\}\}/);
    }
  });

  it("moins de 2 questions → pas de nœud", () => {
    expect(localFaqJsonLd([], { url: "u", lang: "fr", pageId: "u#webpage" })).toBeNull();
    expect(
      localFaqJsonLd([{ question: "q", answer: "a" }], { url: "u", lang: "fr", pageId: "u#webpage" }),
    ).toBeNull();
  });

  it("section : titre et sous-titre localisés, sans date", () => {
    const s = buildLocalFaqSection([EMILIE, SACONNEX], {
      kind: "city", place: "Genève", lang: "it",
    }, tFor("it"))!;
    expect(s.title).toBe("Domande pratiche — Genève");
    expect(s.subtitle).toBe("Risposte basate unicamente sulle informazioni indicate nei profili elencati qui.");
  });
});
