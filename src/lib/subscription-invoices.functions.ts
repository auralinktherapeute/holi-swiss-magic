import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SubscriptionInvoice = {
  id: string;
  therapist_id: string;
  stripe_invoice_id: string | null;
  invoice_number: string;
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
  amount_total: number;
  amount_subtotal: number | null;
  amount_tax: number | null;
  currency: string;
  status: "draft" | "open" | "paid" | "uncollectible" | "void" | "refunded" | "failed" | "pending";
  billing_reason: string | null;
  invoice_date: string;
  period_start: string | null;
  period_end: string | null;
  plan_name: string | null;
  customer_name: string | null;
  customer_email: string | null;
  company_name: string | null;
  billing_address: string | null;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
};

async function getMyTherapistId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("therapists")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export const listMySubscriptionInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const therapistId = await getMyTherapistId(context.supabase, context.userId);
    if (!therapistId) return [] as SubscriptionInvoice[];
    const { data, error } = await (context.supabase as any)
      .from("subscription_invoices")
      .select("*")
      .eq("therapist_id", therapistId)
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as SubscriptionInvoice[];
  });

export const getMySubscriptionInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getMyTherapistId(context.supabase, context.userId);
    if (!therapistId) throw new Error("Profil thérapeute introuvable.");
    const { data: row, error } = await (context.supabase as any)
      .from("subscription_invoices")
      .select("*")
      .eq("id", data.id)
      .eq("therapist_id", therapistId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Facture introuvable.");
    return row as SubscriptionInvoice;
  });