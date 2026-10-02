import { describe, expect, it } from "vitest";
import { CATEGORY_COPY } from "@/components/holiswiss/CategoryTherapistsPage";

// Aucun profil n'est « vérifié » en production : les fiches sont validées
// manuellement par Holiswiss. Même règle que les pages ville/canton/famille.
describe("CATEGORY_COPY — meta descriptions", () => {
  const entries = Object.entries(CATEGORY_COPY).flatMap(([slug, byLang]) =>
    Object.entries(byLang).map(([lang, copy]) => ({ slug, lang, copy })),
  );

  it("couvre les 2 catégories en 4 langues", () => {
    expect(entries).toHaveLength(8);
  });

  it.each(entries)("$slug/$lang ne promet pas de profils vérifiés", ({ copy }) => {
    const text = `${copy.title} ${copy.description} ${copy.intro} ${copy.h1}`;
    expect(text).not.toMatch(/vérifié|verificat|verified/i);
  });
});
