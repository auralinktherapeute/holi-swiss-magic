import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";

function publicClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type Questionnaire = {
  id: string;
  therapist_id: string;
  titre: string;
  description: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
  questionnaire_questions?: QuestionnaireQuestion[];
};

export type QuestionnaireQuestion = {
  id: string;
  questionnaire_id: string;
  ordre: number;
  type_reponse: "texte" | "textarea" | "choix_unique" | "choix_multiple" | "echelle" | "oui_non" | "date";
  question: string;
  options: any;
  obligatoire: boolean;
};

export type ClientQuestionnaireResponse = {
  id: string;
  therapist_id: string;
  client_id: string | null;
  questionnaire_id: string;
  appointment_id: string | null;
  reponses: any;
  statut: string;
  patient_email: string | null;
  patient_name: string | null;
  date_soumission: string;
  created_at: string;
  questionnaires?: { titre: string };
  crm_client_contacts?: { first_name: string; last_name: string; email: string | null };
};

async function getTherapistId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("therapists").select("id").eq("user_id", userId).maybeSingle();
  if (error || !data) throw new Error("Profil thérapeute introuvable.");
  return data.id as string;
}

// ── Questionnaires CRUD ─────────────────────────────────────────────

export const listMyQuestionnaires = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { data, error } = await (context.supabase as any)
      .from("questionnaires")
      .select("*, questionnaire_questions(*)")
      .eq("therapist_id", therapistId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    // sort questions by ordre
    (data ?? []).forEach((q: any) => {
      q.questionnaire_questions = (q.questionnaire_questions ?? []).sort(
        (a: any, b: any) => a.ordre - b.ordre,
      );
    });
    return (data ?? []) as Questionnaire[];
  });

const QuestionInput = z.object({
  id: z.string().uuid().optional(),
  ordre: z.number().int().min(0),
  type_reponse: z.enum(["texte", "textarea", "choix_unique", "choix_multiple", "echelle", "oui_non", "date"]),
  question: z.string().trim().min(1, "Question requise"),
  options: z.any().optional().nullable(),
  obligatoire: z.boolean().default(false),
});

const QuestionnaireInput = z.object({
  id: z.string().uuid().optional(),
  titre: z.string().trim().min(1, "Titre requis"),
  description: z.string().trim().optional().nullable(),
  actif: z.boolean().default(true),
  questions: z.array(QuestionInput).default([]),
});

export const upsertQuestionnaire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => QuestionnaireInput.parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { id, questions, ...rest } = data;
    let qid = id;
    if (id) {
      const { error } = await (context.supabase as any)
        .from("questionnaires").update(rest).eq("id", id).eq("therapist_id", therapistId);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await (context.supabase as any)
        .from("questionnaires").insert({ ...rest, therapist_id: therapistId })
        .select("id").maybeSingle();
      if (error) throw new Error(error.message);
      qid = row.id;
    }
    // Replace all questions (simple approach)
    await (context.supabase as any).from("questionnaire_questions").delete().eq("questionnaire_id", qid);
    if (questions.length > 0) {
      const { error } = await (context.supabase as any)
        .from("questionnaire_questions")
        .insert(questions.map(({ id: _i, ...q }) => ({ ...q, questionnaire_id: qid })));
      if (error) throw new Error(error.message);
    }
    return { id: qid! };
  });

export const deleteQuestionnaire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("questionnaires").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Réponses des clients ────────────────────────────────────────────

export const listMyQuestionnaireResponses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ client_id: z.string().uuid().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    let q = (context.supabase as any)
      .from("client_questionnaire_responses")
      .select("*, questionnaires(titre), crm_client_contacts(first_name,last_name,email)")
      .eq("therapist_id", therapistId)
      .order("date_soumission", { ascending: false });
    if (data.client_id) q = q.eq("client_id", data.client_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as ClientQuestionnaireResponse[];
  });

export const getQuestionnaireResponse = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { data: row, error } = await (context.supabase as any)
      .from("client_questionnaire_responses")
      .select("*, questionnaires(*, questionnaire_questions(*)), crm_client_contacts(first_name,last_name,email)")
      .eq("id", data.id)
      .eq("therapist_id", therapistId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (row?.questionnaires?.questionnaire_questions) {
      row.questionnaires.questionnaire_questions.sort((a: any, b: any) => a.ordre - b.ordre);
    }
    return row;
  });

// Créer une réponse manuellement pour un client (le thérapeute saisit)
export const createClientResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    questionnaire_id: z.string().uuid(),
    client_id: z.string().uuid().optional().nullable(),
    patient_name: z.string().trim().optional().nullable(),
    patient_email: z.string().email().optional().nullable(),
    reponses: z.any(),
    appointment_id: z.string().uuid().optional().nullable(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { data: row, error } = await (context.supabase as any)
      .from("client_questionnaire_responses").insert({
        therapist_id: therapistId,
        questionnaire_id: data.questionnaire_id,
        client_id: data.client_id ?? null,
        patient_name: data.patient_name ?? null,
        patient_email: data.patient_email ?? null,
        appointment_id: data.appointment_id ?? null,
        reponses: data.reponses,
        statut: "soumis",
      }).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteQuestionnaireResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("client_questionnaire_responses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Public (patient) : lecture + soumission d'un questionnaire actif ────

export const getPublicQuestionnaire = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: q, error } = await sb
      .from("questionnaires")
      .select("id, therapist_id, titre, description, actif, questionnaire_questions(id,ordre,type_reponse,question,options,obligatoire)")
      .eq("id", data.id).eq("actif", true).maybeSingle();
    if (error) throw new Error(error.message);
    if (!q) throw new Error("Questionnaire introuvable ou inactif.");
    (q as any).questionnaire_questions = ((q as any).questionnaire_questions ?? [])
      .sort((a: any, b: any) => a.ordre - b.ordre);
    return q as any;
  });

export const submitPublicQuestionnaire = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({
    questionnaire_id: z.string().uuid(),
    therapist_id: z.string().uuid(),
    patient_name: z.string().trim().min(1, "Nom requis").max(200),
    patient_email: z.string().email().max(200).optional().nullable(),
    reponses: z.record(z.string(), z.any()),
  }).parse(input))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { error } = await sb.from("client_questionnaire_responses").insert({
      questionnaire_id: data.questionnaire_id,
      therapist_id: data.therapist_id,
      patient_name: data.patient_name,
      patient_email: data.patient_email ?? null,
      reponses: data.reponses,
      statut: "soumis",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });