// Portail patient : liens de consultation de facture signés, expirants et révocables.
// Le jeton n'est jamais stocké en clair : seule son empreinte SHA-256 est conservée.

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type PortalInvoice = {
  numero_facture: string;
  date_emission: string | null;
  date_echeance: string | null;
  statut: string;
  currency: string;
  montant_total: number;
  montant_paye: number;
  solde: number;
  therapistName: string;
  clientName: string | null;
  lines: { description: string; quantite: number; prix_unitaire: number; montant_ht: number }[];
  html: string;
};

/**
 * Résout un jeton public en facture consultable. Renvoie null si le lien est
 * inconnu, révoqué ou expiré. Utilise le service role : le patient n'a jamais
 * d'accès direct à la base.
 */
export async function resolvePortalInvoice(token: string): Promise<PortalInvoice | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const token_hash = await hashToken(token);

  const { data: link } = await (supabaseAdmin as any)
    .from("invoice_access_tokens")
    .select("id, invoice_id, therapist_id, expires_at, revoked_at, view_count")
    .eq("token_hash", token_hash)
    .maybeSingle();
  if (!link) return null;
  if (link.revoked_at) return null;
  if (new Date(link.expires_at).getTime() < Date.now()) return null;

  const { buildInvoiceHtml } = await import("@/lib/invoice-html.server");
  const built = await buildInvoiceHtml(supabaseAdmin, link.therapist_id, link.invoice_id);
  const inv = built.invoice;

  await (supabaseAdmin as any)
    .from("invoice_access_tokens")
    .update({ view_count: Number(link.view_count ?? 0) + 1, last_viewed_at: new Date().toISOString() })
    .eq("id", link.id);

  if (inv.statut === "envoyee") {
    await (supabaseAdmin as any)
      .from("therapist_invoices")
      .update({ statut: "consultee" })
      .eq("id", inv.id);
  }

  const total = Number(inv.montant_total ?? 0);
  const paye = Number(inv.montant_paye ?? 0);
  return {
    numero_facture: inv.numero_facture,
    date_emission: inv.date_emission ?? null,
    date_echeance: inv.date_echeance ?? null,
    statut: inv.statut === "envoyee" ? "consultee" : inv.statut,
    currency: inv.currency ?? "CHF",
    montant_total: total,
    montant_paye: paye,
    solde: Math.round((total - paye) * 100) / 100,
    therapistName:
      `${built.therapist?.first_name ?? ""} ${built.therapist?.last_name ?? ""}`.trim() || "HoliSwiss",
    clientName: built.clientName ?? null,
    lines: (built.lines ?? []).map((l: any) => ({
      description: String(l.description ?? ""),
      quantite: Number(l.quantite ?? 0),
      prix_unitaire: Number(l.prix_unitaire ?? 0),
      montant_ht: Number(l.montant_ht ?? 0),
    })),
    html: built.html,
  };
}
