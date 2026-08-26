// Logique serveur du CRM de cabinet (vue d'ensemble, clients, agrégats).
// Séparé des server functions pour garder celles-ci minces.
// Règle : projections de colonnes explicites, jamais de `select *` sur des
// tables contenant des notes privées ou des données de santé.

export const OPEN_INVOICE_STATUSES = [
  "validee",
  "envoyee",
  "partiellement_payee",
  "en_retard",
] as const;

export const CLIENT_LIST_COLUMNS =
  "id,first_name,last_name,email,phone,session_type,relation_status,tags," +
  "last_booking_at,next_booking_at,created_at,updated_at,consent_at,consent_source,legal_basis";

export const APPOINTMENT_COLUMNS =
  "id,client_id,patient_name,patient_email,patient_phone,appointment_date,appointment_time," +
  "duration_minutes,status,service_name,start_time,end_time,invoiced_at,invoice_id,source";

export const INVOICE_COLUMNS =
  "id,numero_facture,client_id,appointment_id,statut,montant_total,montant_paye," +
  "currency,date_emission,date_echeance,pdf_url";

export async function getTherapistId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("therapists")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("Profil thérapeute introuvable.");
  return data.id as string;
}

/** Journal d'accès aux données sensibles (append-only, RLS par thérapeute). */
export async function logAccess(
  supabase: any,
  args: {
    therapistId: string;
    actorUserId: string;
    entityType: "client" | "session_note" | "document" | "invoice" | "export";
    entityId?: string | null;
    action: "read" | "create" | "update" | "delete" | "export" | "send";
    context?: string | null;
  },
) {
  try {
    await supabase.from("crm_access_log").insert({
      therapist_id: args.therapistId,
      actor_user_id: args.actorUserId,
      entity_type: args.entityType,
      entity_id: args.entityId ?? null,
      action: args.action,
      context: args.context ?? null,
    });
  } catch {
    // La journalisation ne doit jamais bloquer l'accès légitime du thérapeute.
  }
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function startOfWeek(ref = new Date()): Date {
  const d = new Date(ref);
  const day = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Solde restant dû d'une facture. */
export function invoiceBalance(inv: { montant_total: any; montant_paye: any }): number {
  return round2(Number(inv.montant_total ?? 0) - Number(inv.montant_paye ?? 0));
}

export type CabinetOverview = {
  kpi: {
    appointments_today: number;
    appointments_week: number;
    invoices_pending: number;
    unpaid_amount: number;
    unpaid_count: number;
    active_clients: number;
    currency: string;
  };
  today: Array<{
    id: string;
    time: string | null;
    client_id: string | null;
    name: string;
    service: string | null;
    status: string;
    duration_minutes: number | null;
  }>;
  invoices: Array<{
    id: string;
    numero_facture: string | null;
    statut: string;
    montant_total: number;
    solde: number;
    currency: string;
    date_echeance: string | null;
    client_name: string | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    due_at: string | null;
    priority: string;
    overdue: boolean;
  }>;
  alerts: Array<{ id: string; level: "warning" | "critical"; message: string; to: string }>;
};

/** Construit la vue d'ensemble du cabinet en un minimum de requêtes. */
export async function buildCabinetOverview(
  supabase: any,
  therapistId: string,
): Promise<CabinetOverview> {
  const today = isoDate(new Date());
  const weekStart = isoDate(startOfWeek());
  const weekEnd = isoDate(new Date(startOfWeek().getTime() + 6 * 86400000));
  const in30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [apptWeekRes, invoicesRes, tasksRes, clientsRes] = await Promise.all([
    supabase
      .from("appointments")
      .select(APPOINTMENT_COLUMNS)
      .eq("therapist_id", therapistId)
      .gte("appointment_date", weekStart)
      .lte("appointment_date", weekEnd)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true }),
    supabase
      .from("therapist_invoices")
      .select(INVOICE_COLUMNS)
      .eq("therapist_id", therapistId)
      .in("statut", OPEN_INVOICE_STATUSES as unknown as string[])
      .order("date_echeance", { ascending: true })
      .limit(50),
    supabase
      .from("crm_tasks")
      .select("id,title,due_at,priority,done")
      .eq("therapist_id", therapistId)
      .eq("done", false)
      .order("due_at", { ascending: true })
      .limit(8),
    supabase
      .from("crm_client_contacts")
      .select("id,first_name,last_name,relation_status,last_booking_at")
      .eq("therapist_id", therapistId)
      .limit(1000),
  ]);

  const appts = (apptWeekRes.data ?? []) as any[];
  const invoices = (invoicesRes.data ?? []) as any[];
  const tasks = (tasksRes.data ?? []) as any[];
  const clients = (clientsRes.data ?? []) as any[];
  const clientName = new Map<string, string>(
    clients.map((c) => [c.id, `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()]),
  );

  const todayAppts = appts.filter((a) => a.appointment_date === today);
  const unpaid = invoices.map((i) => ({ ...i, solde: invoiceBalance(i) })).filter((i) => i.solde > 0);
  const currency = invoices[0]?.currency ?? "CHF";

  const activeClients = clients.filter(
    (c) =>
      c.relation_status === "active" ||
      (c.last_booking_at && c.last_booking_at.slice(0, 10) >= in30),
  ).length;

  const alerts: CabinetOverview["alerts"] = [];
  const unconfirmed = appts.filter((a) => a.status === "pending" && a.appointment_date >= today);
  if (unconfirmed.length) {
    alerts.push({
      id: "unconfirmed",
      level: "warning",
      message: `${unconfirmed.length} rendez-vous en attente de confirmation`,
      to: "/dashboard/reservations",
    });
  }
  const late30 = unpaid.filter(
    (i) => i.date_echeance && i.date_echeance < in30,
  );
  if (late30.length) {
    alerts.push({
      id: "late30",
      level: "critical",
      message: `${late30.length} facture(s) impayée(s) depuis plus de 30 jours`,
      to: "/dashboard/facturation",
    });
  }
  const uninvoicedDone = appts.filter(
    (a) => a.status === "completed" && !a.invoiced_at,
  );
  if (uninvoicedDone.length) {
    alerts.push({
      id: "uninvoiced",
      level: "warning",
      message: `${uninvoicedDone.length} rendez-vous terminé(s) sans facture`,
      to: "/dashboard/facturation",
    });
  }

  const nowIso = new Date().toISOString();

  return {
    kpi: {
      appointments_today: todayAppts.length,
      appointments_week: appts.length,
      invoices_pending: invoices.length,
      unpaid_amount: round2(unpaid.reduce((s, i) => s + i.solde, 0)),
      unpaid_count: unpaid.length,
      active_clients: activeClients,
      currency,
    },
    today: todayAppts.map((a) => ({
      id: a.id,
      time: a.appointment_time ? String(a.appointment_time).slice(0, 5) : null,
      client_id: a.client_id ?? null,
      name: a.client_id ? clientName.get(a.client_id) || a.patient_name : a.patient_name,
      service: a.service_name ?? null,
      status: a.status,
      duration_minutes: a.duration_minutes ?? null,
    })),
    invoices: invoices.slice(0, 6).map((i) => ({
      id: i.id,
      numero_facture: i.numero_facture ?? null,
      statut: i.statut,
      montant_total: Number(i.montant_total ?? 0),
      solde: invoiceBalance(i),
      currency: i.currency ?? "CHF",
      date_echeance: i.date_echeance ?? null,
      client_name: i.client_id ? clientName.get(i.client_id) ?? null : null,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      due_at: t.due_at ?? null,
      priority: t.priority ?? "normal",
      overdue: Boolean(t.due_at && t.due_at < nowIso),
    })),
    alerts,
  };
}

export type CabinetClientRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  relation_status: string;
  tags: string[];
  appointments_count: number;
  last_booking_at: string | null;
  next_booking_at: string | null;
  balance_due: number;
  consent_at: string | null;
};

/** Liste clients enrichie (nb RDV, solde dû) sans exposer les notes privées. */
export async function buildClientList(
  supabase: any,
  therapistId: string,
  filters: { search?: string; status?: string; unpaidOnly?: boolean },
): Promise<CabinetClientRow[]> {
  let q = supabase
    .from("crm_client_contacts")
    .select(CLIENT_LIST_COLUMNS)
    .eq("therapist_id", therapistId)
    .order("last_name", { ascending: true })
    .limit(500);
  if (filters.status) q = q.eq("relation_status", filters.status);
  if (filters.search?.trim()) {
    const s = `%${filters.search.trim()}%`;
    q = q.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},phone.ilike.${s}`);
  }
  const [clientsRes, apptRes, invRes] = await Promise.all([
    q,
    supabase
      .from("appointments")
      .select("id,client_id,appointment_date")
      .eq("therapist_id", therapistId)
      .not("client_id", "is", null)
      .limit(5000),
    supabase
      .from("therapist_invoices")
      .select("client_id,montant_total,montant_paye,statut")
      .eq("therapist_id", therapistId)
      .in("statut", OPEN_INVOICE_STATUSES as unknown as string[])
      .limit(2000),
  ]);

  const counts = new Map<string, number>();
  for (const a of (apptRes.data ?? []) as any[]) {
    counts.set(a.client_id, (counts.get(a.client_id) ?? 0) + 1);
  }
  const balances = new Map<string, number>();
  for (const i of (invRes.data ?? []) as any[]) {
    if (!i.client_id) continue;
    balances.set(i.client_id, round2((balances.get(i.client_id) ?? 0) + invoiceBalance(i)));
  }

  let rows = ((clientsRes.data ?? []) as any[]).map((c) => ({
    id: c.id,
    first_name: c.first_name ?? "",
    last_name: c.last_name ?? "",
    email: c.email ?? null,
    phone: c.phone ?? null,
    relation_status: c.relation_status ?? "prospect",
    tags: c.tags ?? [],
    appointments_count: counts.get(c.id) ?? 0,
    last_booking_at: c.last_booking_at ?? null,
    next_booking_at: c.next_booking_at ?? null,
    balance_due: balances.get(c.id) ?? 0,
    consent_at: c.consent_at ?? null,
  }));
  if (filters.unpaidOnly) rows = rows.filter((r) => r.balance_due > 0);
  return rows;
}

/** Fiche client complète : RDV, factures, paiements, documents, notes, consentement. */
export async function buildClientDetail(
  supabase: any,
  therapistId: string,
  clientId: string,
) {
  const { data: client, error } = await supabase
    .from("crm_client_contacts")
    .select(`${CLIENT_LIST_COLUMNS},private_notes,date_of_birth,retention_until`)
    .eq("therapist_id", therapistId)
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!client) throw new Error("Client introuvable.");

  const [apptRes, invRes, docRes, noteRes] = await Promise.all([
    supabase
      .from("appointments")
      .select(APPOINTMENT_COLUMNS)
      .eq("therapist_id", therapistId)
      .eq("client_id", clientId)
      .order("appointment_date", { ascending: false })
      .limit(200),
    supabase
      .from("therapist_invoices")
      .select(INVOICE_COLUMNS)
      .eq("therapist_id", therapistId)
      .eq("client_id", clientId)
      .order("date_emission", { ascending: false })
      .limit(200),
    supabase
      .from("therapist_documents")
      .select("id,file_name,file_url,label,doc_type,is_health_data,is_public,created_at")
      .eq("therapist_id", therapistId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("crm_session_notes")
      .select("id,session_date,title,template,created_at")
      .eq("therapist_id", therapistId)
      .eq("contact_id", clientId)
      .order("session_date", { ascending: false })
      .limit(50),
  ]);

  const invoices = ((invRes.data ?? []) as any[]).map((i) => ({
    ...i,
    montant_total: Number(i.montant_total ?? 0),
    montant_paye: Number(i.montant_paye ?? 0),
    solde: invoiceBalance(i),
  }));

  return {
    client,
    appointments: (apptRes.data ?? []) as any[],
    invoices,
    documents: (docRes.data ?? []) as any[],
    notes: (noteRes.data ?? []) as any[],
    balance_due: round2(
      invoices
        .filter((i) => (OPEN_INVOICE_STATUSES as unknown as string[]).includes(i.statut))
        .reduce((s, i) => s + i.solde, 0),
    ),
  };
}
