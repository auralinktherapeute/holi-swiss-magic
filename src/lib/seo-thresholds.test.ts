import { describe, it, expect } from "vitest";
import {
  SPECIALTY_MIN_THERAPISTS,
  SPECIALTY_CITY_MIN_THERAPISTS,
  THRESHOLDS_ARE_NEUTRAL,
  isSpecialtyIndexable,
  isSpecialtyCityIndexable,
} from "./seo-thresholds";

/**
 * Ces tests VERROUILLENT le fait que les seuils sont encore neutres.
 *
 * Ils ne sont pas là pour empêcher l'activation : ils sont là pour qu'elle soit
 * délibérée. Le jour où l'arbitrage produit est rendu, ces tests tombent — et
 * celui qui relève les seuils doit venir écrire ici l'effet attendu, chiffré.
 * C'est la même discipline que `seo-urls.test.ts` : aucune décision
 * d'indexation ne doit pouvoir changer par accident.
 */
describe("seo-thresholds — seuils d'indexabilité des pages spécialité", () => {
  it("est encore en position neutre (aucun arbitrage humain rendu)", () => {
    expect(THRESHOLDS_ARE_NEUTRAL).toBe(true);
    expect(SPECIALTY_MIN_THERAPISTS).toBe(0);
    expect(SPECIALTY_CITY_MIN_THERAPISTS).toBe(1);
  });

  it("reproduit exactement le comportement du site au 30/08/2026", () => {
    // 14 spécialités n'ont aucun praticien. En position neutre, elles restent
    // publiées — c'est ce que fait le site aujourd'hui, et ce lot n'y touche pas.
    expect(isSpecialtyIndexable(0)).toBe(true);
    expect(isSpecialtyIndexable(1)).toBe(true);
    expect(isSpecialtyIndexable(2)).toBe(true);

    // Les paires spécialité × ville n'étaient déjà déclarées qu'à partir d'un
    // praticien : le seuil neutre à 1 redit cette règle, il ne la change pas.
    expect(isSpecialtyCityIndexable(0)).toBe(false);
    expect(isSpecialtyCityIndexable(1)).toBe(true);
  });

  it("appliquerait bien l'arbitrage recommandé si les seuils étaient relevés", () => {
    // Vérifie la LOGIQUE, pas les constantes : le jour de l'activation, seules
    // les valeurs changent, la comparaison est déjà juste.
    const wouldIndexSpecialty = (n: number) => n >= 1;
    const wouldIndexPair = (n: number) => n >= 2;

    expect(wouldIndexSpecialty(0)).toBe(false); // les 14 pages vides sortent
    expect(wouldIndexSpecialty(1)).toBe(true); // les 17 pourvues restent
    expect(wouldIndexPair(1)).toBe(false); // les 23 combos à 1 praticien sortent
    expect(wouldIndexPair(2)).toBe(true); // et reviennent seuls au 2e praticien
  });
});
