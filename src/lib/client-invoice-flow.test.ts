// Intégration du flux « facture depuis la fiche client » sur une base en mémoire
// jetable (données fictives, aucun accès réseau, aucune donnée de production).
import { describe, it, expect, beforeEach, vi } from "vitest";

type Row = Record<string, any>;
const tick = () => new Promise((r) => setTimeout(r, 0));

function makeDb(opts: { unique?: boolean; skipPrior?: boolean; failInsert?: any } = {}) {
  const tables: Record<string, Row[]> = {
    therapist_invoices: [], therapist_invoice_lines: [], therapist_invoice_payments: [],
    therapist_invoice_audit: [],
    crm_client_contacts: [{ id: "c1", therapist_id: "t1", first_name: "Test", last_name: "Fictif",
      email: "fictif@example.invalid", billing_currency: null, address_line1: "Rue 1", postal_code: "1000", city: "Lausanne" }],
    therapist_invoice_settings: [{ therapist_id: "t1", mode_tva: "exclusive", devise_defaut: "CHF",
      delai_paiement_jours: 30, conditions_paiement: null, iban: "CH9300762011623852957" }],
  };
  let seq = 0, num = 0, priorSkipped = false;
  const get = (r: Row, c: string) => c.includes("->>") ? r[c.split("->>")[0]]?.[c.split("->>")[1]] : r[c];
  function q(table: string) {
    const filters: Array<[string, any]> = [];
    const orders: Array<[string, boolean]> = [];
    let op: "select" | "insert" | "update" | "delete" = "select";
    let payload: any = null;
    const match = () => tables[table].filter((r) => filters.every(([c, v]) => get(r, c) === v));
    const run = async () => {
      await tick();
      if (op === "insert") {
        const rows: Row[] = (Array.isArray(payload) ? payload : [payload]).map((r: Row) => ({
          id: `${table}-${++seq}`, created_at: new Date(1e12 + seq).toISOString(), ...r }));
        if (table === "therapist_invoices" && opts.unique) {
          for (const r of rows) {
            const rid = r.metadata?.request_id;
            if (rid != null && tables[table].some((x) => x.therapist_id === r.therapist_id && x.metadata?.request_id === rid)) {
              return { data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "ti_therapist_request_id_uniq"' } };
            }
          }
        }
        if (table === "therapist_invoices" && opts.failInsert) return { data: null, error: opts.failInsert };
        tables[table].push(...rows);
        return { data: rows, error: null };
      }
      if (op === "update") { match().forEach((r) => Object.assign(r, payload)); return { data: null, error: null }; }
      if (op === "delete") {
        const del = new Set(match());
        tables[table] = tables[table].filter((r) => !del.has(r));
        return { data: null, error: null };
      }
      if (opts.skipPrior && table === "therapist_invoices" && filters.some(([c]) => c === "metadata->>request_id") && !priorSkipped) { priorSkipped = true; return { data: [], error: null }; }
      let rows = match();
      for (const [c, asc] of [...orders].reverse()) rows = [...rows].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
      return { data: rows, error: null };
    };
    const b: any = {
      select: () => b, eq: (c: string, v: any) => (filters.push([c, v]), b),
      order: (c: string, o?: { ascending?: boolean }) => (orders.push([c, o?.ascending !== false]), b),
      insert: (p: any) => ((op = "insert"), (payload = p), b),
      update: (p: any) => ((op = "update"), (payload = p), b),
      delete: () => ((op = "delete"), b),
      maybeSingle: async () => {
        const { data, error } = await run();
        if (error) return { data: null, error };
        const arr = data ?? [];
        if (arr.length > 1) return { data: null, error: { message: "multiple rows" } };
        return { data: arr[0] ?? null, error: null };
      },
      then: (res: any, rej: any) => run().then(res, rej),
    };
    return b;
  }
  const supabase = {
    from: q,
    rpc: async () => { await tick(); num++; return { data: [{ numero_facture: `2026-${String(num).padStart(4, "0")}`, annee: 2026, seq: num }], error: null }; },
  };
  return { supabase, tables };
}

const lines = [
  { description: "Séance fictive", quantite: 1, prix_unitaire: 100, tva_taux: 8.1 },
  { description: "Supplément fictif", quantite: 2, prix_unitaire: 25, tva_taux: 0 },
];

async function load() {
  vi.resetModules();
  return import("@/lib/cabinet-billing.server");
}

describe("createClientInvoice — facture libre sans rendez-vous", () => {
  let db: ReturnType<typeof makeDb>;
  beforeEach(() => { db = makeDb(); });

  it("crée un brouillon libre à deux lignes avec totaux et TVA", async () => {
    const { createClientInvoice } = await load();
    const r = await createClientInvoice(db.supabase, "t1", "u1", { client_id: "c1", lines, action: "draft", request_id: "r-draft" });
    expect(r.statut).toBe("brouillon");
    const inv = db.tables.therapist_invoices[0];
    expect(inv.appointment_id).toBeNull();
    expect(inv.client_id).toBe("c1");
    expect(db.tables.therapist_invoice_lines).toHaveLength(2);
    expect(inv.montant_ht).toBeCloseTo(150, 2);
    expect(inv.tva_montant).toBeCloseTo(8.1, 2);
    expect(inv.montant_total).toBeCloseTo(158.1, 2);
    expect(db.tables.therapist_invoice_payments).toHaveLength(0);
  });

  it("refuse l'encaissement sans moyen ou sans date", async () => {
    const { createClientInvoice } = await load();
    await expect(createClientInvoice(db.supabase, "t1", "u1", { client_id: "c1", lines, action: "settle", request_id: "r1", payment: { mode: "twint", date: "" } })).rejects.toThrow();
    await expect(createClientInvoice(db.supabase, "t1", "u1", { client_id: "c1", lines, action: "settle", request_id: "r2", payment: null })).rejects.toThrow();
    expect(db.tables.therapist_invoices).toHaveLength(0);
  });

  it("crée et encaisse avec moyen et date confirmés", async () => {
    const { createClientInvoice } = await load();
    const r = await createClientInvoice(db.supabase, "t1", "u1", { client_id: "c1", lines, action: "settle", request_id: "r-settle", payment: { mode: "twint", date: "2026-10-07" } });
    expect(r.statut).toBe("payee");
    const inv = db.tables.therapist_invoices[0];
    expect(inv.locked_at).toBeTruthy();
    expect(inv.numero_facture).toBe("2026-0001");
    const pay = db.tables.therapist_invoice_payments;
    expect(pay).toHaveLength(1);
    expect(pay[0]).toMatchObject({ mode_paiement: "twint", date_paiement: "2026-10-07" });
    expect(pay[0].montant).toBeCloseTo(158.1, 2);
  });

  it("refuse un client d'un autre thérapeute", async () => {
    const { createClientInvoice } = await load();
    await expect(createClientInvoice(db.supabase, "t2", "u2", { client_id: "c1", lines, action: "draft", request_id: "r-x" })).rejects.toThrow("Client introuvable");
  });
});

describe("createClientInvoice — double soumission", () => {
  it("deux envois simultanés dans le même processus : une seule facture", async () => {
    const db = makeDb();
    const { createClientInvoice } = await load();
    const input = { client_id: "c1", lines, action: "settle" as const, request_id: "r-dbl", payment: { mode: "especes" as const, date: "2026-10-07" } };
    const [a, b] = await Promise.all([createClientInvoice(db.supabase, "t1", "u1", input), createClientInvoice(db.supabase, "t1", "u1", input)]);
    expect(a.invoice_id).toBe(b.invoice_id);
    expect(db.tables.therapist_invoices).toHaveLength(1);
    expect(db.tables.therapist_invoice_payments).toHaveLength(1);
  });

  it("deux envois simultanés dans deux processus serveur distincts : une seule facture (index unique)", async () => {
    const db = makeDb({ unique: true });
    const m1 = await load();
    const m2 = await load();
    const input = { client_id: "c1", lines, action: "draft" as const, request_id: "r-two" };
    const [a, b] = await Promise.all([
      m1.createClientInvoice(db.supabase, "t1", "u1", input),
      m2.createClientInvoice(db.supabase, "t1", "u1", input),
    ]);
    expect(a.invoice_id).toBe(b.invoice_id);
    expect(db.tables.therapist_invoices).toHaveLength(1);
  });

  it("un renvoi après coup renvoie la facture existante", async () => {
    const db = makeDb();
    const { createClientInvoice } = await load();
    const input = { client_id: "c1", lines, action: "draft" as const, request_id: "r-again" };
    const a = await createClientInvoice(db.supabase, "t1", "u1", input);
    const b = await createClientInvoice(db.supabase, "t1", "u1", input);
    expect(b).toMatchObject({ invoice_id: a.invoice_id, duplicate: true });
    expect(db.tables.therapist_invoices).toHaveLength(1);
  });
});

describe("createClientInvoice — récupération après 23505", () => {
  const input = { client_id: "c1", lines, action: "settle" as const, request_id: "r-23505", payment: { mode: "carte" as const, date: "2026-10-07" } };

  it("renvoie la facture existante sans ligne, paiement ni facture en plus", async () => {
    const db = makeDb({ unique: true, skipPrior: true });
    db.tables.therapist_invoices.push({ id: "existing", therapist_id: "t1", numero_facture: "2026-0099", statut: "payee",
      created_at: "2026-01-01T00:00:00Z", metadata: { request_id: "r-23505" } });
    const { createClientInvoice } = await load();
    const r = await createClientInvoice(db.supabase, "t1", "u1", input);
    expect(r).toMatchObject({ invoice_id: "existing", numero_facture: "2026-0099", duplicate: true });
    expect(db.tables.therapist_invoices).toHaveLength(1);
    expect(db.tables.therapist_invoice_lines).toHaveLength(0);
    expect(db.tables.therapist_invoice_payments).toHaveLength(0);
  });

  it("ne masque pas une autre erreur SQL", async () => {
    const db = makeDb({ failInsert: { code: "23505", message: 'duplicate key value violates unique constraint "therapist_invoices_numero_uniq"' } });
    const { createClientInvoice, isRequestIdConflict } = await load();
    await expect(createClientInvoice(db.supabase, "t1", "u1", { ...input, request_id: "r-other" })).rejects.toThrow("therapist_invoices_numero_uniq");
    expect(isRequestIdConflict({ code: "42703", message: "ti_therapist_request_id_uniq" })).toBe(false);
  });
});
