import { describe, it, expect } from "vitest";
import {
  SPECIALTY_MIN_THERAPISTS,
  SPECIALTY_CITY_MIN_THERAPISTS,
  THRESHOLDS_ARE_NEUTRAL,
  isSpecialtyIndexable,
  isSpecialtyCityIndexable,
} from "./seo-thresholds";

/**
 * Ces tests VERROUILLENT l'arbitrage rendu le 07/09/2026.
 *
 * Ils remplacent les tests de position neutre, qui existaient pour que
 * l'activation soit délibérée plutôt qu'accidentelle. Elle l'a été : Gérald a
 * tranché sur l'audit d'indexation (`docs/audit-indexation-2026-09-07.md`, §2.3
 * et étage C). Comme le prévoyait la consigne laissée par le lot précédent,
 * celui qui relève les seuils vient écrire ici l'effet attendu, chiffré.
 *
 * Toute modification ultérieure des seuils doit à son tour mettre ces chiffres
 * à jour : aucune décision d'indexation ne doit pouvoir changer par accident.
 */
describe("seo-thresholds — seuils d'indexabilité des pages spécialité", () => {
  it("porte l'arbitrage du 07/09/2026, plus la position neutre", () => {
    expect(THRESHOLDS_ARE_NEUTRAL).toBe(false);
    expect(SPECIALTY_MIN_THERAPISTS).toBe(1);
    expect(SPECIALTY_CITY_MIN_THERAPISTS).toBe(2);
  });

  it("retire les pages spécialité sans praticien, garde celles qui en ont", () => {
    // 14 spécialités actives sur 31 n'ont aucun praticien (relevé du 30/08,
    // inchangé au 07/09). Elles servaient « 0 thérapeute en Sophrologie » sur
    // ~160 mots en index,follow : 14 × 4 langues = 56 URLs retirées du sitemap
    // et passées en noindex,follow.
    expect(isSpecialtyIndexable(0)).toBe(false);
    // Les 17 spécialités pourvues restent : la page garde sa valeur de
    // définition et de maillage dès un praticien.
    expect(isSpecialtyIndexable(1)).toBe(true);
    expect(isSpecialtyIndexable(2)).toBe(true);
  });

  it("exige deux praticiens pour une paire spécialité × ville", () => {
    // Les 23 paires distinctes portent aujourd'hui exactement 1 praticien
    // chacune : à un seul, la page est un sous-ensemble strict de sa fiche.
    // 23 × 4 langues = 92 URLs retirées. Elles reviendront d'elles-mêmes dès
    // qu'une ville comptera deux praticiens de la même spécialité — le seuil
    // n'a alors rien à changer.
    expect(isSpecialtyCityIndexable(0)).toBe(false);
    expect(isSpecialtyCityIndexable(1)).toBe(false);
    expect(isSpecialtyCityIndexable(2)).toBe(true);
  });

  it("retire 148 URLs au total, soit un quart du sitemap", () => {
    const SPECIALTIES_WITHOUT_THERAPIST = 14;
    const PAIRS_WITH_ONE_THERAPIST = 23;
    const LANGS = 4;
    const removed =
      SPECIALTIES_WITHOUT_THERAPIST * LANGS + PAIRS_WITH_ONE_THERAPIST * LANGS;
    expect(removed).toBe(148);
    // Sitemap relevé à 600 URLs le 07/09 → ~452 après application.
    expect(600 - removed).toBe(452);
  });
});
