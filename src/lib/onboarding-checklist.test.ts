import { describe, it, expect } from "vitest";
import fr from "@/i18n/fr.json";
import de from "@/i18n/de.json";
import it_ from "@/i18n/it.json";
import en from "@/i18n/en.json";
import {
  computeSetupChecklist,
  countDone,
  resumeTourStep,
  shouldAutoOpenTour,
  shouldShowChecklistCard,
  showNewBadge,
  SETUP_STEPS,
  TOUR_LENGTH,
} from "./onboarding-checklist";
import { TOUR_TARGETS } from "@/components/dashboard/OnboardingTour";

const empty = {
  activeServicesWithPrice: 0,
  packages: 0,
  practiceCurrencyConsents: 0,
  activeAvailabilities: 0,
};

describe("checklist du cabinet", () => {
  it("n'invente aucun état terminé sur un profil vide", () => {
    const c = computeSetupChecklist(empty, {});
    expect(countDone(c)).toBe(0);
  });

  it("déduit les étapes des vraies données", () => {
    const c = computeSetupChecklist(
      {
        bio: "Une présentation assez longue pour compter.",
        specialties: ["reiki"],
        address: "Rue du Lac 1",
        activeServicesWithPrice: 1,
        packages: 0,
        practiceCurrencyConsents: 1,
        activeAvailabilities: 3,
        iban: "CH9300762011623852957",
        billingStreet: "Rue du Lac 1",
      },
      {},
    );
    expect(c).toMatchObject({ profile: true, services: true, currency: true, availability: true, billing: true });
    expect(c.publicPage).toBe(false);
    expect(c.booking).toBe(false);
  });

  it("valide les étapes non déductibles seulement après un événement explicite", () => {
    const c = computeSetupChecklist(empty, {
      public_page_viewed: "2026-10-05T10:00:00Z",
      booking_checked: "2026-10-05T10:01:00Z",
      currency_confirmed: "2026-10-05T10:02:00Z",
    });
    expect(c.publicPage && c.booking && c.currency).toBe(true);
    expect(computeSetupChecklist(empty, { public_page_viewed: "" }).publicPage).toBe(false);
  });

  it("carte visible tant que les 7 étapes ne sont pas faites, ou rouverte", () => {
    const all = Object.fromEntries(SETUP_STEPS.map((k) => [k, true])) as never;
    expect(shouldShowChecklistCard(all, false)).toBe(false);
    expect(shouldShowChecklistCard(all, true)).toBe(true);
    expect(shouldShowChecklistCard(computeSetupChecklist(empty, {}), false)).toBe(true);
  });
});

describe("guide en 8 étapes", () => {
  it("reprend à la dernière étape atteinte, bornée", () => {
    expect(resumeTourStep(null)).toBe(0);
    expect(resumeTourStep({ tour_step: 4 })).toBe(4);
    expect(resumeTourStep({ tour_step: 99 })).toBe(TOUR_LENGTH - 1);
    expect(resumeTourStep({ tour_step: 4, tour_completed_at: "x" })).toBe(0);
  });

  it("badge Nouveau jusqu'au premier lancement", () => {
    expect(showNewBadge(null)).toBe(true);
    expect(showNewBadge({ tour_started_at: "2026-10-05" })).toBe(false);
  });

  it("ouverture automatique seulement si jamais lancé", () => {
    expect(shouldAutoOpenTour(false, null)).toBe(true);
    expect(shouldAutoOpenTour(false, { tour_started_at: "x" })).toBe(false);
    expect(shouldAutoOpenTour(true, null)).toBe(false);
  });

  it("une cible par étape", () => {
    expect(TOUR_TARGETS).toHaveLength(TOUR_LENGTH);
  });
});

describe("traductions FR/DE/IT/EN", () => {
  const keys = (o: unknown, p = ""): string[] =>
    o && typeof o === "object"
      ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k))
      : [p];
  const ref = keys(fr.onboarding).sort();
  for (const [name, d] of [["de", de], ["it", it_], ["en", en]] as const) {
    it(`${name} a toutes les clés`, () => {
      expect(keys(d.onboarding).sort()).toEqual(ref);
    });
  }
  it("8 étapes de guide et 7 étapes de checklist", () => {
    expect(fr.onboarding.tour.steps).toHaveLength(8);
    expect(Object.keys(fr.onboarding.checklist.steps)).toEqual([...SETUP_STEPS]);
  });
});
