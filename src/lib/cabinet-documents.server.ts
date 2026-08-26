// Documents de cabinet rattachés à un client (L4).
// Règles :
// - un document client est TOUJOURS privé (is_public = false) : ce sont des
//   données de santé au sens de la nLPD, jamais servies par une URL publique ;
// - le chemin de stockage est conservé sous la forme `private:<path>` dans
//   `file_url`, et l'accès se fait par URL signée de courte durée ;
// - toute lecture/suppression est journalisée dans `crm_access_log`.

import { logAccess } from "@/lib/cabinet-core.server";

export const DOCUMENTS_BUCKET = "therapist-documents";
export const PRIVATE_PREFIX = "private:";

export const CLIENT_DOC_TYPES = [
  "consentement",
  "attestation",
  "recu",
  "bilan",
  "correspondance",
  "autre",
] as const;

export type ClientDocType = (typeof CLIENT_DOC_TYPES)[number];

export type ClientDocument = {
  id: string;
  file_name: string;
  label: string | null;
  doc_type: string;
  is_health_data: boolean;
  created_at: string;
  storage_path: string | null;
};

function storagePath(fileUrl: string): string | null {
  return fileUrl.startsWith(PRIVATE_PREFIX) ? fileUrl.slice(PRIVATE_PREFIX.length) : null;
}

/** Vérifie que le client appartient bien au thérapeute avant toute écriture. */
async function assertClientOwned(supabase: any, therapistId: string, clientId: string) {
  const { data, error } = await supabase
    .from("crm_client_contacts")
    .select("id")
    .eq("therapist_id", therapistId)
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Client introuvable.");
}

export async function listClientDocuments(
  supabase: any,
  therapistId: string,
  clientId: string,
): Promise<ClientDocument[]> {
  const { data, error } = await supabase
    .from("therapist_documents")
    .select("id,file_name,file_url,label,doc_type,is_health_data,created_at")
    .eq("therapist_id", therapistId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((d) => ({
    id: d.id,
    file_name: d.file_name,
    label: d.label ?? null,
    doc_type: d.doc_type ?? "autre",
    is_health_data: Boolean(d.is_health_data),
    created_at: d.created_at,
    storage_path: storagePath(String(d.file_url ?? "")),
  }));
}

/** Enregistre en base un fichier déjà téléversé dans le bucket privé. */
export async function registerClientDocument(
  supabase: any,
  therapistId: string,
  actorUserId: string,
  input: {
    client_id: string;
    path: string;
    file_name: string;
    label: string | null;
    doc_type: string;
    is_health_data: boolean;
  },
) {
  await assertClientOwned(supabase, therapistId, input.client_id);

  const { data, error } = await supabase
    .from("therapist_documents")
    .insert({
      therapist_id: therapistId,
      client_id: input.client_id,
      file_name: input.file_name,
      file_url: `${PRIVATE_PREFIX}${input.path}`,
      label: input.label,
      doc_type: input.doc_type,
      is_health_data: input.is_health_data,
      is_public: false,
      created_by: actorUserId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await logAccess(supabase, {
    therapistId,
    actorUserId,
    entityType: "document",
    entityId: data.id,
    action: "create",
    context: `document client (${input.doc_type})`,
  });
  return { id: data.id as string };
}

/** URL signée de courte durée pour consulter un document client. */
export async function signClientDocument(
  supabase: any,
  therapistId: string,
  actorUserId: string,
  documentId: string,
): Promise<{ url: string; file_name: string }> {
  const { data: doc, error } = await supabase
    .from("therapist_documents")
    .select("id,file_url,file_name,doc_type")
    .eq("therapist_id", therapistId)
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!doc) throw new Error("Document introuvable.");

  const path = storagePath(String(doc.file_url ?? ""));
  if (!path) {
    // Ancien document stocké sous forme d'URL directe : on la renvoie telle quelle.
    return { url: String(doc.file_url), file_name: doc.file_name };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, 300);
  if (signError || !signed?.signedUrl) throw new Error("Lien de téléchargement indisponible.");

  await logAccess(supabase, {
    therapistId,
    actorUserId,
    entityType: "document",
    entityId: documentId,
    action: "read",
    context: `ouverture document (${doc.doc_type ?? "autre"})`,
  });
  return { url: signed.signedUrl, file_name: doc.file_name };
}

/** Supprime le document en base puis le fichier du bucket. */
export async function deleteClientDocument(
  supabase: any,
  therapistId: string,
  actorUserId: string,
  documentId: string,
) {
  const { data: doc, error } = await supabase
    .from("therapist_documents")
    .select("id,file_url")
    .eq("therapist_id", therapistId)
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!doc) throw new Error("Document introuvable.");

  const { error: delError } = await supabase
    .from("therapist_documents")
    .delete()
    .eq("id", documentId)
    .eq("therapist_id", therapistId);
  if (delError) throw new Error(delError.message);

  const path = storagePath(String(doc.file_url ?? ""));
  if (path) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Un échec de suppression du fichier ne doit pas laisser la ligne en base.
    await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).remove([path]).catch(() => null);
  }

  await logAccess(supabase, {
    therapistId,
    actorUserId,
    entityType: "document",
    entityId: documentId,
    action: "delete",
    context: "suppression document client",
  });
  return { ok: true };
}

export type DocumentTemplateContext = {
  therapist: {
    name: string;
    profession: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
    ide: string | null;
  };
  client: {
    full_name: string;
    email: string | null;
    date_of_birth: string | null;
  };
  sessions: Array<{ date: string; time: string | null; service: string | null }>;
  currency: string;
};

/** Données d'en-tête pour les modèles de documents (attestation, consentement…). */
export async function buildTemplateContext(
  supabase: any,
  therapistId: string,
  clientId: string,
): Promise<DocumentTemplateContext> {
  const [therapistRes, settingsRes, clientRes, apptRes] = await Promise.all([
    supabase
      .from("therapists")
      .select("first_name,last_name,title,email,phone,city,address,postal_code")
      .eq("id", therapistId)
      .maybeSingle(),
    supabase
      .from("therapist_invoice_settings")
      .select(
        "raison_sociale,adresse_rue,adresse_npa,adresse_ville,email_pro,telephone,numero_ide,devise_defaut",
      )
      .eq("therapist_id", therapistId)
      .maybeSingle(),
    supabase
      .from("crm_client_contacts")
      .select("first_name,last_name,email,date_of_birth")
      .eq("therapist_id", therapistId)
      .eq("id", clientId)
      .maybeSingle(),
    supabase
      .from("appointments")
      .select("appointment_date,appointment_time,service_name,status")
      .eq("therapist_id", therapistId)
      .eq("client_id", clientId)
      .order("appointment_date", { ascending: false })
      .limit(24),
  ]);

  const t = (therapistRes.data ?? {}) as any;
  const s = (settingsRes.data ?? {}) as any;
  const c = clientRes.data as any;
  if (!c) throw new Error("Client introuvable.");

  const address = s.adresse_rue
    ? `${s.adresse_rue}, ${s.adresse_npa ?? ""} ${s.adresse_ville ?? ""}`.trim()
    : [t.address, t.postal_code, t.city].filter(Boolean).join(", ") || null;

  return {
    therapist: {
      name:
        s.raison_sociale ||
        `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() ||
        "Cabinet",
      profession: t.title ?? null,
      address,
      email: s.email_pro || t.email || null,
      phone: s.telephone || t.phone || null,
      ide: s.numero_ide ?? null,
    },
    client: {
      full_name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
      email: c.email ?? null,
      date_of_birth: c.date_of_birth ?? null,
    },
    sessions: ((apptRes.data ?? []) as any[])
      .filter((a) => a.status === "completed" || a.status === "confirmed")
      .map((a) => ({
        date: a.appointment_date,
        time: a.appointment_time ? String(a.appointment_time).slice(0, 5) : null,
        service: a.service_name ?? null,
      })),
    currency: s.devise_defaut || "CHF",
  };
}
