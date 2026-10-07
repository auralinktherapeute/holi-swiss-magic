// Fiche client : journal, archivage, consentement par e-mail, doublons, fusion.
// Module additif : n'altère aucune fonction existante.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function therapistOf(supabase: any, userId: string) {
  const { data } = await supabase.from("therapists")
    .select("id, first_name, last_name").eq("user_id", userId).maybeSingle();
  if (!data) throw new Error("Profil thérapeute introuvable.");
  let email: string | null = null;
  try {
    const { data: c } = await supabase.rpc("get_my_therapist_contact");
    const row = Array.isArray(c) ? c[0] : c;
    email = row?.email ?? null;
  } catch { /* e-mail facultatif */ }
  return { ...(data as any), email } as { id: string; first_name: string; last_name: string; email: string | null };
}

async function ownContact(supabase: any, therapistId: string, id: string) {
  const { data } = await supabase.from("crm_client_contacts").select("*")
    .eq("id", id).eq("therapist_id", therapistId).maybeSingle();
  if (!data) throw new Error("Client introuvable.");
  return data as any;
}

async function audit(supabase: any, t: string, contact: string, actor: string, action: string, details: Record<string, unknown> = {}) {
  try {
    await supabase.from("crm_client_audit").insert({ therapist_id: t, contact_id: contact, actor_id: actor, action, details });
  } catch { /* le journal ne doit jamais bloquer l'action */ }
}

const ACTIONS = ["created", "updated", "status", "archived", "unarchived", "note", "document",
  "invoice_reminder", "questionnaire_sent", "consent_requested", "consent_recorded", "merged"] as const;

export const logClientAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    contact_id: z.string().uuid(),
    action: z.enum(ACTIONS),
    details: z.record(z.string(), z.any()).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const t = await therapistOf(context.supabase, context.userId);
    await ownContact(context.supabase, t.id, data.contact_id);
    await audit(context.supabase, t.id, data.contact_id, context.userId, data.action, data.details ?? {});
    return { ok: true };
  });

export const getClientJournal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ contact_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const t = await therapistOf(sb, context.userId);
    const c = await ownContact(sb, t.id, data.contact_id);
    const [au, ap, inv, docs, resp] = await Promise.all([
      sb.from("crm_client_audit").select("id, action, details, created_at").eq("contact_id", c.id).eq("therapist_id", t.id).order("created_at", { ascending: false }).limit(200),
      sb.from("appointments").select("id, appointment_date, status, created_at").eq("client_id", c.id).eq("therapist_id", t.id).limit(200),
      sb.from("therapist_invoices").select("id, numero_facture, statut, montant_total, created_at").eq("client_id", c.id).eq("therapist_id", t.id).limit(200),
      sb.from("therapist_documents").select("id, file_name, created_at").eq("client_id", c.id).limit(200),
      sb.from("client_questionnaire_responses").select("id, statut, created_at").eq("client_id", c.id).eq("therapist_id", t.id).limit(200),
    ]);
    type E = { id: string; at: string; kind: string; label: string };
    const ev: E[] = [{ id: `c-${c.id}`, at: c.created_at, kind: "created", label: "Fiche client créée" }];
    for (const r of au.data ?? []) ev.push({ id: r.id, at: r.created_at, kind: r.action, label: auditLabel(r.action, r.details) });
    for (const r of ap.data ?? []) ev.push({ id: `a-${r.id}`, at: r.created_at, kind: "appointment", label: `Rendez-vous du ${r.appointment_date ?? "—"} (${r.status})` });
    for (const r of inv.data ?? []) ev.push({ id: `i-${r.id}`, at: r.created_at, kind: "invoice", label: `Facture ${r.numero_facture ?? "brouillon"} — ${Number(r.montant_total ?? 0).toFixed(2)} (${r.statut})` });
    for (const r of docs.data ?? []) ev.push({ id: `d-${r.id}`, at: r.created_at, kind: "document", label: `Document ajouté : ${r.file_name}` });
    for (const r of resp.data ?? []) ev.push({ id: `q-${r.id}`, at: r.created_at, kind: "questionnaire", label: `Questionnaire reçu (${r.statut})` });
    if (c.consent_at) ev.push({ id: `k-${c.id}`, at: c.consent_at, kind: "consent", label: `Consentement recueilli (${c.consent_source ?? "—"})` });
    ev.sort((a, b) => (a.at < b.at ? 1 : -1));
    return ev;
  });

function auditLabel(action: string, d: any): string {
  switch (action) {
    case "status": return `Statut changé : ${d?.to ?? ""}`;
    case "archived": return "Client archivé";
    case "unarchived": return "Client désarchivé";
    case "updated": return "Coordonnées modifiées";
    case "created": return "Client créé";
    case "invoice_reminder": return `Relance facture ${d?.numero ?? ""} → ${d?.to ?? ""} (${d?.status ?? ""})`;
    case "questionnaire_sent": return `Questionnaire « ${d?.title ?? ""} » envoyé → ${d?.to ?? ""} (${d?.status ?? ""})`;
    case "consent_requested": return `Demande de consentement → ${d?.to ?? ""} (${d?.status ?? ""})`;
    case "consent_recorded": return "Consentement accepté par le client";
    case "merged": return d?.role === "kept" ? `Fiche fusionnée avec un doublon` : `Fiche fusionnée dans une autre et archivée`;
    default: return action;
  }
}

export const setClientArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const t = await therapistOf(sb, context.userId);
    await ownContact(sb, t.id, data.id);
    const patch = data.archived
      ? { archived_at: new Date().toISOString(), relation_status: "inactive" }
      : { archived_at: null, relation_status: "active" };
    const { error } = await sb.from("crm_client_contacts").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", data.id).eq("therapist_id", t.id);
    if (error) throw new Error(error.message);
    await audit(sb, t.id, data.id, context.userId, data.archived ? "archived" : "unarchived");
    return { ok: true };
  });

// ── Consentement par e-mail ────────────────────────────────────────────────
function consentContent(therapistName: string, link: string) {
  const subject = `${therapistName} vous demande votre consentement`;
  const text = `Bonjour,\n\n${therapistName} souhaite conserver vos coordonnées et l'historique de vos séances pour assurer votre suivi, conformément à la loi suisse sur la protection des données (nLPD).\n\nVous pouvez donner votre accord en un clic via le lien ci-dessous. Vous pouvez le retirer à tout moment en répondant à cet e-mail.`;
  return { subject, text, link };
}

export const previewConsentRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const t = await therapistOf(context.supabase, context.userId);
    const c = await ownContact(context.supabase, t.id, data.id);
    const name = `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() || "Votre thérapeute";
    return { to: c.email as string | null, replyTo: t.email, ...consentContent(name, "(lien personnel sécurisé)") };
  });

export const sendConsentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), origin: z.string().url().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const t = await therapistOf(sb, context.userId);
    const c = await ownContact(sb, t.id, data.id);
    if (!c.email) throw new Error("Ce client n'a pas d'adresse e-mail.");
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { error } = await sb.from("crm_client_contacts")
      .update({ consent_request_token: token, consent_requested_at: new Date().toISOString() })
      .eq("id", c.id).eq("therapist_id", t.id);
    if (error) throw new Error(error.message);
    const base = (data.origin ?? "https://holiswiss.ch").replace(/\/$/, "");
    const link = `${base}/consentement/${token}`;
    const name = `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() || "Votre thérapeute";
    const m = consentContent(name, link);
    const { sendRawEmail } = await import("@/lib/holiswiss-email.server");
    const { emailShell, escapeHtml } = await import("@/lib/email-shell.shared");
    const html = emailShell(`
      <h2 style="margin:0 0 12px;color:#1c1c1e;font-size:20px;">Votre consentement</h2>
      ${m.text.split("\n\n").map((p) => `<p style="margin:0 0 14px;">${escapeHtml(p)}</p>`).join("")}
      <p style="text-align:center;margin:24px 0;"><a href="${link}" style="display:inline-block;padding:14px 26px;border-radius:999px;background:#7c3aed;color:#fff;font-weight:600;text-decoration:none;">Donner mon accord</a></p>
      <p style="margin:16px 0 0;font-size:12px;color:#888;word-break:break-all;">Si le bouton ne fonctionne pas : ${escapeHtml(link)}</p>`);
    let ok = false; let errMsg = "";
    try {
      const res: any = await sendRawEmail({ to: c.email, subject: m.subject, html, replyTo: t.email });
      ok = !!res?.ok; errMsg = res?.error ?? "";
    } catch (e: any) { errMsg = String(e?.message ?? e); }
    await audit(sb, t.id, c.id, context.userId, "consent_requested", { to: c.email, subject: m.subject, status: ok ? "envoyé" : "échec" });
    if (!ok) throw new Error(`L'e-mail n'a pas pu être envoyé. ${errMsg}`.trim());
    return { ok: true, to: c.email };
  });

// Page publique : le client accepte via son lien personnel (jeton aléatoire long).
const TokenSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) });

export const getConsentByToken = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await (supabaseAdmin as any).from("crm_client_contacts")
      .select("first_name, therapist_id, consent_at").eq("consent_request_token", data.token).maybeSingle();
    if (!c) return { status: "invalid" as const };
    const { data: t } = await (supabaseAdmin as any).from("therapists").select("first_name, last_name").eq("id", c.therapist_id).maybeSingle();
    return { status: "pending" as const, firstName: c.first_name as string, therapist: `${t?.first_name ?? ""} ${t?.last_name ?? ""}`.trim() };
  });

export const acceptConsentByToken = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: c } = await sb.from("crm_client_contacts").select("id, therapist_id")
      .eq("consent_request_token", data.token).maybeSingle();
    if (!c) return { ok: false };
    const now = new Date();
    const expires = new Date(now); expires.setFullYear(expires.getFullYear() + 2);
    await sb.from("crm_client_contacts").update({
      consent_at: now.toISOString(), consent_source: "lien e-mail accepté par le client",
      consent_expires_at: expires.toISOString(), consent_request_token: null,
    }).eq("id", c.id);
    await sb.from("crm_client_audit").insert({ therapist_id: c.therapist_id, contact_id: c.id, actor_id: null, action: "consent_recorded", details: {} });
    return { ok: true };
  });

// ── Doublons ───────────────────────────────────────────────────────────────
const normEmail = (s?: string | null) => (s ?? "").trim().toLowerCase();
const normPhone = (s?: string | null) => {
  let d = (s ?? "").replace(/[^0-9+]/g, "");
  if (d.startsWith("00")) d = "+" + d.slice(2);
  if (d.startsWith("0") && !d.startsWith("+")) d = "+41" + d.slice(1);
  return d.length >= 8 ? d : "";
};
const normName = (a?: string | null, b?: string | null) =>
  `${a ?? ""} ${b ?? ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z ]/g, "").split(" ").filter(Boolean).sort().join(" ");
function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}

export const findClientDuplicates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const t = await therapistOf(sb, context.userId);
    const { data } = await sb.from("crm_client_contacts")
      .select("id, first_name, last_name, email, phone, created_at, merged_into_id")
      .eq("therapist_id", t.id).is("merged_into_id", null).limit(2000);
    const rows = (data ?? []) as any[];
    const pairs: { a: any; b: any; reasons: string[] }[] = [];
    for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i], b = rows[j]; const r: string[] = [];
      if (normEmail(a.email) && normEmail(a.email) === normEmail(b.email)) r.push("même e-mail");
      if (normPhone(a.phone) && normPhone(a.phone) === normPhone(b.phone)) r.push("même téléphone");
      const s = similarity(normName(a.first_name, a.last_name), normName(b.first_name, b.last_name));
      if (s >= 0.85) r.push(s === 1 ? "même nom" : "nom très proche");
      if (r.length) pairs.push({ a, b, reasons: r });
    }
    return pairs.slice(0, 100);
  });

const REASSIGN: [string, string][] = [
  ["appointments", "client_id"], ["therapist_invoices", "client_id"], ["therapist_documents", "client_id"],
  ["client_questionnaire_responses", "client_id"], ["crm_session_notes", "contact_id"], ["crm_tasks", "contact_id"],
  ["client_packages", "client_id"], ["email_send_history", "client_id"], ["invoices", "contact_id"],
];
const FILL = ["last_name", "email", "phone", "date_of_birth", "address_line1", "address_line2", "postal_code", "city", "canton", "consent_at", "consent_source", "consent_expires_at"];

export const mergeClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ keep_id: z.string().uuid(), drop_id: z.string().uuid() })
    .refine((v) => v.keep_id !== v.drop_id).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const t = await therapistOf(sb, context.userId);
    const keep = await ownContact(sb, t.id, data.keep_id);
    const drop = await ownContact(sb, t.id, data.drop_id);
    // Les deux fiches appartiennent au thérapeute connecté : rattachement privilégié.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const fill: Record<string, unknown> = {};
    for (const k of FILL) if ((keep[k] == null || keep[k] === "") && drop[k] != null && drop[k] !== "") fill[k] = drop[k];
    fill.tags = Array.from(new Set([...(keep.tags ?? []), ...(drop.tags ?? [])]));
    await admin.from("crm_client_contacts").update({ ...fill, updated_at: new Date().toISOString() }).eq("id", keep.id).eq("therapist_id", t.id);
    const moved: Record<string, number | string> = {};
    for (const [table, col] of REASSIGN) {
      const { data: r, error } = await admin.from(table).update({ [col]: keep.id }).eq(col, drop.id).select("id");
      moved[table] = error ? `non déplacé (${error.message.slice(0, 80)})` : (r?.length ?? 0);
    }
    await admin.from("crm_client_contacts").update({
      merged_into_id: keep.id, archived_at: new Date().toISOString(), relation_status: "inactive",
    }).eq("id", drop.id).eq("therapist_id", t.id);
    await audit(sb, t.id, keep.id, context.userId, "merged", { role: "kept", other: drop.id, moved, filled: Object.keys(fill) });
    await audit(sb, t.id, drop.id, context.userId, "merged", { role: "archived", into: keep.id });
    return { ok: true, moved };
  });

// ── Corbeille (60 jours) ───────────────────────────────────────────────────
const TRASH_DAYS = 60;

export const trashClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), confirm: z.literal("Supprimer") }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const t = await therapistOf(sb, context.userId);
    await ownContact(sb, t.id, data.id);
    const { error } = await sb.from("crm_client_contacts")
      .update({ trashed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", data.id).eq("therapist_id", t.id);
    if (error) throw new Error(error.message);
    await audit(sb, t.id, data.id, context.userId, "archived", { trashed: true });
    return { ok: true };
  });

export const restoreClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const t = await therapistOf(sb, context.userId);
    const { error } = await sb.from("crm_client_contacts")
      .update({ trashed_at: null, updated_at: new Date().toISOString() })
      .eq("id", data.id).eq("therapist_id", t.id);
    if (error) throw new Error(error.message);
    await audit(sb, t.id, data.id, context.userId, "unarchived", { restored_from_trash: true });
    return { ok: true };
  });

/** Liste la corbeille et supprime définitivement les fiches de plus de 60 jours. */
export const listTrash = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const t = await therapistOf(sb, context.userId);
    const limit = new Date(Date.now() - TRASH_DAYS * 86400000).toISOString();
    await sb.from("crm_client_contacts").delete().eq("therapist_id", t.id).lt("trashed_at", limit);
    const { data, error } = await sb.from("crm_client_contacts")
      .select("id, first_name, last_name, email, trashed_at")
      .eq("therapist_id", t.id).not("trashed_at", "is", null).order("trashed_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      ...r,
      purge_at: new Date(new Date(r.trashed_at).getTime() + TRASH_DAYS * 86400000).toISOString(),
    })) as { id: string; first_name: string; last_name: string; email: string | null; trashed_at: string; purge_at: string }[];
  });
