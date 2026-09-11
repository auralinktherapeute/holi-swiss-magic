import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

/**
 * Administration des certifications délivrées par des organismes externes
 * (SVHH, SoulSense…). Strictement distinct des diplômes des thérapeutes
 * (`therapist_certifications`) : tables, écrans et fonctions séparés.
 * `external_reference` n'est renvoyée que par ces fonctions, réservées aux admins.
 */

const STATUSES = ["pending", "active", "suspended", "expired", "revoked"] as const;
export type OrgCertificationStatus = (typeof STATUSES)[number];

/* ------------------------------- Organismes ------------------------------- */

export const listCertificationOrganizations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("certification_organizations")
      .select("id,code,display_name,logo_url,badge_color,is_active,created_at")
      .order("display_name");
    if (error) throw new Error(error.message);

    const { data: certs } = await supabaseAdmin
      .from("therapist_org_certifications")
      .select("organization_id,status");
    const counts = new Map<string, { total: number; active: number }>();
    for (const c of certs ?? []) {
      const e = counts.get(c.organization_id) ?? { total: 0, active: 0 };
      e.total += 1;
      if (c.status === "active") e.active += 1;
      counts.set(c.organization_id, e);
    }

    return (data ?? []).map((o) => ({
      ...o,
      certificationsTotal: counts.get(o.id)?.total ?? 0,
      certificationsActive: counts.get(o.id)?.active ?? 0,
    }));
  });

export const upsertCertificationOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional().nullable(),
      code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, "Code alphanumérique uniquement."),
      display_name: z.string().trim().min(2).max(120),
      logo_url: z.string().trim().url().max(500).optional().nullable().or(z.literal("")),
      badge_color: z
        .string()
        .trim()
        .regex(/^#[0-9a-fA-F]{6}$/, "Couleur au format #RRGGBB.")
        .optional()
        .nullable()
        .or(z.literal("")),
      is_active: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = {
      code: data.code.toUpperCase(),
      display_name: data.display_name,
      logo_url: data.logo_url ? data.logo_url : null,
      badge_color: data.badge_color ? data.badge_color : null,
      is_active: data.is_active,
    };

    if (data.id) {
      const { error } = await supabaseAdmin.from("certification_organizations").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: created, error } = await supabaseAdmin
      .from("certification_organizations")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: created.id };
  });

export const setCertificationOrganizationActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), is_active: z.boolean() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("certification_organizations")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------- Associations thérapeute --------------------------- */

export const listOrgCertifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        search: z.string().trim().max(120).optional(),
        organizationId: z.string().uuid().optional(),
        status: z.enum(STATUSES).optional(),
      })
      .optional(),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("therapist_org_certifications")
      .select("id,therapist_id,organization_id,status,certified_since,external_reference,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data?.organizationId) query = query.eq("organization_id", data.organizationId);
    if (data?.status) query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const therapistIds = Array.from(new Set((rows ?? []).map((r) => r.therapist_id)));
    const { data: therapists } = therapistIds.length
      ? await supabaseAdmin
          .from("therapists")
          .select("id,first_name,last_name,slug,photo_url,city")
          .in("id", therapistIds)
      : { data: [] as any[] };
    const byTherapist = new Map((therapists ?? []).map((t: any) => [t.id, t]));

    const { data: orgs } = await supabaseAdmin
      .from("certification_organizations")
      .select("id,code,display_name,badge_color,is_active");
    const byOrg = new Map((orgs ?? []).map((o) => [o.id, o]));

    const term = data?.search?.toLowerCase().trim();

    return (rows ?? [])
      .map((r) => {
        const t = byTherapist.get(r.therapist_id);
        const o = byOrg.get(r.organization_id);
        return {
          id: r.id,
          status: r.status as OrgCertificationStatus,
          certifiedSince: r.certified_since as string | null,
          externalReference: (r.external_reference ?? null) as string | null,
          createdAt: r.created_at as string,
          therapistId: r.therapist_id as string,
          therapistName: `${t?.first_name ?? ""} ${t?.last_name ?? ""}`.trim() || "—",
          therapistSlug: (t?.slug ?? null) as string | null,
          therapistPhoto: (t?.photo_url ?? null) as string | null,
          therapistCity: (t?.city ?? null) as string | null,
          organizationId: r.organization_id as string,
          organizationCode: o?.code ?? "—",
          organizationName: o?.display_name ?? "—",
          organizationColor: o?.badge_color ?? null,
        };
      })
      .filter((r) => !term || r.therapistName.toLowerCase().includes(term));
  });

export const searchTherapistsForCertification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ term: z.string().trim().min(2).max(80) }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const term = data.term.replace(/[%,]/g, " ").trim();
    const { data: rows, error } = await supabaseAdmin
      .from("therapists")
      .select("id,first_name,last_name,city,photo_url")
      .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
      .order("last_name")
      .limit(15);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((t: any) => ({
      id: t.id as string,
      label: `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() || "—",
      city: (t.city ?? null) as string | null,
      photo: (t.photo_url ?? null) as string | null,
    }));
  });

export const createOrgCertification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      therapistId: z.string().uuid(),
      organizationId: z.string().uuid(),
      status: z.enum(STATUSES),
      certifiedSince: z.string().trim().max(20).optional().nullable().or(z.literal("")),
      externalReference: z.string().trim().max(200).optional().nullable().or(z.literal("")),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("certification_organizations")
      .select("id,is_active")
      .eq("id", data.organizationId)
      .maybeSingle();
    if (orgErr) throw new Error(orgErr.message);
    if (!org) throw new Error("Organisme introuvable.");
    if (!org.is_active) throw new Error("Cet organisme est désactivé.");

    const { data: created, error } = await supabaseAdmin
      .from("therapist_org_certifications")
      .insert({
        therapist_id: data.therapistId,
        organization_id: data.organizationId,
        status: data.status,
        certified_since: data.certifiedSince ? data.certifiedSince : null,
        external_reference: data.externalReference ? data.externalReference : null,
      })
      .select("id,status")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("Ce thérapeute est déjà associé à cet organisme.");
      throw new Error(error.message);
    }

    await (supabaseAdmin as any).from("therapist_org_certification_history").insert({
      certification_id: created.id,
      old_status: null,
      new_status: created.status,
      changed_by: context.userId,
    });

    return { ok: true, id: created.id };
  });

export const updateOrgCertification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      certifiedSince: z.string().trim().max(20).optional().nullable().or(z.literal("")),
      externalReference: z.string().trim().max(200).optional().nullable().or(z.literal("")),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("therapist_org_certifications")
      .update({
        certified_since: data.certifiedSince ? data.certifiedSince : null,
        external_reference: data.externalReference ? data.externalReference : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setOrgCertificationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(STATUSES) }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current, error: readErr } = await supabaseAdmin
      .from("therapist_org_certifications")
      .select("id,status")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!current) throw new Error("Certification introuvable.");
    if (current.status === data.status) return { ok: true, status: data.status };

    const { error } = await supabaseAdmin
      .from("therapist_org_certifications")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await (supabaseAdmin as any).from("therapist_org_certification_history").insert({
      certification_id: data.id,
      old_status: current.status,
      new_status: data.status,
      changed_by: context.userId,
    });

    return { ok: true, status: data.status };
  });

export const getOrgCertificationHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ certificationId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await (supabaseAdmin as any)
      .from("therapist_org_certification_history")
      .select("id,old_status,new_status,changed_by,changed_at")
      .eq("certification_id", data.certificationId)
      .order("changed_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const labels = new Map<string, string>();
    for (const uid of Array.from(new Set((rows ?? []).map((r: any) => r.changed_by).filter(Boolean)))) {
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid as string);
        if (u?.user?.email) labels.set(uid as string, u.user.email);
      } catch {
        /* identité indisponible : on l'omet */
      }
    }

    return (rows ?? []).map((r: any) => ({
      id: r.id as string,
      oldStatus: (r.old_status ?? null) as OrgCertificationStatus | null,
      newStatus: r.new_status as OrgCertificationStatus,
      changedAt: r.changed_at as string,
      changedByLabel: r.changed_by ? (labels.get(r.changed_by) ?? null) : null,
    }));
  });
