import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type IntakeSubmission = {
  id: string;
  therapist_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  birth_date: string | null;
  consultation_reason: string | null;
  medical_history: string | null;
  medications: string | null;
  allergies: string | null;
  consent_rgpd: boolean;
  consent_signature: string | null;
  consent_at: string | null;
  status: "new" | "converted" | "archived";
  converted_contact_id: string | null;
  created_at: string;
};

export type IntakeHeader = {
  id: string;
  first_name: string;
  last_name: string;
  title: string | null;
  photo_url: string | null;
  city: string | null;
};

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

// ── PUBLIC: Get therapist header by slug ──
export const getIntakeHeader = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data }): Promise<IntakeHeader | null> => {
    const sb = publicClient();
    const { data: rows, error } = await (sb as any).rpc("get_therapist_intake_header", { _slug: data.slug });
    if (error) throw new Error(error.message);
    return (rows?.[0] as IntakeHeader) ?? null;
  });

// ── PUBLIC: Submit intake form ──
const SubmitSchema = z.object({
  therapist_id: z.string().uuid(),
  first_name: z.string().trim().min(1, "Prénom requis").max(80),
  last_name: z.string().trim().min(1, "Nom requis").max(80),
  email: z.string().trim().email("Email invalide").max(200),
  phone: z.string().trim().max(40).optional().nullable(),
  birth_date: z.string().optional().nullable(),
  consultation_reason: z.string().trim().max(2000).optional().nullable(),
  medical_history: z.string().trim().max(2000).optional().nullable(),
  medications: z.string().trim().max(1000).optional().nullable(),
  allergies: z.string().trim().max(1000).optional().nullable(),
  consent_signature: z.string().trim().min(2, "Signature requise").max(120),
});

export const submitIntake = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SubmitSchema.parse(input))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { error } = await (sb as any).from("crm_intake_submissions").insert({
      ...data,
      birth_date: data.birth_date || null,
      consent_rgpd: true,
      consent_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── AUTH: List submissions for current therapist ──
export const listMyIntakes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IntakeSubmission[]> => {
    const { data: th } = await (context.supabase as any)
      .from("therapists").select("id").eq("user_id", context.userId).maybeSingle();
    if (!th) return [];
    const { data, error } = await (context.supabase as any)
      .from("crm_intake_submissions")
      .select("*")
      .eq("therapist_id", th.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as IntakeSubmission[];
  });

// ── AUTH: Convert submission → CRM contact ──
export const convertIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: sub, error: e1 } = await (context.supabase as any)
      .from("crm_intake_submissions").select("*").eq("id", data.id).maybeSingle();
    if (e1 || !sub) throw new Error("Soumission introuvable");
    if (sub.status === "converted" && sub.converted_contact_id) return { contact_id: sub.converted_contact_id };

    const privateNotes = [
      sub.consultation_reason && `Motif : ${sub.consultation_reason}`,
      sub.medical_history && `Antécédents : ${sub.medical_history}`,
      sub.medications && `Médicaments : ${sub.medications}`,
      sub.allergies && `Allergies : ${sub.allergies}`,
      sub.birth_date && `Date de naissance : ${sub.birth_date}`,
      `\nConsentement RGPD signé par ${sub.consent_signature} le ${sub.consent_at}`,
    ].filter(Boolean).join("\n\n");

    const { data: contact, error: e2 } = await (context.supabase as any)
      .from("crm_client_contacts")
      .insert({
        therapist_id: sub.therapist_id,
        first_name: sub.first_name,
        last_name: sub.last_name,
        email: sub.email,
        phone: sub.phone,
        private_notes: privateNotes,
        relation_status: "nouveau_client",
      })
      .select("id").single();
    if (e2) throw new Error(e2.message);

    await (context.supabase as any).from("crm_intake_submissions")
      .update({ status: "converted", converted_contact_id: contact.id })
      .eq("id", sub.id);

    return { contact_id: contact.id as string };
  });

export const archiveIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("crm_intake_submissions").update({ status: "archived" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("crm_intake_submissions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });