import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import fr from "@/i18n/fr.json";
import { BookingDetailsStep } from "./BookingDetailsStep";

const inst = i18n.createInstance();
inst.init({ lng: "fr", resources: { fr: { translation: fr } }, initImmediate: false });

const html = renderToStaticMarkup(
  <I18nextProvider i18n={inst}>
    <BookingDetailsStep date="2026-10-15" time="11:30" durationMin={60} serviceName="Séance test"
      form={{ name: "", email: "", phone: "", notes: "" }} errors={{}} submitting={false}
      onChange={() => {}} onBack={() => {}} onSubmit={() => {}} />
  </I18nextProvider>,
);

describe("étape de confirmation de réservation", () => {
  it("affiche l'indicateur d'étapes, « Modifier le créneau » et le bouton exact", () => {
    expect(html).toContain("1. Créneau");
    expect(html).toContain("2. Coordonnées");
    expect(html).toContain("3. Confirmation");
    expect(html).toContain("Modifier le créneau");
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Confirmer la réservation<\/button>/);
    expect(html).not.toMatch(/Réserver le/);
  });

  it("le widget n'a plus de formulaire inline ni de bouton « Réserver le … » après choix du créneau", () => {
    const src = readFileSync("src/components/booking/BookingWidget.tsx", "utf8");
    expect(src).not.toContain("booking.book_at");
    expect(src).not.toMatch(/<form\b/);
    expect(src).not.toMatch(/<Input\b|<Textarea\b/);
    expect(src).toMatch(/setSelectedTime\(s\);[^}]*setStep\("details"\)/);
    expect(src).toMatch(/step === "details"[\s\S]{0,200}<BookingDetailsStep/);
  });
});
