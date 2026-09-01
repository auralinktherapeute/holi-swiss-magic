import { describe, it, expect } from "vitest";
import {
  cleanInvisible,
  detectStyleTells,
  computeAiMarks,
  stripInvisibleFromArticle,
} from "./ai-watermarks";

const ZWSP = "​";
const BOM = "﻿";
const NBSP = " ";
const NNBSP = " ";

describe("cleanInvisible — couche Unicode", () => {
  it("retire les porteurs largeur-zéro", () => {
    const r = cleanInvisible(`Le reiki${ZWSP} est${BOM} doux.`);
    expect(r.text).toBe("Le reiki est doux.");
    expect(r.removed).toBe(2);
  });

  it("retire les sélecteurs de variation et les plages à usage privé isolés", () => {
    const r = cleanInvisible("texte︁propre");
    expect(r.text).toBe("textepropre");
    expect(r.removed).toBe(2);
  });

  it("préserve une séquence emoji ZWJ", () => {
    const r = cleanInvisible("un cœur ❤️‍🔥 ici");
    expect(r.text).toContain("❤️‍🔥");
    expect(r.removed).toBe(0);
  });

  it("préserve les tag characters d'un drapeau régional", () => {
    const flag = "🏴󠁧󠁢󠁳󠁣󠁴󠁿";
    const r = cleanInvisible(`drapeau ${flag} fin`);
    expect(r.text).toContain(flag);
    expect(r.removed).toBe(0);
  });

  it("garde l'insécable française avant les ponctuations doubles", () => {
    const r = cleanInvisible(`une pratique${NNBSP}: douce${NBSP}!`);
    expect(r.text).toBe(`une pratique${NNBSP}: douce${NBSP}!`);
    expect(r.replaced).toBe(0);
  });

  it("garde l'insécable après un guillemet ouvrant", () => {
    const r = cleanInvisible(`«${NBSP}citation », dit-elle`);
    expect(r.text).toContain(`«${NBSP}citation`);
  });

  it("normalise une insécable posée au milieu d'une phrase", () => {
    const r = cleanInvisible(`une${NBSP}pratique douce`);
    expect(r.text).toBe("une pratique douce");
    expect(r.replaced).toBe(1);
  });

  it("ne touche pas à un texte déjà propre", () => {
    const clean = "Le reiki est une pratique douce, née au Japon.";
    const r = cleanInvisible(clean);
    expect(r.text).toBe(clean);
    expect(r.removed + r.replaced).toBe(0);
    expect(r.hits).toHaveLength(0);
  });
});

describe("detectStyleTells — tics d'écriture français", () => {
  it("repère l'antithèse, l'ouverture panoramique et la balise de conclusion", () => {
    const keys = detectStyleTells(
      "Dans un monde où tout s'accélère, il ne s'agit pas seulement d'une technique.\n\nEn conclusion, respirez.",
    ).map((t) => t.key);
    expect(keys).toContain("in_a_world");
    expect(keys).toContain("not_only_but");
    expect(keys).toContain("conclusion_marker");
  });

  it("compte les intertitres interrogatifs consécutifs sans en perdre", () => {
    const md = "## Pour qui ?\n## Combien de séances ?\n## Où en Suisse ?\n";
    const tell = detectStyleTells(md).find((t) => t.key === "question_heading");
    expect(tell?.count).toBe(3);
  });

  it("laisse passer un usage isolé sous le seuil", () => {
    const keys = detectStyleTells("Une véritable rencontre — brève — en Valais.").map((t) => t.key);
    expect(keys).not.toContain("hollow_intensifier");
    expect(keys).not.toContain("em_dash");
  });

  it("ne signale rien sur une prose humaine ordinaire", () => {
    expect(
      detectStyleTells(
        "La praticienne reçoit à Lausanne le mardi. Les séances durent une heure. Elle travaille surtout avec des personnes qui dorment mal.",
      ),
    ).toHaveLength(0);
  });
});

describe("computeAiMarks / stripInvisibleFromArticle — au niveau article", () => {
  const article = {
    title_fr: `Reiki${ZWSP} et sommeil`,
    body_fr: "## Dans un monde où le stress domine\n\nPlongeons dans la pratique.",
    body_de: `Reiki${BOM} und Schlaf`,
    excerpt_fr: "Un chapô propre.",
  };

  it("agrège les porteurs invisibles de toutes les langues", () => {
    const r = computeAiMarks(article);
    expect(r.invisibleCount).toBe(2);
    expect(r.invisibleFields).toEqual(["title_fr", "body_de"]);
    expect(r.dirty).toBe(true);
  });

  it("ne produit un patch que pour les champs réellement modifiés", () => {
    const { patch, removed } = stripInvisibleFromArticle(article);
    expect(Object.keys(patch).sort()).toEqual(["body_de", "title_fr"]);
    expect(patch.title_fr).toBe("Reiki et sommeil");
    expect(removed).toBe(2);
  });

  it("déclare propre un article sans trace", () => {
    const r = computeAiMarks({
      title_fr: "Reiki et sommeil en Suisse romande",
      body_fr: "La praticienne reçoit à Lausanne le mardi. Les séances durent une heure.",
    });
    expect(r.dirty).toBe(false);
    expect(r.invisibleCount).toBe(0);
    expect(r.styleTells).toHaveLength(0);
  });
});
