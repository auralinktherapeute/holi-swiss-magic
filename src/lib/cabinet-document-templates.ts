// Modèles de documents de cabinet (L4) — module client-safe, aucune dépendance serveur.
// Génère un HTML imprimable (impression navigateur → PDF) à partir du contexte
// renvoyé par le serveur. Aucune donnée de santé n'est ajoutée automatiquement :
// le thérapeute complète lui-même le corps du texte s'il le souhaite.

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

export type TemplateId = "attestation" | "consentement" | "recu";

export const TEMPLATES: Array<{ id: TemplateId; label: string; description: string }> = [
  {
    id: "attestation",
    label: "Attestation de suivi",
    description: "Confirme les séances effectuées, sans aucun détail clinique.",
  },
  {
    id: "consentement",
    label: "Consentement aux soins",
    description: "Formulaire d'information et de consentement à faire signer.",
  },
  {
    id: "recu",
    label: "Reçu de séance",
    description: "Reçu simple pour une séance réglée en espèces ou sur place.",
  },
];

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function frDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-CH", { day: "2-digit", month: "long", year: "numeric" });
}

function header(ctx: DocumentTemplateContext): string {
  const t = ctx.therapist;
  return `<header>
    <div class="issuer">
      <strong>${esc(t.name)}</strong>
      ${t.profession ? `<div>${esc(t.profession)}</div>` : ""}
      ${t.address ? `<div>${esc(t.address)}</div>` : ""}
      ${t.email ? `<div>${esc(t.email)}</div>` : ""}
      ${t.phone ? `<div>${esc(t.phone)}</div>` : ""}
      ${t.ide ? `<div>IDE : ${esc(t.ide)}</div>` : ""}
    </div>
    <div class="client">
      <div class="muted">Concerne</div>
      <strong>${esc(ctx.client.full_name)}</strong>
      ${ctx.client.date_of_birth ? `<div>Né(e) le ${esc(frDate(ctx.client.date_of_birth))}</div>` : ""}
    </div>
  </header>`;
}

function signature(ctx: DocumentTemplateContext, withClient: boolean): string {
  return `<div class="signatures">
    <div>
      <div class="line"></div>
      <div class="muted">${esc(ctx.therapist.name)}</div>
    </div>
    ${
      withClient
        ? `<div><div class="line"></div><div class="muted">${esc(ctx.client.full_name)}</div></div>`
        : ""
    }
  </div>`;
}

function body(
  id: TemplateId,
  ctx: DocumentTemplateContext,
  options: { amount?: number | null; sessionDate?: string | null },
): { title: string; content: string; withClientSignature: boolean } {
  const today = frDate(new Date().toISOString());

  if (id === "attestation") {
    const rows = ctx.sessions.length
      ? ctx.sessions
          .map(
            (s) =>
              `<tr><td>${esc(frDate(s.date))}</td><td>${esc(s.time ?? "—")}</td><td>${esc(
                s.service ?? "Séance",
              )}</td></tr>`,
          )
          .join("")
      : `<tr><td colspan="3" class="muted">Aucune séance enregistrée.</td></tr>`;
    return {
      title: "Attestation de suivi",
      withClientSignature: false,
      content: `<p>Je soussigné(e) <strong>${esc(ctx.therapist.name)}</strong> atteste que
        <strong>${esc(ctx.client.full_name)}</strong> a bénéficié des séances suivantes dans mon cabinet.</p>
        <table><thead><tr><th>Date</th><th>Heure</th><th>Prestation</th></tr></thead><tbody>${rows}</tbody></table>
        <p>Cette attestation est délivrée à la demande de la personne concernée et ne contient
        aucune information clinique, conformément au secret professionnel.</p>
        <p class="muted">Fait le ${esc(today)}.</p>`,
    };
  }

  if (id === "consentement") {
    return {
      title: "Information et consentement aux soins",
      withClientSignature: true,
      content: `<p>Dans le cadre de l'accompagnement proposé par <strong>${esc(ctx.therapist.name)}</strong>,
        les informations suivantes sont portées à la connaissance de
        <strong>${esc(ctx.client.full_name)}</strong> :</p>
        <ul>
          <li>Les séances relèvent d'un accompagnement de bien-être et ne remplacent en aucun cas
            un diagnostic, un traitement ou un suivi médical.</li>
          <li>Les données recueillies (coordonnées, historique des séances, notes) sont conservées
            de manière confidentielle, protégées par le secret professionnel et utilisées uniquement
            pour le suivi de l'accompagnement.</li>
          <li>La personne concernée peut à tout moment demander l'accès, la rectification ou la
            suppression de ses données, ainsi que retirer son consentement.</li>
          <li>Aucune donnée n'est transmise à un tiers sans accord écrit préalable, sauf obligation légale.</li>
        </ul>
        <p>Par sa signature, la personne concernée déclare avoir reçu ces informations, avoir pu
        poser ses questions et consentir librement à l'accompagnement proposé.</p>
        <p class="muted">Fait le ${esc(today)}.</p>`,
    };
  }

  const amount =
    typeof options.amount === "number" && options.amount > 0
      ? new Intl.NumberFormat("fr-CH", { style: "currency", currency: ctx.currency }).format(
          options.amount,
        )
      : "…………";
  return {
    title: "Reçu de séance",
    withClientSignature: false,
    content: `<p>Reçu de <strong>${esc(ctx.client.full_name)}</strong> la somme de
      <strong>${esc(amount)}</strong> pour une séance dispensée le
      <strong>${esc(frDate(options.sessionDate ?? new Date().toISOString()))}</strong>.</p>
      <p>Ce reçu ne constitue pas une facture au sens de la TVA et ne vaut pas justificatif
      de remboursement auprès d'une assurance.</p>
      <p class="muted">Fait le ${esc(today)}.</p>`,
  };
}

/** HTML complet, autonome et imprimable, du modèle demandé. */
export function renderTemplate(
  id: TemplateId,
  ctx: DocumentTemplateContext,
  options: { amount?: number | null; sessionDate?: string | null } = {},
): string {
  const { title, content, withClientSignature } = body(id, ctx, options);
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>${esc(title)} — ${esc(ctx.client.full_name)}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1c1c1e;
         background: #fff; margin: 0; padding: 32px; line-height: 1.55; font-size: 14px; }
  .sheet { max-width: 720px; margin: 0 auto; }
  header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #7c3aed;
           padding-bottom: 16px; margin-bottom: 24px; }
  .client { text-align: right; }
  h1 { font-size: 20px; margin: 0 0 16px; }
  .muted { color: #6b7280; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
  th { color: #6b7280; font-weight: 600; }
  ul { padding-left: 20px; }
  .signatures { display: flex; gap: 48px; margin-top: 48px; }
  .signatures > div { flex: 1; }
  .line { border-bottom: 1px solid #9ca3af; height: 40px; margin-bottom: 6px; }
  @media print { body { padding: 0; } @page { margin: 18mm; } }
</style></head>
<body><div class="sheet">
${header(ctx)}
<h1>${esc(title)}</h1>
${content}
${signature(ctx, withClientSignature)}
</div></body></html>`;
}
