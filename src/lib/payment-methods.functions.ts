import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PaymentMethodType = "twint" | "revolut" | "paypal" | "postfinance" | "iban" | "other";

export type PaymentMethod = {
  id: string;
  user_id: string;
  method_type: PaymentMethodType;
  label: string | null;
  value: string;
  bank_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const UpsertSchema = z.object({
  id: z.string().uuid().optional(),
  method_type: z.enum(["twint", "revolut", "paypal", "postfinance", "iban", "other"]),
  label: z.string().trim().max(80).optional().nullable(),
  value: z.string().trim().min(1, "Valeur requise").max(500),
  bank_name: z.string().trim().max(120).optional().nullable(),
  is_active: z.boolean().default(true),
});

export const listMyPaymentMethods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("therapist_payment_methods")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as PaymentMethod[];
  });

export const upsertPaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    if (id) {
      const { error } = await (context.supabase as any)
        .from("therapist_payment_methods")
        .update(rest)
        .eq("id", id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await (context.supabase as any)
      .from("therapist_payment_methods")
      .insert({ ...rest, user_id: context.userId })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deletePaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("therapist_payment_methods")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });