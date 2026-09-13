/**
 * Libellés honnêtes des états d'une certification, et textes de responsabilité.
 *
 * Trois états seulement, jamais davantage :
 * 1. « Déclaré par le thérapeute » — aucune intervention de Holiswiss.
 * 2. « Justificatif examiné par Holiswiss » — un administrateur a regardé le
 *    document. C'est aussi l'état des validations historiques : elles ne
 *    deviennent JAMAIS une confirmation de registre rétroactive.
 * 3. « Inscription confirmée auprès du registre le [date] » — uniquement après
 *    un contrôle réel, documenté par un administrateur (résultat + source + date).
 *
 * Aucun de ces états n'est attribué automatiquement.
 */

export type CertificationTrustState = "declared" | "document_reviewed" | "registry_confirmed";

/** Résultat d'un contrôle manuel effectué par un administrateur. */
export type RegistryCheckResult = "confirmed" | "not_found" | "inconclusive";

type Lang = "fr" | "de" | "it" | "en";

const LANGS: Record<string, Lang> = { fr: "fr", de: "de", it: "it", en: "en" };

export function certLang(lang?: string | null): Lang {
  return LANGS[(lang ?? "fr").slice(0, 2).toLowerCase()] ?? "fr";
}

/** Version du texte de déclaration sur l'honneur, enregistrée avec l'acceptation. */
export const CERTIFICATION_DECLARATION_VERSION = "2026-09-13";

/** Déclaration sur l'honneur — case jamais précochée, exigée à chaque soumission. */
export const CERTIFICATION_DECLARATION_TEXT: Record<Lang, string> = {
  fr: "Je certifie l’exactitude des informations et l’authenticité des justificatifs transmis. Je m’engage à signaler toute expiration, suspension ou révocation de mes certifications.",
  de: "Ich bestätige die Richtigkeit der Angaben und die Echtheit der eingereichten Nachweise. Ich verpflichte mich, jeden Ablauf, jede Sperrung oder jeden Widerruf meiner Zertifizierungen zu melden.",
  it: "Certifico l’esattezza delle informazioni e l’autenticità dei documenti trasmessi. Mi impegno a segnalare qualsiasi scadenza, sospensione o revoca delle mie certificazioni.",
  en: "I certify that the information is accurate and that the supporting documents are genuine. I undertake to report any expiry, suspension or revocation of my certifications.",
};

/** Texte de responsabilité affiché à côté des certifications (public et espace thérapeute). */
export const CERTIFICATION_RESPONSIBILITY_NOTICE: Record<Lang, string> = {
  fr: "Les informations relatives aux qualifications et certifications sont fournies sous la responsabilité du thérapeute, qui s’engage à transmettre des informations exactes et à jour. Les contrôles réalisés par Holiswiss ne constituent pas une certification délivrée par l’organisme concerné et ne garantissent pas la validité actuelle d’une inscription dans son registre.",
  de: "Die Angaben zu Qualifikationen und Zertifizierungen werden unter der Verantwortung der Therapeutin oder des Therapeuten gemacht, die oder der sich verpflichtet, richtige und aktuelle Informationen zu übermitteln. Die von Holiswiss durchgeführten Kontrollen stellen keine von der betreffenden Organisation ausgestellte Zertifizierung dar und garantieren nicht die aktuelle Gültigkeit eines Registereintrags.",
  it: "Le informazioni relative alle qualifiche e alle certificazioni sono fornite sotto la responsabilità del terapeuta, che si impegna a trasmettere informazioni esatte e aggiornate. I controlli effettuati da Holiswiss non costituiscono una certificazione rilasciata dall’organismo interessato e non garantiscono la validità attuale di un’iscrizione nel suo registro.",
  en: "Information about qualifications and certifications is provided under the therapist's responsibility, who undertakes to supply accurate and up-to-date information. Checks carried out by Holiswiss do not constitute a certification issued by the organisation concerned and do not guarantee the current validity of a registry entry.",
};

const STATE_LABELS: Record<Lang, Record<CertificationTrustState, string>> = {
  fr: {
    declared: "Déclaré par le thérapeute",
    document_reviewed: "Justificatif examiné par Holiswiss",
    registry_confirmed: "Inscription confirmée auprès du registre le",
  },
  de: {
    declared: "Von der Therapeutin/dem Therapeuten angegeben",
    document_reviewed: "Nachweis von Holiswiss geprüft",
    registry_confirmed: "Registereintrag bestätigt am",
  },
  it: {
    declared: "Dichiarato dal terapeuta",
    document_reviewed: "Documento esaminato da Holiswiss",
    registry_confirmed: "Iscrizione confermata presso il registro il",
  },
  en: {
    declared: "Declared by the therapist",
    document_reviewed: "Document reviewed by Holiswiss",
    registry_confirmed: "Registry entry confirmed on",
  },
};

const DATE_LOCALE: Record<Lang, string> = { fr: "fr-CH", de: "de-CH", it: "it-CH", en: "en-GB" };

export function formatCertDate(iso: string | null | undefined, lang?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(DATE_LOCALE[certLang(lang)], { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * État d'une certification, déduit uniquement de ce qui existe réellement en base.
 * Une validation historique (`verified` sans contrôle de registre documenté)
 * reste « Justificatif examiné par Holiswiss » : elle n'est jamais promue.
 */
export function certificationTrustState(row: {
  verification_status?: string | null;
  registry_check_result?: string | null;
  registry_checked_at?: string | null;
}): CertificationTrustState {
  if (
    row.verification_status === "verified" &&
    row.registry_check_result === "confirmed" &&
    !!row.registry_checked_at
  ) {
    return "registry_confirmed";
  }
  if (row.verification_status === "verified") return "document_reviewed";
  return "declared";
}

/** Libellé exact de l'état, date incluse pour la confirmation de registre. */
export function certificationStateLabel(
  state: CertificationTrustState,
  opts?: { registryCheckedAt?: string | null; lang?: string | null },
): string {
  const lang = certLang(opts?.lang);
  const base = STATE_LABELS[lang][state];
  if (state !== "registry_confirmed") return base;
  const date = formatCertDate(opts?.registryCheckedAt, lang);
  return date ? `${base} ${date}` : STATE_LABELS[lang].document_reviewed;
}

export const REGISTRY_RESULT_LABELS: Record<RegistryCheckResult, string> = {
  confirmed: "Inscription confirmée auprès du registre",
  not_found: "Inscription introuvable dans le registre",
  inconclusive: "Contrôle non concluant",
};

/** Rappel destiné à l'administrateur : une absence ne prouve pas une fausse déclaration. */
export const REGISTRY_ABSENCE_CAVEAT =
  "Une absence dans l'annuaire consulté ne prouve pas une fausse déclaration : l'annuaire peut être incomplet, à jour partiellement ou filtrer certaines inscriptions.";
