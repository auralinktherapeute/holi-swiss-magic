import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InvoiceItem = {
  id?: string;
  invoice_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total?: number;
};

export type Invoice = {
  id: string;
  therapist_id: string;
  contact_id: string | null;
  invoice_number: string;
  status: "draft" | "sent" | "paid" | "cancelled";
  issued_at: string;
  due_at: string | null;
  client_name: string;
  client_address: string | null;
  notes: string | null;
  payment_link: string | null;
  currency: string;
  total_amount: number;
  payment_method_ids: string[];
  created_at: string;
  updated_at: string;
  invoice_items?: InvoiceItem[];
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

async function nextInvoiceNumber(supabase: any, therapistId: string): Promise<string> {
  const { data } = await supabase
    .from("therapists")
    .select("invoice_counter")
    .eq("id", therapistId)
    .maybeSingle();
  const counter = ((data as any)?.invoice_counter ?? 0) + 1;
  await supabase.from("therapists").update({ invoice_counter: counter }).eq("id", therapistId);
  const year = new Date().getFullYear();
  return `${year}-${String(counter).padStart(4, "0")}`;
}

// ── List ──────────────────────────────────────────────────────────────────────

export const listMyInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ status: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    let q = (context.supabase as any)
      .from("invoices")
      .select("*, invoice_items(*)")
      .eq("therapist_id", therapistId)
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as Invoice[];
  });

export const getInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: inv, error } = await (context.supabase as any)
      .from("invoices")
      .select("*, invoice_items(*)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return inv as Invoice;
  });

// ── Create / Update ──────────────────────────────────────────────────────────

const ItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().trim().min(1, "Description requise"),
  quantity: z.number().min(0),
  unit_price: z.number().min(0),
});

const InvoiceSchema = z.object({
  id: z.string().optional(),
  contact_id: z.string().uuid().optional().nullable(),
  status: z.enum(["draft", "sent", "paid", "cancelled"]).default("draft"),
  issued_at: z.string().default(() => new Date().toISOString().slice(0, 10)),
  due_at: z.string().optional().nullable(),
  client_name: z.string().min(1),
  client_address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  payment_link: z.string().optional().nullable(),
  currency: z.string().default("CHF"),
  payment_method_ids: z.array(z.string().uuid()).default([]),
  items: z.array(ItemSchema).min(1, "Ajoutez au moins une ligne de facture").default([]),
});

export const upsertInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InvoiceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { id, items, ...rest } = data;
    const total_amount = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

    let invoiceId = id;
    if (id) {
      const { error } = await (context.supabase as any)
        .from("invoices")
        .update({ ...rest, total_amount, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const invoice_number = await nextInvoiceNumber(context.supabase, therapistId);
      const { data: row, error } = await (context.supabase as any)
        .from("invoices")
        .insert({ ...rest, therapist_id: therapistId, invoice_number, total_amount })
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      invoiceId = row.id;
    }

    // Replace items: delete old, insert new
    await (context.supabase as any).from("invoice_items").delete().eq("invoice_id", invoiceId);
    if (items.length > 0) {
      const { error } = await (context.supabase as any)
        .from("invoice_items")
        .insert(items.map(({ id: _id, ...i }) => ({ ...i, invoice_id: invoiceId })));
      if (error) throw new Error(error.message);
    }

    return { id: invoiceId };
  });

export const deleteInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("invoices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateInvoiceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid(),
    status: z.enum(["draft", "sent", "paid", "cancelled"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("invoices")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Therapist settings (logo + payment link) ─────────────────────────────────

export const getTherapistBranding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // `email` / `phone` are column-level restricted for anon + authenticated.
    // Read via service role — the RLS-owner check is enforced by user_id filter.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("therapists")
      .select("id, first_name, last_name, email, phone, logo_url, payment_link, currency, slug")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as { id: string; first_name: string; last_name: string; email: string; phone: string; logo_url: string | null; payment_link: string | null; currency: string; slug: string | null };
  });

export const updateTherapistBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    logo_url: z.string().optional().nullable(),
    payment_link: z.string().optional().nullable(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("therapists")
      .update(data)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
