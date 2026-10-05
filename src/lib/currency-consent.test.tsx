import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import fr from "@/i18n/fr.json";
import de from "@/i18n/de.json";
import it_ from "@/i18n/it.json";
import en from "@/i18n/en.json";
import { balancesByCurrency, buildCurrencyWarning, formatAmount, resolveEffectiveCurrency } from "./currency-consent";

describe("priorité de devise", () => {
  it("hérite de la devise du cabinet", () => {
    expect(resolveEffectiveCurrency(null, "EUR")).toEqual({ currency: "EUR", source: "practice_default" });
  });
  it("exception client prioritaire", () => {
    expect(resolveEffectiveCurrency("EUR", "CHF")).toEqual({ currency: "EUR", source: "client_override" });
  });
  it("retour au cabinet quand l'exception est supprimée", () => {
    expect(resolveEffectiveCurrency(null, "CHF").currency).toBe("CHF");
  });
  it("CHF en secours technique", () => {
    expect(resolveEffectiveCurrency(undefined, null)).toEqual({ currency: "CHF", source: "fallback" });
  });
});

describe("affichage", () => {
  it("code ISO, jamais symbole", () => {
    expect(formatAmount(120, "CHF")).toBe("120.00 CHF");
    expect(formatAmount(120, "EUR")).toBe("120.00 EUR");
  });
  it("soldes séparés par devise, jamais additionnés", () => {
    const b = balancesByCurrency([
      { currency: "CHF", solde: 100 }, { currency: "EUR", solde: 80 }, { currency: "CHF", solde: 60 },
    ]);
    expect(b).toEqual([{ currency: "CHF", amount: 160 }, { currency: "EUR", amount: 80 }]);
  });
});

describe("textes FR/DE/IT/EN", () => {
  const keys = Object.keys((fr as any).currency);
  for (const [l, d] of Object.entries({ de, it: it_, en })) {
    it(`${l} contient toutes les clés`, () => {
      expect(Object.keys((d as any).currency).sort()).toEqual([...keys].sort());
    });
  }
  it("avertissement client contient le nom et le texte exact demandé", () => {
    const w = buildCurrencyWarning("client", "fr", "Cathy Nicoud");
    expect(w).toContain("futures factures et opérations de Cathy Nicoud");
    expect(w).toContain("J’ai compris que ce changement concerne uniquement les futures opérations de ce client.");
    expect(buildCurrencyWarning("practice", "de")).toContain("Währungswechsel bestätigen");
  });
});

describe("pop-up de confirmation", () => {
  it("bouton « Confirmer le changement » désactivé tant que la case n'est pas cochée", async () => {
    const { CurrencyChangeDialog } = await import("@/components/dashboard/CurrencyChangeDialog");
    const inst = i18n.createInstance();
    await inst.init({ lng: "fr", resources: { fr: { translation: fr } } });
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={inst}>
        <CurrencyChangeDialog open title="T" warning="W" ackLabel="A" onCancel={() => {}} onConfirm={() => {}} />
      </I18nextProvider>,
    );
    // Radix Dialog rend en portail côté client : on vérifie la règle dans la source.
    const src = readFileSync("src/components/dashboard/CurrencyChangeDialog.tsx", "utf8");
    expect(src).toMatch(/disabled=\{!ack \|\|/);
    expect(src).toMatch(/if \(!o && !p\.pending\) p\.onCancel\(\)/);
    expect(typeof html).toBe("string");
  });
  it("le formulaire des réglages ne peut plus changer la devise directement", () => {
    const src = readFileSync("src/lib/therapist-invoices.functions.ts", "utf8");
    expect(src).toContain("const { devise_defaut: _ignored, ...updatePayload } = payload;");
  });
});
