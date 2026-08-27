import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { buildIcs, appointmentSummary, localDateTimeToUtc, type IcsEvent } from "@/lib/calendar-ics";

/**
 * Flux iCal public d'un thérapeute — `/agenda/{token}/holiswiss.ics`.
 *
 * Le jeton occupe son PROPRE segment d'URL : écrit `/agenda/{token}.ics`, le
 * routeur lisait « token.ics » comme un seul paramètre, `params.token` restait
 * vide et le flux rendait 404 en permanence. Le build le signalait par un
 * simple avertissement, sans échouer.
 *
 * Servi SANS session : le jeton de 192 bits dans l'URL fait seul autorité.
 * C'est le prix d'un lien qui fonctionne dans Google, Apple et Outlook sans
 * OAuth ; en contrepartie, le flux ne porte que le PRÉNOM et le type de
 * séance (voir `appointmentSummary`). Ni nom de famille, ni e-mail, ni
 * téléphone, ni notes ne le traversent.
 *
 * Un jeton inconnu et un export désactivé rendent le MÊME 404 : distinguer
 * les deux dirait à qui sonde les URL lesquelles existent.
 */

const NOT_FOUND = () =>
  new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

// Fenêtre publiée : un mois en arrière (pour l'historique récent), un an devant.
const PAST_DAYS = 31;
const FUTURE_DAYS = 365;

const iso = (d: Date) => d.toISOString().slice(0, 10);

export const Route = createFileRoute("/agenda/$token/holiswiss.ics")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = (params as { token?: string }).token ?? "";
        // Forme attendue : 48 caractères hexadécimaux. Écarter tout le reste
        // évite d'interroger la base pour des sondes manifestement invalides.
        if (!/^[0-9a-f]{48}$/.test(token)) return NOT_FOUND();

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: sync } = await (supabaseAdmin as any)
            .from("therapist_calendar_sync")
            .select("therapist_id, export_enabled")
            .eq("export_token", token)
            .maybeSingle();
          if (!sync || !sync.export_enabled) return NOT_FOUND();

          const now = new Date();
          const from = new Date(now.getTime() - PAST_DAYS * 86400000);
          const to = new Date(now.getTime() + FUTURE_DAYS * 86400000);

          const { data: rows } = await (supabaseAdmin as any)
            .from("appointments")
            .select("id, appointment_date, appointment_time, duration_minutes, service_name, patient_name, status")
            .eq("therapist_id", sync.therapist_id)
            .gte("appointment_date", iso(from))
            .lte("appointment_date", iso(to))
            .order("appointment_date");

          const events: IcsEvent[] = [];
          for (const r of (rows ?? []) as Array<Record<string, any>>) {
            const status = String(r.status ?? "").toLowerCase();
            // Un rendez-vous annulé ne doit pas occuper l'agenda personnel.
            if (status === "cancelled" || status === "canceled" || status === "refused") continue;

            const start = localDateTimeToUtc(r.appointment_date, r.appointment_time);
            if (!start) continue;
            const minutes = Number(r.duration_minutes) > 0 ? Number(r.duration_minutes) : 60;
            const end = new Date(start.getTime() + minutes * 60000);

            events.push({
              uid: `holiswiss-${r.id}@holiswiss.ch`,
              start,
              end,
              summary: appointmentSummary(r.patient_name, r.service_name),
            });
          }

          const ics = buildIcs(events, { name: "Holiswiss — mes rendez-vous" });
          return new Response(ics, {
            headers: {
              "Content-Type": "text/calendar; charset=utf-8",
              "Content-Disposition": 'inline; filename="holiswiss.ics"',
              // Le lien est un secret : aucun cache partagé ne doit le retenir.
              "Cache-Control": "private, max-age=300",
              "X-Robots-Tag": "noindex, nofollow",
            },
          });
        } catch {
          return NOT_FOUND();
        }
      },
    },
  },
});
