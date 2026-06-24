import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClientContact = {
  id: string;
  therapist_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  session_type: string | null;
  relation_status: "prospect" | "new" | "active" | "followup" | "inactive";
  tags: string[];
  last_booking_at: string | null;
  next_booking_at: string | null;
  private_notes: string | null;
  payment_link: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmTask = {
  id: string;
  therapist_id: string;
  contact_id: string | null;
  title: string;
  description: string | null;
  due_at: string | null;
  done: boolean;
  priority: "low" | "normal" | "high";
  created_at: string;
};

export type ContactNote = {
  id: string;
  contact_id: string;
  session_date: string;
  title: string | null;
  template: "free" | "soap";
  content: string | null;
  soap_subjective: string | null;
  soap_objective: string | null;
  soap_assessment: string | null;
  soap_plan: string | null;
  created_at: string;
  updated_at: string;
};

async function getTherapistId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("therapists")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("Profil thérapeute introuvable.");
  return data.id as string;
}

// ── Check Elite Pro (kept for backward compat but always returns true now) ──
export const checkElitePro = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return { isElitePro: true };
  });

// ── Contacts ──────────────────────────────────────────────────────────────────

export const listMyContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { search?: string; status?: string; tag?: string }) =>
    z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      tag: z.string().optional(),
    }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<ClientContact[]> => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    let q = (context.supabase as any)
      .from("crm_client_contacts")
      .select("*")
      .eq("therapist_id", therapistId)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (data.status) q = q.eq("relation_status", data.status);
    if (data.tag) q = q.contains("tags", [data.tag]);
    if (data.search?.trim()) {
      const s = `%${data.search.trim()}%`;
      q = q.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as ClientContact[];
  });

const ContactSchema = z.object({
  id: z.string().optional(),
  first_name: z.string().min(1),
  last_name: z.string().optional().default(""),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  session_type: z.string().optional().nullable(),
  relation_status: z.enum(["prospect", "new", "active", "followup", "inactive"]).default("prospect"),
  tags: z.array(z.string()).default([]),
  private_notes: z.string().optional().nullable(),
  payment_link: z.string().optional().nullable(),
  last_booking_at: z.string().optional().nullable(),
  next_booking_at: z.string().optional().nullable(),
});

export const upsertContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ContactSchema.parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { id, ...rest } = data;
    const payload = { ...rest, therapist_id: therapistId, updated_at: new Date().toISOString() };
    let q = (context.supabase as any).from("crm_client_contacts");
    const { data: row, error } = id
      ? await q.update(payload).eq("id", id).select().maybeSingle()
      : await q.insert({ ...payload }).select().maybeSingle();
    if (error) throw new Error(error.message);
    return row as ClientContact;
  });

export const deleteContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("crm_client_contacts")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Bulk import (CSV / XLSX) ──────────────────────────────────────────────────

const ImportRowSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().optional().default(""),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  private_notes: z.string().optional().nullable(),
});

export const bulkImportContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      rows: z.array(ImportRowSchema).min(1).max(2000),
      onDuplicate: z.enum(["skip", "update"]).default("skip"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const sb = context.supabase as any;
    let imported = 0, updated = 0, skipped = 0;

    // Pre-fetch existing emails to detect duplicates
    const emails = data.rows.map(r => r.email?.trim().toLowerCase()).filter(Boolean) as string[];
    const existingByEmail = new Map<string, string>();
    if (emails.length > 0) {
      const { data: existing } = await sb
        .from("crm_client_contacts")
        .select("id,email")
        .eq("therapist_id", therapistId)
        .in("email", emails);
      for (const e of existing ?? []) {
        if (e.email) existingByEmail.set(String(e.email).toLowerCase(), e.id);
      }
    }

    for (const r of data.rows) {
      const emailKey = r.email?.trim().toLowerCase();
      const dup = emailKey ? existingByEmail.get(emailKey) : undefined;
      const payload: Record<string, any> = {
        first_name: r.first_name.trim(),
        last_name: (r.last_name ?? "").trim(),
        email: r.email?.trim() || null,
        phone: r.phone?.trim() || null,
        date_of_birth: r.date_of_birth || null,
        private_notes: r.private_notes?.trim() || null,
      };
      if (dup) {
        if (data.onDuplicate === "skip") { skipped++; continue; }
        const { error } = await sb.from("crm_client_contacts")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", dup);
        if (error) { skipped++; continue; }
        updated++;
      } else {
        const { error } = await sb.from("crm_client_contacts")
          .insert({ ...payload, therapist_id: therapistId, relation_status: "prospect", tags: [] });
        if (error) { skipped++; continue; }
        imported++;
      }
    }

    return { imported, updated, skipped, total: data.rows.length };
  });

export const getContactDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: contact, error } = await (context.supabase as any)
      .from("crm_client_contacts")
      .select("*, crm_contact_notes(*)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return contact;
  });

// ── Notes ─────────────────────────────────────────────────────────────────────

export const addContactNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ contact_id: z.string().uuid(), content: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: note, error } = await (context.supabase as any)
      .from("crm_contact_notes")
      .insert({ contact_id: data.contact_id, content: data.content })
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return note as ContactNote;
  });

export const listContactNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ contact_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: notes, error } = await (context.supabase as any)
      .from("crm_contact_notes")
      .select("*")
      .eq("contact_id", data.contact_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (notes ?? []) as ContactNote[];
  });

// ── Tasks ─────────────────────────────────────────────────────────────────────

export const listMyTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ done: z.boolean().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    let q = (context.supabase as any)
      .from("crm_tasks")
      .select("*, crm_client_contacts(first_name, last_name)")
      .eq("therapist_id", therapistId)
      .order("due_at", { ascending: true, nullsFirst: false });
    if (data.done !== undefined) q = q.eq("done", data.done);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as (CrmTask & { crm_client_contacts: { first_name: string; last_name: string } | null })[];
  });

const TaskSchema = z.object({
  id: z.string().optional(),
  contact_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  due_at: z.string().optional().nullable(),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  done: z.boolean().default(false),
});

export const upsertTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TaskSchema.parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { id, ...rest } = data;
    const payload = { ...rest, therapist_id: therapistId };
    let q = (context.supabase as any).from("crm_tasks");
    const { data: row, error } = id
      ? await q.update(payload).eq("id", id).select().maybeSingle()
      : await q.insert(payload).select().maybeSingle();
    if (error) throw new Error(error.message);
    return row as CrmTask;
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("crm_tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Reminders (alias createContactReminder for backward compat) ────────────────
export const createContactReminder = upsertTask;

// ── Backward-compat exports used by TherapistCrmViews ─────────────────────────

type ReminderRow = {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  done_at: string | null;
  priority: "low" | "normal" | "high";
  entity_id: string | null;
  contact: { first_name: string; last_name: string } | null;
};

export const listMyReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({}).optional().parse(input ?? {}))
  .handler(async ({ context }): Promise<ReminderRow[]> => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { data, error } = await (context.supabase as any)
      .from("crm_tasks")
      .select("id,title,description,due_at,done,priority,contact_id,crm_client_contacts(first_name,last_name)")
      .eq("therapist_id", therapistId)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      due_at: r.due_at,
      done_at: r.done ? r.created_at ?? new Date().toISOString() : null,
      priority: (r.priority ?? "normal") as "low" | "normal" | "high",
      entity_id: r.contact_id,
      contact: r.crm_client_contacts ?? null,
    }));
  });

export const completeContactTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), done: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("crm_tasks")
      .update({ done: data.done })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

type NoteRow = {
  id: string;
  occurred_at: string;
  body: string | null;
  entity_id: string | null;
  contact: { first_name: string; last_name: string } | null;
};

export const listMyRecentNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NoteRow[]> => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { data, error } = await (context.supabase as any)
      .from("crm_contact_notes")
      .select("id,content,created_at,contact_id,crm_client_contacts!inner(first_name,last_name,therapist_id)")
      .eq("crm_client_contacts.therapist_id", therapistId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return [];
    return (data ?? []).map((n: any) => ({
      id: n.id,
      occurred_at: n.created_at,
      body: n.content,
      entity_id: n.contact_id,
      contact: n.crm_client_contacts ? { first_name: n.crm_client_contacts.first_name, last_name: n.crm_client_contacts.last_name } : null,
    }));
  });

type Segmentation = {
  total: number;
  withRecentBooking: number;
  byStatus: Record<string, number>;
  byTag: Record<string, number>;
};

export const getMySegmentation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Segmentation> => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { data, error } = await (context.supabase as any)
      .from("crm_client_contacts")
      .select("relation_status,tags,last_booking_at")
      .eq("therapist_id", therapistId);
    if (error) return { total: 0, withRecentBooking: 0, byStatus: {}, byTag: {} };
    const rows = (data ?? []) as Array<{ relation_status: string | null; tags: string[] | null; last_booking_at: string | null }>;
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    const byStatus: Record<string, number> = {};
    const byTag: Record<string, number> = {};
    let withRecentBooking = 0;
    for (const r of rows) {
      const s = r.relation_status ?? "prospect";
      byStatus[s] = (byStatus[s] ?? 0) + 1;
      for (const t of r.tags ?? []) byTag[t] = (byTag[t] ?? 0) + 1;
      if (r.last_booking_at && new Date(r.last_booking_at).getTime() >= cutoff) withRecentBooking++;
    }
    return { total: rows.length, withRecentBooking, byStatus, byTag };
  });

// ── Views (kept for backward compat) ─────────────────────────────────────────
export { RemindersView, NotesView, SegmentationView } from "@/components/crm/TherapistCrmViews";
