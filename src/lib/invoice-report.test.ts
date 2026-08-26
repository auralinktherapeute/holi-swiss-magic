import { describe, it, expect } from "vitest";
import { toCsv, buildInvoiceReport } from "@/lib/invoice-report.server";

function mockSupabase(tables: Record<string, any[]>) {
  return {
    from(table: string) {
      const rows = tables[table] ?? [];
      const q: any = {
        _rows: rows,
        select() { return q; },
        eq() { return q; },
        gte(col: string, v: string) { q._rows = q._rows.filter((r: any) => String(r[col]) >= v); return q; },
        lte(col: string, v: string) { q._rows = q._rows.filter((r: any) => String(r[col]) <= v); return q; },
        in(col: string, vals: string[]) { q._rows = q._rows.filter((r: any) => vals.includes(r[col])); return q; },
        order() { return Promise.resolve({ data: q._rows, error: null }); },
        maybeSingle() { return Promise.resolve({ data: q._rows[0] ?? null, error: null }); },
        then(res: any) { return Promise.resolve({ data: q._rows, error: null }).then(res); },
      };
      return q;
    },
  };
}

describe("toCsv", () => {
  it("échappe les séparateurs et guillemets, et ajoute le BOM", () => {
    const csv = toCsv(["a", "b"], [["x;y", 'di"t']]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"x;y";"di""t"');
  });

  it("rend les valeurs nulles comme cellules vides", () => {
    expect(toCsv(["a"], [[null]])).toContain("a\r\n\r\n");
  });
});

describe("buildInvoiceReport", () => {
  const supabase = mockSupabase({
    therapist_invoices: [
      { id: "i1", statut: "payee", montant_ht: 100, tva_montant: 8.1, montant_total: 108.1, montant_paye: 108.1, currency: "CHF", date_emission: "2026-01-10", date_echeance: "2026-02-10" },
      { id: "i2", statut: "envoyee", montant_ht: 200, tva_montant: 16.2, montant_total: 216.2, montant_paye: 0, currency: "CHF", date_emission: "2026-02-05", date_echeance: "2026-03-05" },
      { id: "i3", statut: "brouillon", montant_ht: 999, tva_montant: 0, montant_total: 999, montant_paye: 0, currency: "CHF", date_emission: "2026-02-06", date_echeance: null },
      { id: "i4", statut: "annulee", montant_ht: 50, tva_montant: 0, montant_total: 50, montant_paye: 0, currency: "CHF", date_emission: "2026-02-07", date_echeance: null },
      { id: "i5", statut: "payee", montant_ht: 10, tva_montant: 0, montant_total: 10, montant_paye: 10, currency: "CHF", date_emission: "2025-12-31", date_echeance: null },
    ],
    therapist_invoice_lines: [
      { invoice_id: "i1", montant_ht: 100, tva_taux: 8.1, tva_montant: 8.1 },
      { invoice_id: "i2", montant_ht: 150, tva_taux: 8.1, tva_montant: 12.15 },
      { invoice_id: "i2", montant_ht: 50, tva_taux: 8.1, tva_montant: 4.05 },
      { invoice_id: "i3", montant_ht: 999, tva_taux: 2.6, tva_montant: 25.97 },
    ],
    therapist_invoice_settings: [{ devise_defaut: "CHF", assujetti_tva: true }],
  });

  it("exclut brouillons, annulées et périodes hors bornes", async () => {
    const r = await buildInvoiceReport(supabase, "t1", { from: "2026-01-01", to: "2026-12-31" });
    expect(r.totals.invoices).toBe(2);
    expect(r.totals.ht).toBe(300);
    expect(r.totals.ttc).toBe(324.3);
    expect(r.totals.encaisse).toBe(108.1);
    expect(r.totals.solde).toBe(216.2);
  });

  it("agrège par mois dans l'ordre chronologique", async () => {
    const r = await buildInvoiceReport(supabase, "t1", { from: "2026-01-01", to: "2026-12-31" });
    expect(r.monthly.map((m) => m.month)).toEqual(["2026-01", "2026-02"]);
    expect(r.monthly[0]!.ttc).toBe(108.1);
    expect(r.monthly[1]!.encaisse).toBe(0);
  });

  it("ne compte la TVA que des lignes de factures retenues", async () => {
    const r = await buildInvoiceReport(supabase, "t1", { from: "2026-01-01", to: "2026-12-31" });
    expect(r.vat).toEqual([{ rate: 8.1, base_ht: 300, tva: 24.3 }]);
    expect(r.assujetti_tva).toBe(true);
    expect(r.vat_mode).toBe("facture");
  });
});
