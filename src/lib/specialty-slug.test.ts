import { describe, expect, it } from "vitest";
import { specSlugForLang } from "./specialty-slug";

const mtc = { slug: "medecine-chinoise", slug_de: "chinesische-medizin", slug_it: "medicina-cinese", slug_en: "chinese-medicine" };

describe("specSlugForLang", () => {
  it("donne le slug localisé de chaque langue", () => {
    expect(specSlugForLang(mtc, "fr")).toBe("medecine-chinoise");
    expect(specSlugForLang(mtc, "de")).toBe("chinesische-medizin");
    expect(specSlugForLang(mtc, "it")).toBe("medicina-cinese");
    expect(specSlugForLang(mtc, "en")).toBe("chinese-medicine");
  });

  it("se replie sur le slug de base si la variante manque", () => {
    expect(specSlugForLang({ slug: "reiki" }, "de")).toBe("reiki");
    expect(specSlugForLang({ slug: "reiki", slug_it: "" }, "it")).toBe("reiki");
    expect(specSlugForLang({ slug: "reiki", slug_en: null }, "en")).toBe("reiki");
  });
});
