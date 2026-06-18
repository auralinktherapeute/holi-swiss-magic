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
  created_at: string;
  updated_at: string;
};

async function getMyTherapistId(userId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("therapists")
    .select("id, subscription_plan")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("Profil thérapeute introuvable.");
  return data.id as string;
}

async function assertElitePro(userId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("therapists")
    .select("id, subscription_plan")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("Profil thérapeute introuvable.");
  if ((data as any).subscription_plan !== "elite_pro") {
    throw new Error("Réservé à l'offre Elite Pro.");
  }
  return data.id as string;
}

export const checkElitePro = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("therapists")
      .select("subscription_plan")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { isElitePro: (data as any)?.subscription_plan === "elite_pro" };
  });

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
    const therapistId = await assertElitePro(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
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

export const upsertContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Partial<ClientContact> & { id?: string }) =>
    z.object({
      id: z.string().uuid().optional(),
      first_name: z.string().trim().min(1).max(100),
      last_name: z.string().trim().min(1).max(100),
      email: z.string().email().max(255).optional().nullable().or(z.literal("")),
      phone: z.string().max(50).optional().nullable().or(z.literal("")),
      session_type: z.string().max(120).optional().nullable().or(z.literal("")),
      relation_status: z.enum(["prospect","new","active","followup","inactive"]).default("prospect"),
      tags: z.array(z.string().max(40)).max(20).default([]),
      private_notes: z.string().max(4000).optional().nullable().or(z.literal("")),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const therapistId = await assertElitePro(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: any = { ...data, therapist_id: therapistId };
    ["email","phone","session_type","private_notes"].forEach((k) => {
      if (payload[k] === "") payload[k] = null;
    });
    if (data.id) {
      const { error } = await supabaseAdmin.from("crm_client_contacts").update(payload).eq("id", data.id).eq("therapist_id", therapistId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("crm_client_contacts").insert(payload).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    return { id: (row as any)?.id };
  });

export const deleteContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await assertElitePro(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("crm_client_contacts").delete().eq("id", data.id).eq("therapist_id", therapistId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addContactNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; body: string }) =>
    z.object({ id: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const therapistId = await assertElitePro(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("crm_activities").insert({
      entity_type: "client_contact",
      entity_id: data.id,
      owner_id: context.userId,
      therapist_id: therapistId,
      type: "note",
      title: "Note",
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getContactDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await assertElitePro(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: contact, error } = await supabaseAdmin
      .from("crm_client_contacts").select("*").eq("id", data.id).eq("therapist_id", therapistId).maybeSingle();
    if (error) throw new Error(error.message);
    const { data: activities } = await supabaseAdmin
      .from("crm_activities")
      .select("id,type,title,body,occurred_at,metadata")
      .eq("entity_type", "client_contact")
      .eq("entity_id", data.id)
      .order("occurred_at", { ascending: false })
      .limit(100);
    const { data: tasks } = await supabaseAdmin
      .from("crm_tasks")
      .select("id,title,due_at,done_at,priority,description")
      .eq("entity_type", "client_contact")
      .eq("entity_id", data.id)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(50);
    return {
      contact: contact as ClientContact | null,
      activities: (activities ?? []) as Array<{ id: string; type: string; title: string; body: string | null; occurred_at: string; metadata: Record<string, string | number | boolean | null> }>,
      tasks: (tasks ?? []) as Array<{ id: string; title: string; due_at: string | null; done_at: string | null; priority: string; description: string | null }>,
    };
  });

export const createContactReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contactId: string; title: string; daysFromNow?: number; description?: string }) =>
    z.object({
      contactId: z.string().uuid(),
      title: z.string().trim().min(1).max(200),
      daysFromNow: z.number().int().min(0).max(365).optional(),
      description: z.string().max(2000).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const therapistId = await assertElitePro(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const due = data.daysFromNow !== undefined
      ? new Date(Date.now() + data.daysFromNow * 86400_000).toISOString()
      : null;
    const { error } = await supabaseAdmin.from("crm_tasks").insert({
      therapist_id: therapistId,
      owner_id: context.userId,
      entity_type: "client_contact",
      entity_id: data.contactId,
      title: data.title,
      description: data.description ?? null,
      due_at: due,
      priority: "normal",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const completeContactTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; done: boolean }) =>
    z.object({ id: z.string().uuid(), done: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const therapistId = await assertElitePro(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("crm_tasks")
      .update({ done_at: data.done ? new Date().toISOString() : null })
      .eq("id", data.id)
      .eq("therapist_id", therapistId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// expose helper so loaders can know without importing assertElitePro
export const __noop = getMyTherapistId; // keep ref