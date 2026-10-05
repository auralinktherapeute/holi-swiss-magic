import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTherapistId } from "@/lib/invoice-core.server";
import {
  CURRENCY_WARNING_VERSION, buildCurrencyWarning, normalizeLang, resolveEffectiveCurrency,
} from "@/lib/currency-consent";

/** Devise du cabinet + prestations actives à re-tarifer. */
export const getPracticeCurrency = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tid = await getTherapistId(context.supabase, context.userId);
    const sb = context.supabase as any;
    const [{ data: s, error: e1 }, { data: svc, error: e2 }] = await Promise.all([
      sb.from("therapist_invoice_settings").select("devise_defaut").eq("therapist_id", tid).maybeSingle(),
      sb.from("billing_services").select("id,name,price,currency").eq("therapist_id", tid).eq("is_active", true).order("position"),
    ]);
    if (e1 || e2) throw new Error((e1 ?? e2).message);
    return {
      hasSettings: !!s,
      currency: resolveEffectiveCurrency(null, s?.devise_defaut).currency,
      services: ((svc ?? []) as any[]).map((r) => ({ id: r.id as string, name: r.name as string, price: Number(r.price ?? 0), currency: (r.currency ?? "CHF") as string })),
    };
  });

export const changePracticeCurrency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    currency: z.enum(["CHF", "EUR"]),
    acknowledged: z.literal(true),
    lang: z.string().max(5),
    prices: z.array(z.object({ id: z.string().uuid(), price: z.number().min(0).max(100000) })).max(500),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const lang = normalizeLang(data.lang);
    const { data: res, error } = await (context.supabase as any).rpc("change_practice_currency", {
      _new: data.currency,
      _warning: buildCurrencyWarning("practice", lang),
      _version: CURRENCY_WARNING_VERSION,
      _lang: lang,
      _ack: data.acknowledged,
      _prices: data.prices,
    });
    if (error) throw new Error(error.message);
    return res as { ok: boolean };
  });

export const changeClientCurrency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    clientId: z.string().uuid(),
    currency: z.enum(["CHF", "EUR"]).nullable(),
    acknowledged: z.boolean(),
    lang: z.string().max(5),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const tid = await getTherapistId(sb, context.userId);
    const { data: c, error: e0 } = await sb.from("crm_client_contacts")
      .select("first_name,last_name").eq("id", data.clientId).eq("therapist_id", tid).maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!c) throw new Error("Client introuvable");
    const lang = normalizeLang(data.lang);
    const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
    const { data: res, error } = await sb.rpc("change_client_currency", {
      _client: data.clientId,
      _new: data.currency,
      _warning: buildCurrencyWarning("client", lang, name),
      _version: CURRENCY_WARNING_VERSION,
      _lang: lang,
      _ack: data.acknowledged,
    });
    if (error) throw new Error(error.message);
    return res as { ok: boolean };
  });
