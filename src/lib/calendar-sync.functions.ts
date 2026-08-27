import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseIcsBusy } from "@/lib/calendar-ics";

/**
 * Synchronisation d'agenda — configuration et import.
 *
 * Conventions de `therapist-faq.functions.ts` : middleware
 * `requireSupabaseAuth`, therapist_id résolu depuis l'utilisateur, et
 * lectures/écritures de CONFIGURATION via `context.supabase`, donc sous RLS.
 *
 * Deux exceptions passent par la service-role, et chacune a sa raison :
 * - l'écriture des créneaux importés (`therapist_external_busy` n'a pas de
 *   policy d'insertion : rien ne justifie qu'un client y écrive) ;
 * - la lecture des rendez-vous pour l'export (servi sans session).
 */

export type CalendarSyncSettings = {
  export_enabled: boolean;
  export_token: string | null;
  export_token_created_at: string | null;
  import_enabled: boolean;
  import_url: string | null;
  import_last_sync_at: string | null;
  import_last_status: string | null;
  import_last_error: string | null;
  import_last_count: number;
  import_skipped_recurring: number;
  import_last_seen: number;
  import_last_ignored: number;
};

const EMPTY: CalendarSyncSettings = {
  export_enabled: false, export_token: null, export_token_created_at: null,
  import_enabled: false, import_url: null, import_last_sync_at: null,
  import_last_status: null, import_last_error: null,
  import_last_count: 0, import_skipped_recurring: 0,
  import_last_seen: 0, import_last_ignored: 0,
};

async function getTherapistId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("therapists").select("id").eq("user_id", userId).maybeSingle();
  if (error || !data) throw new Error("Profil thérapeute introuvable.");
  return data.id as string;
}

/** 48 caractères hexadécimaux — 192 bits. Non devinable par force brute. */
function newToken(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

async function readRow(supabase: any, therapistId: string): Promise<CalendarSyncSettings> {
  const { data } = await (supabase as any)
    .from("therapist_calendar_sync").select("*").eq("therapist_id", therapistId).maybeSingle();
  return data ? { ...EMPTY, ...data } : EMPTY;
}

export const getMyCalendarSync = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    return await readRow(context.supabase, therapistId);
  });

/**
 * Active ou désactive l'export. Le jeton est engendré à la première activation
 * et CONSERVÉ ensuite : désactiver puis réactiver ne doit pas casser un lien
 * déjà collé dans l'agenda du praticien. Pour invalider, il y a
 * `regenerateExportToken`, dont c'est le rôle explicite.
 */
export const setCalendarExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ enabled: z.boolean() }))
  .handler(async ({ context, data }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const current = await readRow(context.supabase, therapistId);
    const token = current.export_token ?? newToken();
    const { error } = await (context.supabase as any)
      .from("therapist_calendar_sync")
      .upsert({
        therapist_id: therapistId,
        export_enabled: data.enabled,
        export_token: token,
        export_token_created_at: current.export_token_created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "therapist_id" });
    if (error) throw new Error("Impossible d'enregistrer le réglage d'export.");
    return { enabled: data.enabled, token };
  });

/** Invalide immédiatement l'ancien lien : tout agenda abonné cesse de recevoir. */
export const regenerateExportToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const token = newToken();
    const { error } = await (context.supabase as any)
      .from("therapist_calendar_sync")
      .upsert({
        therapist_id: therapistId,
        export_token: token,
        export_token_created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "therapist_id" });
    if (error) throw new Error("Impossible de régénérer le lien.");
    return { token };
  });

const importSchema = z.object({
  enabled: z.boolean(),
  url: z.string().trim().max(2000).nullable().optional(),
});

export const setCalendarImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(importSchema)
  .handler(async ({ context, data }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const url = (data.url ?? "").trim() || null;
    if (data.enabled && !url) throw new Error("Renseignez l'adresse de votre agenda avant d'activer l'import.");
    if (url) assertSafeUrl(url);
    const { error } = await (context.supabase as any)
      .from("therapist_calendar_sync")
      .upsert({
        therapist_id: therapistId,
        import_enabled: data.enabled,
        import_url: url,
        updated_at: new Date().toISOString(),
      }, { onConflict: "therapist_id" });
    if (error) throw new Error("Impossible d'enregistrer le réglage d'import.");
    return { enabled: data.enabled, url };
  });

/**
 * Refuse tout ce qui n'est pas une URL publique en http(s).
 *
 * Le praticien fournit une adresse que le SERVEUR ira chercher : sans ce
 * filtre, une URL `http://169.254.169.254/…` ou `http://localhost:…` ferait
 * interroger l'infrastructure interne depuis l'intérieur (SSRF). On écarte
 * donc les schémas exotiques et les hôtes manifestement locaux.
 */
function assertSafeUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw.replace(/^webcal:\/\//i, "https://"));
  } catch {
    throw new Error("Adresse invalide. Collez le lien iCal fourni par votre agenda.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Seules les adresses http(s) et webcal sont acceptées.");
  }
  const h = u.hostname.toLowerCase();
  const blocked =
    h === "localhost" || h === "[::1]" || h.endsWith(".localhost") || h.endsWith(".internal") ||
    /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h === "0.0.0.0";
  if (blocked) throw new Error("Cette adresse pointe vers un réseau interne et ne peut pas être utilisée.");
  return u;
}

/** Fenêtre importée : un mois en arrière, un an en avant. */
function importWindow() {
  const now = Date.now();
  return {
    windowStart: new Date(now - 31 * 86400000),
    windowEnd: new Date(now + 365 * 86400000),
  };
}

/**
 * Va chercher l'agenda du praticien et remplace ses créneaux occupés.
 *
 * Remplacement et non fusion : un événement supprimé côté agenda personnel
 * doit libérer le créneau. Une fusion laisserait des blocages fantômes que
 * personne ne saurait retirer.
 */
export const runMyCalendarImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const row = await readRow(context.supabase, therapistId);

    if (!row.import_enabled || !row.import_url) {
      throw new Error("L'import n'est pas activé.");
    }
    const url = assertSafeUrl(row.import_url);

    const fail = async (message: string) => {
      await (supabaseAdmin as any).from("therapist_calendar_sync").update({
        import_last_sync_at: new Date().toISOString(),
        import_last_status: "error",
        import_last_error: message,
        updated_at: new Date().toISOString(),
      }).eq("therapist_id", therapistId);
      throw new Error(message);
    };

    let text: string;
    try {
      const res = await fetch(url.toString(), {
        headers: { "User-Agent": "Holiswiss-Calendar/1.0", Accept: "text/calendar, text/plain" },
        redirect: "follow",
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return await fail(`L'agenda a répondu ${res.status}. Vérifiez que le lien est public.`);
      const raw = await res.text();
      // 5 Mo : au-delà, ce n'est pas un agenda personnel.
      text = raw.length > 5_000_000 ? raw.slice(0, 5_000_000) : raw;
    } catch {
      return await fail("Impossible de joindre cet agenda. Vérifiez le lien.");
    }

    if (!/BEGIN:VCALENDAR/i.test(text)) {
      return await fail("Ce lien ne renvoie pas un agenda iCal. Cherchez « adresse secrète au format iCal » dans les réglages de votre agenda.");
    }

    const { busy, skippedRecurring, seen, ignored } = parseIcsBusy(text, importWindow());

    // Remplacement atomique du point de vue du praticien : on efface puis on
    // réécrit. Sur quelques milliers de lignes au plus, c'est plus simple et
    // plus sûr qu'une réconciliation par UID.
    const del = await (supabaseAdmin as any).from("therapist_external_busy").delete().eq("therapist_id", therapistId);
    if (del.error) return await fail("Impossible de mettre à jour les créneaux importés.");

    if (busy.length) {
      const rows = busy.map((b) => ({
        therapist_id: therapistId,
        starts_at: b.startsAt.toISOString(),
        ends_at: b.endsAt.toISOString(),
        uid: b.uid.slice(0, 500),
      }));
      for (let i = 0; i < rows.length; i += 500) {
        const ins = await (supabaseAdmin as any).from("therapist_external_busy").insert(rows.slice(i, i + 500));
        if (ins.error) return await fail("Impossible d'enregistrer les créneaux importés.");
      }
    }

    await (supabaseAdmin as any).from("therapist_calendar_sync").update({
      import_last_sync_at: new Date().toISOString(),
      import_last_status: "ok",
      import_last_error: null,
      import_last_count: busy.length,
      import_skipped_recurring: skippedRecurring,
      import_last_seen: seen,
      import_last_ignored: ignored,
      updated_at: new Date().toISOString(),
    }).eq("therapist_id", therapistId);

    return { count: busy.length, skippedRecurring, seen, ignored };
  });
