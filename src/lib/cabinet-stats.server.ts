// L6 — Statistiques du cabinet et tâches automatiques.
// Aucune donnée de santé n'est lue ici : uniquement des agrégats de RDV,
// de facturation et de fiches clients, toujours filtrés par therapist_id.

import { isoDate, round2 } from "@/lib/cabinet-core.server";

export type CabinetStatsMonth = {
  month: string; // YYYY-MM
  label: string; // "août 26"
  honored: number;
  cancelled: number;
  no_show: number;
  revenue: number; // encaissé (montant_paye) sur les factures émises ce mois
};

export type CabinetStats = {
  currency: string;
  months: CabinetStatsMonth[];
  totals: {
    honored: number;
    cancelled: number;
    no_show: number;
    revenue: number;
    no_show_rate: number; // %
    new_clients: number;
    avg_basket: number;
  };
  top_services: Array<{ name: string; count: number }>;
  busiest_slots: Array<{ label: string; count: number }>;
};

const MONTH_FMT = new Intl.DateTimeFormat("fr-CH", { month: "short", year: "2-digit" });

function monthKeys(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = count - 1; i >= 0; i -= 1) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return MONTH_FMT.format(new Date(y, (m ?? 1) - 1, 1));
}

const NO_SHOW = new Set(["no_show", "absent", "noshow"]);
const CANCELLED = new Set(["cancelled", "canceled", "annule", "annulee"]);

/** Agrégats sur les `months` derniers mois (12 par défaut). */
export async function buildCabinetStats(
  supabase: any,
  therapistId: string,
  months = 12,
): Promise<CabinetStats> {
  const keys = monthKeys(months);
  const since = `${keys[0]}-01`;

  const [apptRes, invRes, clientsRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id,appointment_date,appointment_time,status,service_name,duration_minutes")
      .eq("therapist_id", therapistId)
      .gte("appointment_date", since)
      .limit(5000),
    supabase
      .from("therapist_invoices")
      .select("id,statut,montant_total,montant_paye,currency,date_emission")
      .eq("therapist_id", therapistId)
      .gte("date_emission", since)
      .limit(5000),
    supabase
      .from("crm_client_contacts")
      .select("id,created_at")
      .eq("therapist_id", therapistId)
      .gte("created_at", `${since}T00:00:00Z`)
      .limit(5000),
  ]);

  const appts = (apptRes.data ?? []) as any[];
  const invoices = (invRes.data ?? []) as any[];
  const clients = (clientsRes.data ?? []) as any[];
  const currency = invoices[0]?.currency ?? "CHF";

  const empty = () => ({ honored: 0, cancelled: 0, no_show: 0, revenue: 0 });
  const buckets = new Map(keys.map((k) => [k, empty()]));

  for (const a of appts) {
    const key = String(a.appointment_date ?? "").slice(0, 7);
    const b = buckets.get(key);
    if (!b) continue;
    const s = String(a.status ?? "");
    if (s === "completed") b.honored += 1;
    else if (NO_SHOW.has(s)) b.no_show += 1;
    else if (CANCELLED.has(s)) b.cancelled += 1;
  }
  for (const i of invoices) {
    const key = String(i.date_emission ?? "").slice(0, 7);
    const b = buckets.get(key);
    if (!b) continue;
    b.revenue = round2(b.revenue + Number(i.montant_paye ?? 0));
  }

  const monthsOut: CabinetStatsMonth[] = keys.map((k) => ({
    month: k,
    label: monthLabel(k),
    ...buckets.get(k)!,
  }));

  const honored = monthsOut.reduce((s, m) => s + m.honored, 0);
  const cancelled = monthsOut.reduce((s, m) => s + m.cancelled, 0);
  const noShow = monthsOut.reduce((s, m) => s + m.no_show, 0);
  const revenue = round2(monthsOut.reduce((s, m) => s + m.revenue, 0));
  const planned = honored + cancelled + noShow;

  const serviceCount = new Map<string, number>();
  const slotCount = new Map<string, number>();
  for (const a of appts) {
    if (String(a.status) !== "completed") continue;
    const name = (a.service_name ?? "").trim() || "Séance";
    serviceCount.set(name, (serviceCount.get(name) ?? 0) + 1);
    const hour = String(a.appointment_time ?? "").slice(0, 2);
    if (hour) slotCount.set(`${hour}h`, (slotCount.get(`${hour}h`) ?? 0) + 1);
  }

  const top = (m: Map<string, number>, n: number) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([name, count]) => ({ name, count }));

  return {
    currency,
    months: monthsOut,
    totals: {
      honored,
      cancelled,
      no_show: noShow,
      revenue,
      no_show_rate: planned ? round2((noShow / planned) * 100) : 0,
      new_clients: clients.length,
      avg_basket: honored ? round2(revenue / honored) : 0,
    },
    top_services: top(serviceCount, 5),
    busiest_slots: top(slotCount, 5).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/* ---------- Tâches automatiques ---------- */

export type AutoTaskResult = { created: number; titles: string[] };

type Candidate = { key: string; title: string; priority: string; due: Date; contact_id?: string | null };

/**
 * Génère les tâches de suivi évidentes (impayés, RDV à facturer, consentement
 * manquant, clients inactifs). Idempotent : la clé est stockée dans
 * `entity_type`/`entity_id`, une tâche non terminée existante n'est pas dupliquée.
 */
export async function generateAutoTasks(
  supabase: any,
  therapistId: string,
  ownerUserId: string,
): Promise<AutoTaskResult> {
  const today = isoDate(new Date());
  const in30 = isoDate(new Date(Date.now() - 30 * 86400000));
  const in90 = isoDate(new Date(Date.now() - 90 * 86400000));

  const [invRes, apptRes, clientsRes, existingRes] = await Promise.all([
    supabase
      .from("therapist_invoices")
      .select("id,numero_facture,statut,montant_total,montant_paye,date_echeance")
      .eq("therapist_id", therapistId)
      .in("statut", ["envoyee", "partiellement_payee", "en_retard"])
      .limit(200),
    supabase
      .from("appointments")
      .select("id,client_id,patient_name,appointment_date,status,invoiced_at")
      .eq("therapist_id", therapistId)
      .eq("status", "completed")
      .is("invoiced_at", null)
      .lte("appointment_date", today)
      .limit(200),
    supabase
      .from("crm_client_contacts")
      .select("id,first_name,last_name,consent_at,last_booking_at,relation_status")
      .eq("therapist_id", therapistId)
      .limit(1000),
    supabase
      .from("crm_tasks")
      .select("id,entity_type,entity_id,done")
      .eq("therapist_id", therapistId)
      .eq("entity_type", "auto")
      .eq("done", false)
      .limit(1000),
  ]);

  const existing = new Set(
    ((existingRes.data ?? []) as any[]).map((t) => String(t.entity_id ?? "")),
  );

  const candidates: Candidate[] = [];

  for (const i of (invRes.data ?? []) as any[]) {
    const solde = round2(Number(i.montant_total ?? 0) - Number(i.montant_paye ?? 0));
    if (solde <= 0) continue;
    if (!i.date_echeance || i.date_echeance >= today) continue;
    candidates.push({
      key: `invoice_overdue:${i.id}`,
      title: `Relancer la facture ${i.numero_facture ?? ""}`.trim(),
      priority: "high",
      due: new Date(),
    });
  }

  for (const a of (apptRes.data ?? []) as any[]) {
    candidates.push({
      key: `appt_to_invoice:${a.id}`,
      title: `Facturer la séance du ${a.appointment_date} — ${a.patient_name ?? "client"}`,
      priority: "normal",
      due: new Date(),
      contact_id: a.client_id ?? null,
    });
  }

  for (const c of (clientsRes.data ?? []) as any[]) {
    const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "client";
    if (!c.consent_at && c.last_booking_at) {
      candidates.push({
        key: `consent_missing:${c.id}`,
        title: `Recueillir le consentement de ${name}`,
        priority: "high",
        due: new Date(),
        contact_id: c.id,
      });
    }
    const last = c.last_booking_at ? String(c.last_booking_at).slice(0, 10) : null;
    if (c.relation_status === "active" && last && last < in90) {
      candidates.push({
        key: `client_inactive:${c.id}`,
        title: `Prendre des nouvelles de ${name} (sans séance depuis ${last})`,
        priority: "low",
        due: new Date(Date.now() + 3 * 86400000),
        contact_id: c.id,
      });
    } else if (c.relation_status === "active" && last && last < in30 && !c.consent_at) {
      // couvert par consent_missing, rien à ajouter
    }
  }

  const toCreate = candidates.filter((c) => !existing.has(c.key)).slice(0, 50);
  if (!toCreate.length) return { created: 0, titles: [] };

  const { error } = await supabase.from("crm_tasks").insert(
    toCreate.map((c) => ({
      therapist_id: therapistId,
      owner_id: ownerUserId,
      contact_id: c.contact_id ?? null,
      title: c.title.slice(0, 200),
      priority: c.priority,
      due_at: c.due.toISOString(),
      entity_type: "auto",
      entity_id: c.key,
    })),
  );
  if (error) throw new Error(error.message);

  return { created: toCreate.length, titles: toCreate.map((c) => c.title) };
}
