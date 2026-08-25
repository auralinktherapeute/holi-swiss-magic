import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";
import {
  detectDuplicateGroups,
  normEmail,
  normPhone,
  type DedupCandidate,
  type DuplicateGroup,
} from "@/lib/crm-dedup";

/** Projection explicite — jamais de select("*"). */
const LEAD_COLS =
  "id,first_name,last_name,email,phone,canton,specialty,source,status,priority,assigned_to,notes,last_contact_at,converted_therapist_id,created_at,updated_at,dedup_status,merged_into_id,merged_at,archived_at";

const MAX_SCAN = 2000;

export type CrmContactRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  canton: string | null;
  city: string | null;
  specialty: string | null;
  source: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  last_contact_at: string | null;
  converted_therapist_id: string | null;
  therapist_slug: string | null;
  therapist_status: string | null;
  therapist_verified: boolean | null;
  subscription_plan: string | null;
  photo_url: string | null;
  profession: string | null;
  health_score: number | null;
  duplicate_count: number;
  duplicate_level: string | null;
  sources: string[];
};

type RawLead = DedupCandidate & {
  priority: string;
  notes: string | null;
  last_contact_at: string | null;
  updated_at: string;
  merged_into_id: string | null;
  merged_at: string | null;
  archived_at: string | null;
};

async function loadLeads(filters: {
  status?: string;
  canton?: string;
  source?: string;
  search?: string;
  includeMerged?: boolean;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin
    .from("crm_leads")
    .select(LEAD_COLS)
    .order("created_at", { ascending: false })
    .limit(MAX_SCAN);
  if (!filters.includeMerged) q = q.neq("dedup_status", "merged");
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.canton) q = q.eq("canton", filters.canton);
  if (filters.source) q = q.eq("source", filters.source);
  if (filters.search?.trim()) {
    const s = `%${filters.search.trim().replace(/[%_]/g, "")}%`;
    q = q.or(
      `first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},phone.ilike.${s},canton.ilike.${s},specialty.ilike.${s}`,
    );
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RawLead[];
}

/** Clé de consolidation : profil thérapeute > email > téléphone > id. */
function consolidationKey(l: RawLead): string {
  if (l.converted_therapist_id) return `th:${l.converted_therapist_id}`;
  const e = normEmail(l.email);
  if (e) return `email:${e}`;
  const p = normPhone(l.phone);
  if (p) return `phone:${p}`;
  return `id:${l.id}`;
}

/** Fiche maître d'un groupe : celle rattachée au thérapeute, sinon la plus ancienne. */
function pickPrimary(list: RawLead[]): RawLead {
  const withTherapist = list.filter((l) => l.converted_therapist_id);
  const pool = withTherapist.length ? withTherapist : list;
  return [...pool].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
}

export const listCrmContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        search: z.string().max(200).optional(),
        status: z.string().max(40).optional(),
        canton: z.string().max(40).optional(),
        source: z.string().max(40).optional(),
        profileStatus: z.string().max(40).optional(),
        plan: z.string().max(40).optional(),
        health: z.enum(["low", "mid", "high"]).optional(),
        onlyDuplicates: z.boolean().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(100).default(25),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const leads = await loadLeads(data);

    // Doublons (calculés sur l'ensemble filtré)
    const groups = detectDuplicateGroups(leads);
    const levelByLead = new Map<string, { level: string; count: number }>();
    groups.forEach((g) => {
      g.leadIds.forEach((id) => {
        const prev = levelByLead.get(id);
        if (!prev || (prev.level !== "certain" && g.level === "certain")) {
          levelByLead.set(id, { level: g.level, count: g.leadIds.length });
        }
      });
    });

    // Consolidation : une ligne par personne
    const buckets = new Map<string, RawLead[]>();
    leads.forEach((l) => {
      const k = consolidationKey(l);
      const arr = buckets.get(k) ?? [];
      arr.push(l);
      buckets.set(k, arr);
    });

    const consolidated = [...buckets.values()].map((list) => {
      const primary = pickPrimary(list);
      const dup = levelByLead.get(primary.id);
      return {
        primary,
        siblings: list.filter((l) => l.id !== primary.id),
        duplicate_count: list.length > 1 ? list.length : dup?.count ?? 1,
        duplicate_level: list.length > 1 ? "certain" : dup?.level ?? null,
        sources: [...new Set(list.map((l) => l.source))],
      };
    });

    // Enrichissement thérapeute + santé (2 requêtes, pas de N+1)
    const therapistIds = consolidated
      .map((c) => c.primary.converted_therapist_id)
      .filter((v): v is string => !!v);
    const therapistById = new Map<string, Record<string, unknown>>();
    const healthById = new Map<string, number>();
    if (therapistIds.length) {
      const [{ data: ths }, { data: hs }] = await Promise.all([
        supabaseAdmin
          .from("therapists")
          .select("id,slug,title,city,canton,photo_url,status,verified,subscription_plan,specialties")
          .in("id", therapistIds),
        supabaseAdmin.from("therapist_health_scores").select("therapist_id,score_total").in("therapist_id", therapistIds),
      ]);
      (ths ?? []).forEach((t: any) => therapistById.set(t.id, t));
      (hs ?? []).forEach((h: any) => healthById.set(h.therapist_id, h.score_total));
    }

    let rows: CrmContactRow[] = consolidated.map((c) => {
      const l = c.primary;
      const t = (l.converted_therapist_id ? therapistById.get(l.converted_therapist_id) : undefined) as any;
      return {
        id: l.id,
        first_name: l.first_name,
        last_name: l.last_name,
        email: l.email,
        phone: l.phone,
        canton: l.canton ?? t?.canton ?? null,
        city: t?.city ?? null,
        specialty: l.specialty ?? (t?.specialties?.[0] ?? null),
        source: l.source,
        status: l.status,
        priority: l.priority,
        created_at: l.created_at,
        updated_at: l.updated_at,
        last_contact_at: l.last_contact_at,
        converted_therapist_id: l.converted_therapist_id,
        therapist_slug: t?.slug ?? null,
        therapist_status: t?.status ?? null,
        therapist_verified: t?.verified ?? null,
        subscription_plan: t?.subscription_plan ?? null,
        photo_url: t?.photo_url ?? null,
        profession: t?.title ?? l.specialty ?? null,
        health_score: l.converted_therapist_id ? healthById.get(l.converted_therapist_id) ?? null : null,
        duplicate_count: c.duplicate_count,
        duplicate_level: c.duplicate_level,
        sources: c.sources,
      };
    });

    if (data.profileStatus) rows = rows.filter((r) => r.therapist_status === data.profileStatus);
    if (data.plan) rows = rows.filter((r) => r.subscription_plan === data.plan);
    if (data.health) {
      rows = rows.filter((r) => {
        if (r.health_score == null) return false;
        if (data.health === "low") return r.health_score < 50;
        if (data.health === "mid") return r.health_score >= 50 && r.health_score < 75;
        return r.health_score >= 75;
      });
    }
    if (data.onlyDuplicates) rows = rows.filter((r) => (r.duplicate_count ?? 1) > 1 || !!r.duplicate_level);

    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const total = rows.length;
    const from = (data.page - 1) * data.pageSize;
    return {
      rows: rows.slice(from, from + data.pageSize),
      total,
      page: data.page,
      pageSize: data.pageSize,
      duplicateGroups: groups.length,
    };
  });

export const listCrmDuplicateGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ level: z.enum(["certain", "probable", "review"]).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const leads = await loadLeads({ includeMerged: false });
    const byId = new Map(leads.map((l) => [l.id, l]));
    let groups: DuplicateGroup[] = detectDuplicateGroups(leads);
    if (data.level) groups = groups.filter((g) => g.level === data.level);
    return {
      groups: groups.map((g) => ({
        key: g.key,
        level: g.level,
        score: g.score,
        reason: g.reason,
        dedupStatus: g.leadIds.every((id) => byId.get(id)?.dedup_status === "ignored") ? "ignored" : "open",
        leads: g.leadIds
          .map((id) => byId.get(id))
          .filter((l): l is RawLead => !!l)
          .map((l) => ({
            id: l.id,
            name: `${l.first_name} ${l.last_name}`.trim(),
            email: l.email,
            phone: l.phone,
            canton: l.canton,
            source: l.source,
            status: l.status,
            created_at: l.created_at,
            converted_therapist_id: l.converted_therapist_id,
          })),
      })),
    };
  });

/** Comparaison côte à côte avant fusion. */
export const getCrmMergePreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ leadIds: z.array(z.string().uuid()).min(2).max(6) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.from("crm_leads").select(LEAD_COLS).in("id", data.leadIds);
    if (error) throw new Error(error.message);
    const leads = (rows ?? []) as unknown as RawLead[];

    const counts = await Promise.all(
      leads.map(async (l) => {
        const [act, tasks] = await Promise.all([
          supabaseAdmin
            .from("crm_activities")
            .select("id", { count: "exact", head: true })
            .eq("entity_type", "lead")
            .eq("entity_id", l.id),
          supabaseAdmin
            .from("crm_tasks")
            .select("id", { count: "exact", head: true })
            .eq("entity_type", "lead")
            .eq("entity_id", l.id),
        ]);
        return { id: l.id, activities: act.count ?? 0, tasks: tasks.count ?? 0 };
      }),
    );

    const FIELDS = [
      "first_name","last_name","email","phone","canton","specialty","source","status","priority",
      "assigned_to","notes","last_contact_at","converted_therapist_id","created_at",
    ] as const;

    const comparison = FIELDS.map((f) => {
      const values = leads.map((l) => ({ leadId: l.id, value: (l as any)[f] ?? null }));
      const distinct = new Set(values.map((v) => (v.value == null ? "" : String(v.value))));
      return {
        field: f,
        values,
        state: distinct.size === 1 ? (distinct.has("") ? "missing" : "same") : "different",
      };
    });

    return { leads, counts, comparison };
  });

/** Fusion strictement manuelle, avec snapshot et réattribution complète. */
export const mergeCrmLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        primaryId: z.string().uuid(),
        mergeIds: z.array(z.string().uuid()).min(1).max(5),
        fieldChoices: z.record(z.string(), z.string().nullable()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.mergeIds.includes(data.primaryId)) throw new Error("La fiche principale ne peut pas être fusionnée avec elle-même.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const allIds = [data.primaryId, ...data.mergeIds];
    const { data: rows, error } = await supabaseAdmin.from("crm_leads").select(LEAD_COLS).in("id", allIds);
    if (error) throw new Error(error.message);
    const leads = (rows ?? []) as unknown as RawLead[];
    if (leads.length !== allIds.length) throw new Error("Une des fiches est introuvable.");
    const primary = leads.find((l) => l.id === data.primaryId)!;

    // Snapshot complet avant toute écriture (rollback)
    const [{ data: actSnap }, { data: taskSnap }] = await Promise.all([
      supabaseAdmin.from("crm_activities").select("id,entity_id,entity_type,therapist_id").eq("entity_type", "lead").in("entity_id", allIds),
      supabaseAdmin.from("crm_tasks").select("id,entity_id,entity_type,therapist_id").eq("entity_type", "lead").in("entity_id", allIds),
    ]);

    const { data: logRow, error: logErr } = await supabaseAdmin
      .from("crm_merge_log")
      .insert({
        primary_lead_id: data.primaryId,
        merged_lead_ids: data.mergeIds,
        performed_by: context.userId,
        snapshot: { leads, activities: actSnap ?? [], tasks: taskSnap ?? [] },
      })
      .select("id")
      .maybeSingle();
    if (logErr) throw new Error(logErr.message);

    // Valeurs conservées : choix admin, sinon première valeur non nulle (union pour les manquants)
    const merged: Record<string, unknown> = {};
    const FILLABLE = ["first_name","last_name","email","phone","canton","specialty","assigned_to","notes","converted_therapist_id","last_contact_at"] as const;
    for (const f of FILLABLE) {
      const chosen = data.fieldChoices?.[f];
      if (chosen !== undefined) {
        merged[f] = chosen;
        continue;
      }
      const current = (primary as any)[f];
      if (current != null && current !== "") continue;
      const fallback = leads.map((l) => (l as any)[f]).find((v) => v != null && v !== "");
      if (fallback != null) merged[f] = fallback;
    }
    // Notes : concaténation pour ne rien perdre
    const allNotes = leads.map((l) => l.notes).filter((n): n is string => !!n && n.trim().length > 0);
    if (allNotes.length > 1) merged.notes = [...new Set(allNotes)].join("\n---\n");

    merged.updated_at = new Date().toISOString();
    const { error: upErr } = await supabaseAdmin.from("crm_leads").update(merged).eq("id", data.primaryId);
    if (upErr) throw new Error(upErr.message);

    // Réattribution des relations
    const [{ error: aErr, count: aCount }, { error: tErr, count: tCount }] = await Promise.all([
      supabaseAdmin
        .from("crm_activities")
        .update({ entity_id: data.primaryId }, { count: "exact" })
        .eq("entity_type", "lead")
        .in("entity_id", data.mergeIds),
      supabaseAdmin
        .from("crm_tasks")
        .update({ entity_id: data.primaryId }, { count: "exact" })
        .eq("entity_type", "lead")
        .in("entity_id", data.mergeIds),
    ]);
    if (aErr) throw new Error(aErr.message);
    if (tErr) throw new Error(tErr.message);

    // Archivage du doublon (aucune suppression)
    const now = new Date().toISOString();
    const { error: archErr } = await supabaseAdmin
      .from("crm_leads")
      .update({ dedup_status: "merged", merged_into_id: data.primaryId, merged_at: now, archived_at: now, updated_at: now })
      .in("id", data.mergeIds);
    if (archErr) throw new Error(archErr.message);

    await supabaseAdmin
      .from("crm_merge_log")
      .update({ reassigned: { activities: aCount ?? 0, tasks: tCount ?? 0, fields: merged } })
      .eq("id", logRow?.id ?? "");

    await supabaseAdmin.from("crm_field_history").insert(
      Object.keys(merged)
        .filter((f) => f !== "updated_at")
        .map((f) => ({
          entity_type: "lead",
          entity_id: data.primaryId,
          field: f,
          old_value: (primary as any)[f] == null ? null : String((primary as any)[f]),
          new_value: merged[f] == null ? null : String(merged[f]),
          changed_by: context.userId,
          origin: "merge",
        })),
    );

    await supabaseAdmin.from("crm_activities").insert({
      entity_type: "lead",
      entity_id: data.primaryId,
      owner_id: context.userId,
      type: "status_change",
      title: `Fusion de ${data.mergeIds.length} fiche(s) en double`,
      metadata: { merge_log_id: logRow?.id, merged: data.mergeIds },
    });

    return { ok: true, mergeLogId: logRow?.id ?? null, reassigned: { activities: aCount ?? 0, tasks: tCount ?? 0 } };
  });

/** Rollback d'une fusion à partir du snapshot. */
export const revertCrmMerge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ mergeLogId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: log, error } = await supabaseAdmin
      .from("crm_merge_log")
      .select("id,primary_lead_id,merged_lead_ids,snapshot,reverted_at")
      .eq("id", data.mergeLogId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!log) throw new Error("Journal de fusion introuvable.");
    if ((log as any).reverted_at) throw new Error("Cette fusion a déjà été annulée.");

    const snap = (log as any).snapshot as {
      leads: RawLead[];
      activities: { id: string; entity_id: string }[];
      tasks: { id: string; entity_id: string }[];
    };

    // Restauration des champs de chaque fiche
    for (const l of snap.leads) {
      await supabaseAdmin
        .from("crm_leads")
        .update({
          first_name: l.first_name,
          last_name: l.last_name,
          email: l.email,
          phone: l.phone,
          canton: l.canton,
          specialty: l.specialty,
          status: l.status,
          priority: l.priority,
          notes: l.notes,
          last_contact_at: l.last_contact_at,
          converted_therapist_id: l.converted_therapist_id,
          dedup_status: l.dedup_status,
          merged_into_id: l.merged_into_id,
          merged_at: l.merged_at,
          archived_at: l.archived_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", l.id);
    }
    // Réattribution inverse des relations
    for (const a of snap.activities) {
      await supabaseAdmin.from("crm_activities").update({ entity_id: a.entity_id }).eq("id", a.id);
    }
    for (const t of snap.tasks) {
      await supabaseAdmin.from("crm_tasks").update({ entity_id: t.entity_id }).eq("id", t.id);
    }

    await supabaseAdmin
      .from("crm_merge_log")
      .update({ reverted_at: new Date().toISOString(), reverted_by: context.userId })
      .eq("id", data.mergeLogId);

    return { ok: true, restored: snap.leads.length };
  });

/** Marquer un groupe comme ignoré (faux positif) ou à réexaminer. */
export const setCrmDedupStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        leadIds: z.array(z.string().uuid()).min(1).max(10),
        status: z.enum(["open", "ignored", "confirmed"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("crm_leads")
      .update({ dedup_status: data.status, updated_at: new Date().toISOString() })
      .in("id", data.leadIds)
      .neq("dedup_status", "merged");
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("crm_field_history").insert(
      data.leadIds.map((id) => ({
        entity_type: "lead",
        entity_id: id,
        field: "dedup_status",
        new_value: data.status,
        changed_by: context.userId,
        origin: "admin",
      })),
    );
    return { ok: true };
  });
