import { describe, expect, it } from "vitest";
import fr from "@/i18n/fr.json";
import de from "@/i18n/de.json";
import itJson from "@/i18n/it.json";
import en from "@/i18n/en.json";
import { createI18nForLang, SUPPORTED_LANGS, type Lang } from "@/lib/i18n";
import {
  AUTO_FAQ_MAX,
  buildTherapistAutoFaq,
  examinedCertifications,
  formatChfPlain,
  type AutoFaqCertification,
  type AutoFaqItem,
  type AutoFaqTherapist,
} from "./therapist-auto-faq";

const NOW = Date.parse("2026-09-25T12:00:00Z");

function tFor(lang: Lang) {
  const t = createI18nForLang(lang).getFixedT(lang);
  return (key: string, vars?: Record<string, unknown>) => String(t(key, vars as never));
}

function build(th: AutoFaqTherapist, lang: Lang = "fr", certs: AutoFaqCertification[] = []) {
  return buildTherapistAutoFaq(th, certs, tFor(lang), { now: NOW });
}

const allText = (items: AutoFaqItem[]) => items.map((i) => `${i.question} ${i.answer}`).join("\n");

// Fiches calquées sur des données réelles de production (lues le 25/09/2026).
const CAROLINE: AutoFaqTherapist = {
  first_name: "Caroline", last_name: "Roch",
  specialties: ["Nutrition", "Santé métabolique"], approaches: null,
  price_min: 0, price_max: 150, currency: "CHF",
  consultation_modes: ["online"], languages: ["Français", "English"],
  city: "Lausanne", canton: "VD",
};
const EMILIE: AutoFaqTherapist = {
  first_name: "Émilie", last_name: "Chardon",
  specialties: ["Hypnose", "Breathwork"], approaches: null,
  price_min: 75, price_max: 210, currency: "CHF",
  consultation_modes: ["in_person", "online", "home"], languages: ["Français"],
  city: "acacias", canton: "GE",
};
const EMPTY: AutoFaqTherapist = {
  first_name: "vanessa", last_name: "novel",
  specialties: null, approaches: null, price_min: null, price_max: null, currency: "CHF",
  consultation_modes: null, languages: null, city: null, canton: null,
};

describe("clés i18n", () => {
  it("les quatre langues ont exactement les mêmes clés therapist_auto_faq", () => {
    const keys = (j: any) => Object.keys(j.therapist_auto_faq).sort();
    const ref = keys(fr);
    expect(ref.length).toBeGreaterThan(10);
    for (const j of [de, itJson, en]) expect(keys(j)).toEqual(ref);
  });

  it("aucune clé n'est renvoyée brute (toutes résolues dans chaque langue)", () => {
    for (const lang of SUPPORTED_LANGS) {
      const out = allText(build(EMILIE, lang, [{ name: "Reiki 1", issuer: "X", verification_status: "verified" }]));
      expect(out).not.toMatch(/therapist_auto_faq\./);
      expect(out).not.toMatch(/\{\{/);
    }
  });
});

describe("données manquantes", () => {
  it("fiche vide : aucune question, donc aucune FAQ", () => {
    expect(build(EMPTY)).toEqual([]);
  });

  it("une seule question fondée : pas de FAQ (seuil de 2)", () => {
    const onlyCity = { ...EMPTY, city: "Genève", canton: "GE" };
    expect(build(onlyCity)).toEqual([]);
  });

  it("deux questions fondées : FAQ de deux questions", () => {
    const out = build({ ...EMPTY, city: "Genève", canton: "GE", specialties: ["Shiatsu"] });
    expect(out).toHaveLength(2);
    expect(out[1].answer).toBe("Localité indiquée par vanessa novel : Genève (GE).");
  });

  it("sans nom, rien : les questions ne peuvent pas être formulées sans pronom", () => {
    expect(build({ ...EMILIE, first_name: " ", last_name: null })).toEqual([]);
  });

  it("valeurs vides ou blanches dans les tableaux ignorées", () => {
    const out = build({ ...EMPTY, specialties: ["", "  "], languages: [" "], city: "Bienne", canton: "BE" });
    expect(out).toEqual([]);
  });
});

describe("tarif", () => {
  const q = (items: AutoFaqItem[]) => items.find((i) => i.question.startsWith("Combien"));

  it("price_min = 0 : pas de question tarif, même avec un price_max", () => {
    expect(q(build(CAROLINE))).toBeUndefined();
  });

  it("price_min null : pas de question tarif", () => {
    expect(q(build({ ...EMILIE, price_min: null }))).toBeUndefined();
  });

  it("price_min négatif : pas de question tarif", () => {
    expect(q(build({ ...EMILIE, price_min: -5 }))).toBeUndefined();
  });

  it("fourchette quand price_max > price_min", () => {
    expect(q(build(EMILIE))?.answer).toBe("Tarif indiqué par Émilie Chardon : de CHF 75 à CHF 210 par séance.");
  });

  it("« dès » quand price_max est absent ou incohérent (≤ min)", () => {
    expect(q(build({ ...EMILIE, price_max: null }))?.answer).toBe("Tarif indiqué par Émilie Chardon : dès CHF 75 par séance.");
    expect(q(build({ ...EMILIE, price_max: 50 }))?.answer).toBe("Tarif indiqué par Émilie Chardon : dès CHF 75 par séance.");
  });

  it("montant fixe quand price_max = price_min", () => {
    expect(q(build({ ...EMILIE, price_min: 130, price_max: 130 }))?.answer).toBe(
      "Tarif indiqué par Émilie Chardon : CHF 130 par séance.",
    );
  });

  it("devise autre que CHF, ou absente : pas de question tarif", () => {
    expect(q(build({ ...EMILIE, currency: "EUR" }))).toBeUndefined();
    expect(q(build({ ...EMILIE, currency: null }))).toBeUndefined();
  });

  it("formatage manuel CHF, sans dépendance à ICU", () => {
    expect(formatChfPlain(75)).toBe("CHF 75");
    expect(formatChfPlain(1200)).toBe("CHF 1’200");
    expect(formatChfPlain(89.5)).toBe("CHF 89.50");
  });
});

describe("lieu et modalités", () => {
  const loc = (items: AutoFaqItem[]) => items.find((i) => i.question.startsWith("Où"));

  it("les trois modes, avec la localité rattachée au présentiel", () => {
    expect(loc(build(EMILIE))?.answer).toBe(
      "Modalités de consultation indiquées par Émilie Chardon : en présentiel, en ligne et à domicile. Localité indiquée sur la fiche : acacias (GE).",
    );
  });

  it("en ligne seulement : la localité est donnée à part", () => {
    expect(loc(build(CAROLINE))?.answer).toBe(
      "Modalités de consultation indiquées par Caroline Roch : en ligne. Localité indiquée sur la fiche : Lausanne (VD).",
    );
  });

  it("valeur de mode inconnue ignorée, jamais inventée", () => {
    const out = loc(build({ ...EMILIE, consultation_modes: ["telepathy"] }));
    expect(out?.question).toBe("Où consulter Émilie Chardon ?");
    expect(out?.answer).toBe("Localité indiquée par Émilie Chardon : acacias (GE).");
  });

  it("présentiel sans localité : « en présentiel » sans lieu", () => {
    const out = loc(build({ ...EMILIE, city: null, canton: null, consultation_modes: ["in_person"] }));
    expect(out?.answer).toBe("Modalités de consultation indiquées par Émilie Chardon : en présentiel.");
  });
});

describe("langues", () => {
  it("libellés en base traduits dans la langue de la page, doublons retirés", () => {
    const th = { ...EMPTY, specialties: ["Reiki"], languages: ["Français", "fr", "English", "Deutsch"] };
    const a = (lang: Lang) => build(th, lang)[1].answer;
    expect(a("fr")).toBe("Langues de consultation indiquées par vanessa novel : français, anglais, allemand.");
    expect(a("de")).toBe("Von vanessa novel angegebene Konsultationssprachen: Französisch, Englisch, Deutsch.");
    expect(a("it")).toBe("Lingue di consultazione indicate da vanessa novel: francese, inglese, tedesco.");
    expect(a("en")).toBe("Consultation languages listed by vanessa novel: French, English, German.");
  });

  it("langue hors dictionnaire gardée telle que saisie", () => {
    const out = build({ ...EMPTY, specialties: ["Reiki"], languages: ["Español"] });
    expect(out[1].answer).toContain("Español");
  });
});

describe("certifications", () => {
  const certs: AutoFaqCertification[] = [
    { name: "Reiki niveau 2", issuer: "École X ·", verification_status: "verified", expires_at: null },
    { name: "Déclarée seulement", issuer: "Y", verification_status: "declared", expires_at: null },
    { name: "Expirée", issuer: "Z", verification_status: "verified", expires_at: "2020-01-01" },
    { name: "  ", issuer: "W", verification_status: "verified", expires_at: null },
  ];

  it("seules les certifications examinées et non expirées sont retenues", () => {
    expect(examinedCertifications(certs, NOW).map((c) => c.name)).toEqual(["Reiki niveau 2"]);
  });

  it("formule « justificatif examiné », séparateur orphelin retiré", () => {
    const out = build({ ...EMPTY, specialties: ["Reiki"] }, "fr", certs);
    expect(out[1]).toEqual({
      question: "Quelles certifications indiquées par vanessa novel ont un justificatif examiné par Holiswiss ?",
      answer: "Certification dont le justificatif a été examiné par Holiswiss : Reiki niveau 2 (École X).",
    });
  });

  it("au-delà de cinq, renvoi au reste de la fiche", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ name: `C${i}`, issuer: null, verification_status: "verified" }));
    const out = build({ ...EMPTY, specialties: ["Reiki"] }, "fr", many);
    expect(out[1].answer).toBe(
      "Certifications dont le justificatif a été examiné par Holiswiss : C0 ; C1 ; C2 ; C3 ; C4 et 2 autres, listées plus haut sur la fiche.",
    );
  });

  it("passent avant les langues quand quatre questions existent déjà", () => {
    const out = build({ ...EMILIE, languages: ["Français"] }, "fr", certs);
    expect(out).toHaveLength(AUTO_FAQ_MAX);
    expect(allText(out)).toContain("Reiki niveau 2");
    expect(allText(out)).not.toContain("Langues de consultation");
  });

  it("aucune préposition devant un nom de lieu libre (fr, it)", () => {
    const th = { ...EMILIE, city: "Le Grand Saconnex", consultation_modes: ["in_person"] };
    expect(allText(build(th, "fr", []))).not.toMatch(/ à Le /);
    expect(allText(build({ ...EMILIE }, "it", []))).not.toMatch(/ a acacias/);
    expect(allText(build({ ...EMPTY, specialties: ["Reiki"], city: "Olten", canton: "SO" }, "fr", []))).not.toMatch(/ de O/);
  });

  it("une langue nommée comme une propriété d'objet reste telle que saisie", () => {
    const out = build({ ...EMPTY, specialties: ["Reiki"], city: "Bern", languages: ["constructor"] }, "fr", []);
    expect(allText(out)).toContain("constructor");
    expect(allText(out)).not.toContain("language_");
  });
});

describe("garde-fous rédactionnels, dans les quatre langues", () => {
  const certs: AutoFaqCertification[] = [{ name: "Reiki", issuer: "X", verification_status: "verified" }];
  const fixtures = [EMILIE, CAROLINE, { ...EMPTY, specialties: ["Reiki"], city: "Bienne", canton: "BE" }];

  // Pronoms personnels genrés, par langue et en mots entiers : « il » est un
  // pronom en français mais l'article défini en italien (« il cui attestato »).
  const GENDERED: Record<Lang, RegExp> = {
    fr: /(?<![\p{L}'’])(il|elle|ils|elles|lui)(?![\p{L}])/iu,
    de: /(?<![\p{L}])(er|sie|ihm|ihn|ihr|ihre|seine?)(?![\p{L}])/iu,
    it: /(?<![\p{L}])(lui|lei|egli|ella|esso|essa|suo|sua)(?![\p{L}])/iu,
    en: /(?<![\p{L}])(he|she|him|her|his|hers)(?![\p{L}])/iu,
  };

  for (const lang of SUPPORTED_LANGS) {
    it(`${lang} : aucun pronom genré, jamais « vérifi/verifi/verif »`, () => {
      const texts = [
        ...fixtures.flatMap((f) => build(f, lang, certs)),
        ...build({ ...EMPTY, specialties: ["Reiki"] }, lang, certs),
      ];
      expect(texts.length).toBeGreaterThan(0);
      const out = allText(texts);
      expect(out).not.toMatch(GENDERED[lang]);
      expect(out.normalize("NFD").replace(/[̀-ͯ]/g, "")).not.toMatch(/verif/i);
      expect(out).not.toMatch(/certifi[ée] par Holiswiss/i);
      expect(out).not.toMatch(/\b(traite|soigne|guérit|guérir|heilt|behandelt|cura|guarisce|cures?|heals?|treats?)\b/i);
    });
  }

  it("le nom complet apparaît dans chaque question", () => {
    for (const lang of SUPPORTED_LANGS) {
      for (const item of build(EMILIE, lang)) expect(item.question).toContain("Émilie Chardon");
    }
  });

  it("les valeurs libres (spécialités) restent telles que saisies dans toutes les langues", () => {
    for (const lang of SUPPORTED_LANGS) {
      expect(build(EMILIE, lang)[0].answer).toContain("Hypnose, Breathwork");
    }
  });

  it("le garde-fou pronoms tombe bien si un pronom est introduit", () => {
    expect("Elle consulte en ligne").toMatch(GENDERED.fr);
    expect("Laut Profil bietet er Sitzungen an").toMatch(GENDERED.de);
    expect("Lei riceve a Lugano").toMatch(GENDERED.it);
    expect("Where does she practise").toMatch(GENDERED.en);
    // … et pas sur un nom qui contient ces lettres (Émilie, Gerald HENRY).
    expect("Émilie Chardon, Gerald HENRY").not.toMatch(GENDERED.fr);
    expect("Gerald HENRY").not.toMatch(GENDERED.en);
  });
});
