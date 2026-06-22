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
  content: string;
  created_at: string;
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

// ── Views (kept for backward compat) ─────────────────────────────────────────
export { RemindersView, NotesView, SegmentationView } from "@/components/crm/TherapistCrmViews";
