import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const nav = readFileSync("src/components/layout/MobileDashboardNav.tsx", "utf8");
const client = readFileSync("src/routes/dashboard.clients.tsx", "utf8");
const invoice = readFileSync("src/components/dashboard/QuickInvoiceDialog.tsx", "utf8");

describe("contrats des interfaces de facturation mobile", () => {
  it("Clients suit Facturation dans le menu secondaire, avec la destination exacte", () => {
    expect(nav).toMatch(/to: "\/dashboard\/facturation"[^\n]*\n\s*\{ to: "\/dashboard\/clients", icon: Users, label: "Clients"/);
  });
  it("conserve les destinations existantes du menu", () => {
    for (const path of ["reservations", "forfaits", "questionnaires", "facturation", "visibilite", "avis", "evenements", "salons", "abonnement", "parrainage"]) {
      expect(nav).toContain(`to: "/dashboard/${path}"`);
    }
    expect(nav).toContain('max-h-[90dvh] overflow-y-auto');
  });
  it("limite les deux fenêtres à la hauteur visible et réserve le défilement au contenu", () => {
    for (const source of [client, invoice]) {
      expect(source).toMatch(/DialogContent className="flex max-w-[^\s]+ max-h-\[90dvh\] flex-col overflow-hidden p-4 sm:p-6"/);
      expect(source).toContain("min-h-0 min-w-0 overflow-y-auto");
    }
  });
  it("garde titre et création hors du contenu défilant et laisse les onglets revenir à la ligne", () => {
    expect(client).toContain('DialogHeader className="shrink-0"');
    expect(client).toContain('grid-cols-[minmax(0,1fr)]');
    expect(client).toContain('flex w-full flex-wrap h-auto justify-start gap-1');
  });
  it("garde les quatre actions de facture dans une zone atteignable", () => {
    expect(invoice).toContain('DialogFooter className="shrink-0 max-h-[45dvh] overflow-y-auto');
    for (const label of ["Annuler", "Enregistrer comme brouillon", "Créer sans encaisser", "Créer et encaisser"]) expect(invoice).toContain(label);
  });
  it("conserve les largeurs et les dispositions bureau", () => {
    expect(client).toContain("max-w-3xl");
    expect(invoice).toContain("max-w-2xl");
    expect(invoice).toContain("sm:flex-row sm:flex-wrap sm:justify-end");
    expect(invoice).toContain("sm:grid-cols-4");
  });
});