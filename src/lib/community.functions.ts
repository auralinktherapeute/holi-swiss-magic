import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";
import { CHARTER_VERSION } from "@/lib/community-charter.shared";

type AnyClient = any;

async function loadAuthorMap(userIds: string[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return {} as Record<string, { name: string; photo_url: string | null; slug: string | null }>;
  const { data } = await (supabaseAdmin as AnyClient)
    .from("therapists")
    .select("user_id, first_name, last_name, photo_url, slug")
    .in("user_id", unique);
  const map: Record<string, { name: string; photo_url: string | null; slug: string | null }> = {};
  for (const t of data ?? []) {
    map[t.user_id] = {
      name: `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() || "Thérapeute",
      photo_url: t.photo_url ?? null,
      slug: t.slug ?? null,
    };
  }
  return map;
}

/** Statut d'accès de l'utilisateur courant aux salons. */
export const getCommunityAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as AnyClient;
    const [{ data: verified }, { data: muted }, { data: sanctions }] = await Promise.all([
      admin.rpc("is_verified_therapist", { _uid: context.userId }),
      admin.rpc("community_is_muted", { _uid: context.userId }),
      admin
        .from("user_sanctions")
        .select("kind, reason, expires_at, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    return {
      isVerified: Boolean(verified),
      isMuted: Boolean(muted),
      sanctions: sanctions ?? [],
    };
  });

/** Familles + état d'acceptation de la charte + activité. */
export const listCommunityFamilies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as AnyClient;

    const [{ data: families }, { data: accepted }, { data: messages }, { data: verified }] = await Promise.all([
      admin.from("therapist_families").select("*").order("sort_order", { ascending: true }),
      admin.from("charter_acceptances").select("family_id, accepted_at").eq("user_id", context.userId),
      admin.from("community_messages").select("family_id, created_at"),
      admin.rpc("is_verified_therapist", { _uid: context.userId }),
    ]);

    const acceptedSet = new Set((accepted ?? []).map((a: any) => a.family_id));
    const counts: Record<string, { total: number; last: string | null }> = {};
    for (const m of messages ?? []) {
      const c = counts[m.family_id] ?? { total: 0, last: null };
      c.total += 1;
      if (!c.last || m.created_at > c.last) c.last = m.created_at;
      counts[m.family_id] = c;
    }

    return {
      isVerified: Boolean(verified),
      families: (families ?? []).map((f: any) => ({
        ...f,
        accepted: acceptedSet.has(f.id),
        messageCount: counts[f.id]?.total ?? 0,
        lastMessageAt: counts[f.id]?.last ?? null,
      })),
    };
  });

export const acceptCharter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { familyId: string }) => z.object({ familyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as AnyClient;
    const { data: verified } = await admin.rpc("is_verified_therapist", { _uid: context.userId });
    if (!verified) throw new Error("Seuls les thérapeutes vérifiés peuvent rejoindre un salon.");

    const { error } = await admin.from("charter_acceptances").upsert(
      { user_id: context.userId, family_id: data.familyId, charter_version: CHARTER_VERSION },
      { onConflict: "user_id,family_id" },
    );
    if (error) throw new Error("Impossible d'enregistrer votre acceptation.");

    const { data: family } = await admin
      .from("therapist_families")
      .select("slug")
      .eq("id", data.familyId)
      .maybeSingle();
    return { ok: true, slug: family?.slug ?? null };
  });

/** Salon : famille, droits d'accès et messages. */
export const getCommunityRoom = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string; limit?: number }) =>
    z.object({ slug: z.string().min(1), limit: z.number().min(1).max(200).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as AnyClient;

    const { data: family } = await admin
      .from("therapist_families")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!family) throw new Error("Salon introuvable.");

    const [{ data: verified }, { data: muted }, { data: acceptance }] = await Promise.all([
      admin.rpc("is_verified_therapist", { _uid: context.userId }),
      admin.rpc("community_is_muted", { _uid: context.userId }),
      admin
        .from("charter_acceptances")
        .select("accepted_at")
        .eq("user_id", context.userId)
        .eq("family_id", family.id)
        .maybeSingle(),
    ]);

    const isAdmin = await isAdminUser(context.userId);
    if (!verified && !isAdmin) {
      return { family, isVerified: false, hasAccepted: false, isMuted: false, isAdmin, messages: [] };
    }

    const { data: rows } = await admin
      .from("community_messages")
      .select("*")
      .eq("family_id", family.id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);

    const authors = await loadAuthorMap((rows ?? []).map((r: any) => r.user_id));
    const messages = (rows ?? []).map((r: any) => ({
      ...r,
      // Le motif de signalement reste réservé à l'auteur et aux modérateurs.
      flagged_reason: isAdmin || r.user_id === context.userId ? r.flagged_reason : null,
      author: authors[r.user_id] ?? { name: "Thérapeute", photo_url: null, slug: null },
      isMine: r.user_id === context.userId,
    }));

    return {
      family,
      isVerified: true,
      hasAccepted: Boolean(acceptance),
      isMuted: Boolean(muted),
      isAdmin,
      messages,
      currentUserId: context.userId,
    };
  });

async function isAdminUser(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as AnyClient)
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return Boolean(data);
}

export const postCommunityMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { familyId: string; content: string }) =>
    z.object({ familyId: z.string().uuid(), content: z.string().trim().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // RLS applique : vérifié + charte acceptée + non suspendu.
    const { data: inserted, error } = await (context.supabase as AnyClient)
      .from("community_messages")
      .insert({ family_id: data.familyId, user_id: context.userId, content: data.content })
      .select("*")
      .single();
    if (error) {
      console.error("[community] insert refusé", error);
      throw new Error(
        "Envoi refusé : votre profil doit être vérifié, la charte acceptée, et votre compte non suspendu.",
      );
    }
    return { message: inserted };
  });

export const updateCommunityMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; content: string }) =>
    z.object({ id: z.string().uuid(), content: z.string().trim().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as AnyClient)
      .from("community_messages")
      .update({ content: data.content, edited_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("Modification impossible.");
    return { ok: true };
  });

export const deleteCommunityMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as AnyClient)
      .from("community_messages")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error("Suppression impossible.");
    return { ok: true };
  });

/* ------------------------------ Modération ------------------------------ */

export const listFlaggedMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { familySlug?: string | null; userId?: string | null }) =>
    z
      .object({ familySlug: z.string().nullable().optional(), userId: z.string().nullable().optional() })
      .optional()
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as AnyClient;

    const { data: families } = await admin.from("therapist_families").select("id, name, slug").order("sort_order");
    const famBySlug = new Map((families ?? []).map((f: any) => [f.slug, f]));
    const famById = new Map((families ?? []).map((f: any) => [f.id, f]));

    let q = admin
      .from("community_messages")
      .select("*")
      .eq("is_flagged", true)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data?.familySlug) {
      const fam = famBySlug.get(data.familySlug) as any;
      if (fam) q = q.eq("family_id", fam.id);
    }
    if (data?.userId) q = q.eq("user_id", data.userId);

    const { data: rows } = await q;
    const authors = await loadAuthorMap((rows ?? []).map((r: any) => r.user_id));

    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    const { data: sanctions } = userIds.length
      ? await admin.from("user_sanctions").select("*").in("user_id", userIds)
      : { data: [] as any[] };
    const { data: reports } = await admin
      .from("moderation_reports")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(200);

    return {
      families: families ?? [],
      messages: (rows ?? []).map((r: any) => ({
        ...r,
        family: famById.get(r.family_id) ?? null,
        author: authors[r.user_id] ?? { name: "Thérapeute", photo_url: null, slug: null },
        warnings: (sanctions ?? []).filter((s: any) => s.user_id === r.user_id && s.kind === "warning").length,
        activeSanction:
          (sanctions ?? []).find(
            (s: any) =>
              s.user_id === r.user_id &&
              s.kind !== "warning" &&
              (!s.expires_at || new Date(s.expires_at) > new Date()),
          ) ?? null,
        report: (reports ?? []).find((rp: any) => rp.message_id === r.id) ?? null,
      })),
    };
  });

export const applySanction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { userId: string; familyId?: string | null; kind: "warning" | "suspension" | "ban"; reason?: string; days?: number }) =>
      z
        .object({
          userId: z.string().uuid(),
          familyId: z.string().uuid().nullable().optional(),
          kind: z.enum(["warning", "suspension", "ban"]),
          reason: z.string().max(1000).optional(),
          days: z.number().min(1).max(365).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as AnyClient;
    const expires =
      data.kind === "suspension"
        ? new Date(Date.now() + (data.days ?? 7) * 86400000).toISOString()
        : null;
    const { error } = await admin.from("user_sanctions").insert({
      user_id: data.userId,
      family_id: data.familyId ?? null,
      kind: data.kind,
      reason: data.reason ?? null,
      created_by: context.userId,
      expires_at: expires,
    });
    if (error) throw new Error("Sanction non enregistrée.");
    return { ok: true, expiresAt: expires };
  });

export const resolveModerationItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messageId: string; action: "keep" | "remove" }) =>
    z.object({ messageId: z.string().uuid(), action: z.enum(["keep", "remove"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as AnyClient;
    if (data.action === "remove") {
      await admin.from("community_messages").delete().eq("id", data.messageId);
    } else {
      await admin
        .from("community_messages")
        .update({ is_flagged: false, flagged_reason: null, moderation_severity: null })
        .eq("id", data.messageId);
    }
    await admin
      .from("moderation_reports")
      .update({ status: data.action === "remove" ? "removed" : "dismissed" })
      .eq("message_id", data.messageId);
    return { ok: true };
  });
