import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SPECIALTY_MIN_THERAPISTS,
  SPECIALTY_CITY_MIN_THERAPISTS,
  CITY_MIN_THERAPISTS,
  CANTON_MIN_THERAPISTS,
  FAMILY_MIN_THERAPISTS,
  THRESHOLDS_ARE_NEUTRAL,
  isSpecialtyIndexable,
  isSpecialtyCityIndexable,
  isCityIndexable,
  isCantonIndexable,
  isFamilyIndexable,
} from "./seo-thresholds";

/**
 * Ces tests VERROUILLENT l'arbitrage rendu le 29/09/2026 (audit Search
 * Console : 2 fiches pour les pages ville, canton, spécialité et famille),
 * qui prolonge celui du 07/09/2026.
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
  it("porte l'arbitrage du 29/09/2026 (audit Search Console) : 2 fiches partout", () => {
    expect(THRESHOLDS_ARE_NEUTRAL).toBe(false);
    expect(SPECIALTY_MIN_THERAPISTS).toBe(2);
    expect(SPECIALTY_CITY_MIN_THERAPISTS).toBe(2);
    expect(CITY_MIN_THERAPISTS).toBe(2);
    expect(CANTON_MIN_THERAPISTS).toBe(2);
    expect(FAMILY_MIN_THERAPISTS).toBe(2);
  });

  it("retire les pages spécialité à 0 ou 1 praticien, garde celles qui en ont 2", () => {
    // 07/09/2026 : seuil 1 (spécialités vides retirées). 29/09/2026 : seuil 2.
    // Mesuré sur qqwud le 29/09 : 15 spécialités au sitemap → 7 (10 retirées
    // à 1 praticien, 2 ajoutées — gestion-du-stress et meditation, que le
    // sitemap taisait parce qu'il comptait via les paires géolocalisées).
    expect(isSpecialtyIndexable(0)).toBe(false);
    expect(isSpecialtyIndexable(1)).toBe(false);
    expect(isSpecialtyIndexable(2)).toBe(true);
  });

  it("ville, canton, famille : indexables à partir de 2 fiches", () => {
    for (const f of [isCityIndexable, isCantonIndexable, isFamilyIndexable]) {
      expect(f(0)).toBe(false);
      expect(f(1)).toBe(false);
      expect(f(2)).toBe(true);
      expect(f(13)).toBe(true);
    }
  });

  it("exige deux praticiens pour une paire spécialité × ville", () => {
    // Seuil 2 depuis le 07/09/2026. Au 29/09 (qqwud), aucune paire n'atteint
    // 2 praticiens : le sitemap n'en déclare aucune. Elles reviendront d'elles-
    // mêmes dès qu'une ville comptera deux praticiens de la même spécialité.
    expect(isSpecialtyCityIndexable(0)).toBe(false);
    expect(isSpecialtyCityIndexable(1)).toBe(false);
    expect(isSpecialtyCityIndexable(2)).toBe(true);
  });

  it("29/09/2026 : 453 → 381 URLs — chiffres MESURÉS sur la production", () => {
    // Sitemap en ligne du 29/09 comparé au sitemap rendu par la route modifiée
    // contre qqwud (mêmes données). Historique : le 07/09/2026, le passage à
    // 1 (spécialités) et 2 (paires) avait retiré 152 URLs (600 → 448).
    const LANGS = 4;
    const specialties = { before: 15, after: 7 }; // −10 à 1 praticien, +2 (gestion-du-stress, meditation)
    const cities = { before: 9, after: 1 }; // seule Genève a 2 fiches
    const cantons = { before: 4, after: 2 }; // GE et VD (4 chacun) ; BS et BE à 1
    const families = { before: 4, after: 4 }; // 5, 4, 6 et 6 praticiens distincts
    const removed =
      (specialties.before - specialties.after +
        cities.before - cities.after +
        cantons.before - cantons.after +
        families.before - families.after) * LANGS;
    expect(removed).toBe(72);
    expect(453 - removed).toBe(381);
  });
});

/**
 * Règle 2 de `seo-thresholds.ts` : le sitemap et la route lisent le MÊME
 * helper, et la route le lit dans son LOADER (règle 1). Ce test lit les
 * sources : un seuil recopié en dur (`length > 0`, `>= 2`) dans une route ou
 * dans le sitemap le fait tomber.
 */
describe("seo-thresholds — sitemap et routes partagent le même helper", () => {
  // Chemins résolus depuis CE fichier, pas depuis le répertoire courant.
  const ROUTES_DIR = fileURLToPath(new URL("../routes/", import.meta.url));
  const read = (name: string) => readFileSync(join(ROUTES_DIR, name), "utf-8");
  // Les commentaires citent volontiers « loader: », « head: » ou le nom du
  // helper : on les retire avant de découper, sinon le test vérifie de la prose.
  const code = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const SITEMAP = "sitemap[.]xml.ts";
  const ROUTES: Array<[string, string]> = [
    ["$lang.therapeutes.ville.$citySlug.tsx", "isCityIndexable"],
    ["$lang.therapeutes.canton.$canton.tsx", "isCantonIndexable"],
    ["$lang.therapeutes.famille.$familySlug.tsx", "isFamilyIndexable"],
    ["$lang.specialites.$specialtySlug.index.tsx", "isSpecialtyIndexable"],
    ["$lang.specialites.$specialtySlug.$citySlug.tsx", "isSpecialtyCityIndexable"],
  ];
  const importsHelper = (src: string, helper: string) =>
    new RegExp(`import\\s*\\{[^}]*\\b${helper}\\b[^}]*\\}\\s*from\\s*"@/lib/seo-thresholds"`).test(src);

  it.each(ROUTES)("%s importe et appelle %s DANS son loader", (file, helper) => {
    const src = code(read(file));
    expect(importsHelper(src, helper)).toBe(true);
    const start = src.indexOf("loader:");
    const end = src.indexOf("head:");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(src.slice(start, end)).toContain(`${helper}(`);
    // `head` relit la décision du loader, il ne la recalcule pas.
    const head = src.slice(end);
    expect(head).not.toContain(`${helper}(`);
    expect(head).toMatch(/loaderData[^;]*\?\.indexable/);
  });

  it.each(ROUTES)("le sitemap importe et appelle le helper de %s", (_file, helper) => {
    const src = code(read(SITEMAP));
    expect(importsHelper(src, helper)).toBe(true);
    expect(src).toContain(`${helper}(`);
  });
});
