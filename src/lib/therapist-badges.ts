/**
 * Source de vérité des badges de confiance de la fiche thérapeute.
 *
 * Régression corrigée le 17/08/2026 : le code testait `therapists.is_premium`,
 * une colonne qui n'existe PAS en production (elle vient du schéma du bac à
 * sable). Le badge « Pro » ne s'affichait donc jamais. La colonne réelle est
 * `subscription_plan`.
 */

export type CertificationStatus = "declared" | "verified" | "rejected" | "expired";

export interface CertificationRow {
  id?: string;
  name: string | null;
  issuer?: string | null;
  year?: number | null;
  verification_status?: CertificationStatus | null;
  verified_at?: string | null;
  expires_at?: string | null;
  source_label?: string | null;
}

export interface AccreditationEntry {
  org: string;
  number?: string;
}

/** Formations dispensées — entièrement déclaratif, jamais vérifié. */
export interface TrainerInput {
  isTrainer?: boolean | null;
  /** Matières enseignées. Sans elles, aucun badge n'est produit. */
  subjects?: string | null;
  institution?: string | null;
  since?: number | null;
}

export type BadgeKind = "pro" | "verified" | "certification" | "accreditation" | "trainer";

export interface TrustBadge {
  key: string;
  kind: BadgeKind;
  label: string;
  /** Description accessible, lue par les lecteurs d'écran et affichée en infobulle. */
  description: string;
  /** true = justificatif validé par l'administration ; false = simple déclaration. */
  verified: boolean;
  verifiedAt?: string | null;
  source?: string | null;
}

/** Le plan « Pro » couvre tout abonnement payant (pro, elite, premium…). */
export function isProPlan(plan?: string | null): boolean {
  const p = (plan ?? "").trim().toLowerCase();
  return p.length > 0 && p !== "free" && p !== "basic" && p !== "none";
}

type BadgeDict = {
  pro: string; proDesc: string; verified: string; verifiedDesc: string;
  declaredSuffix: string; verifiedSuffix: string; certOf: (n: string) => string;
  trainer: string; trainerSince: (y: number) => string; trainerTeaches: (s: string) => string;
};

const L: Record<string, BadgeDict> = {
  fr: {
    pro: "Pro", proDesc: "Praticien abonné à une offre Holiswiss Pro.",
    verified: "Profil vérifié", verifiedDesc: "Identité et informations professionnelles contrôlées par l'équipe Holiswiss.",
    declaredSuffix: "Déclaré par le praticien, non vérifié par Holiswiss.",
    verifiedSuffix: "Justificatif validé par Holiswiss",
    certOf: (n: string) => `Certification ${n}.`,
    trainer: "Formateur",
    trainerSince: (y: number) => `depuis ${y}`,
    trainerTeaches: (s: string) => `Dispense des formations : ${s}.`,
  },
  de: {
    pro: "Pro", proDesc: "Praktiker mit einem Holiswiss-Pro-Abonnement.",
    verified: "Geprüftes Profil", verifiedDesc: "Identität und Berufsangaben durch das Holiswiss-Team geprüft.",
    declaredSuffix: "Vom Praktiker angegeben, nicht von Holiswiss geprüft.",
    verifiedSuffix: "Nachweis von Holiswiss bestätigt",
    certOf: (n: string) => `Zertifizierung ${n}.`,
    trainer: "Ausbildner",
    trainerSince: (y: number) => `seit ${y}`,
    trainerTeaches: (s: string) => `Bietet Ausbildungen an: ${s}.`,
  },
  it: {
    pro: "Pro", proDesc: "Professionista con abbonamento Holiswiss Pro.",
    verified: "Profilo verificato", verifiedDesc: "Identità e informazioni professionali controllate dal team Holiswiss.",
    declaredSuffix: "Dichiarato dal professionista, non verificato da Holiswiss.",
    verifiedSuffix: "Documento convalidato da Holiswiss",
    certOf: (n: string) => `Certificazione ${n}.`,
    trainer: "Formatore",
    trainerSince: (y: number) => `dal ${y}`,
    trainerTeaches: (s: string) => `Tiene formazioni: ${s}.`,
  },
  en: {
    pro: "Pro", proDesc: "Practitioner on a Holiswiss Pro plan.",
    verified: "Verified profile", verifiedDesc: "Identity and professional details checked by the Holiswiss team.",
    declaredSuffix: "Self-declared by the practitioner, not verified by Holiswiss.",
    verifiedSuffix: "Document validated by Holiswiss",
    certOf: (n: string) => `${n} certification.`,
    trainer: "Trainer",
    trainerSince: (y: number) => `since ${y}`,
    trainerTeaches: (s: string) => `Teaches: ${s}.`,
  },
};

const ORG_NOTES: Record<string, string> = {
  ASCA: "Fondation suisse pour les médecines complémentaires — reconnue par la plupart des assurances complémentaires.",
  RME: "Registre de Médecine Empirique — label de qualité reconnu par les assurances complémentaires en Suisse.",
  EMR: "ErfahrungsMedizinisches Register — Qualitätslabel, von Zusatzversicherungen anerkannt.",
};

function dict(lang?: string) {
  return L[(lang ?? "fr").slice(0, 2)] ?? L.fr;
}

/**
 * Construit la liste des badges. Aucune donnée inventée : un badge « vérifié »
 * n'est produit que si l'état de vérification existe réellement en base.
 */
export function buildTrustBadges(input: {
  lang?: string;
  verified?: boolean | null;
  subscriptionPlan?: string | null;
  certifications?: CertificationRow[] | null;
  accreditations?: AccreditationEntry[] | null;
  trainer?: TrainerInput | null;
}): TrustBadge[] {
  const d = dict(input.lang);
  const badges: TrustBadge[] = [];

  if (isProPlan(input.subscriptionPlan)) {
    badges.push({ key: "pro", kind: "pro", label: d.pro, description: d.proDesc, verified: true });
  }
  if (input.verified) {
    badges.push({ key: "verified", kind: "verified", label: d.verified, description: d.verifiedDesc, verified: true });
  }

  const now = Date.now();
  for (const c of input.certifications ?? []) {
    const name = (c.name ?? "").trim();
    if (!name) continue;
    const expired = c.expires_at ? Date.parse(c.expires_at) < now : false;
    const isVerified = c.verification_status === "verified" && !expired;
    const parts = [d.certOf(name)];
    if (c.issuer) parts.push(c.issuer + (c.year ? ` (${c.year})` : ""));
    parts.push(isVerified ? `${d.verifiedSuffix}${c.source_label ? ` — ${c.source_label}` : ""}.` : d.declaredSuffix);
    badges.push({
      key: `cert-${c.id ?? name}`,
      kind: "certification",
      label: name,
      description: parts.join(" "),
      verified: isVerified,
      verifiedAt: isVerified ? c.verified_at ?? null : null,
      source: c.source_label ?? c.issuer ?? null,
    });
  }

  for (const a of input.accreditations ?? []) {
    const org = (a?.org ?? "").trim();
    if (!org) continue;
    const note = ORG_NOTES[org.toUpperCase()] ?? d.certOf(org);
    badges.push({
      key: `acc-${org}`,
      kind: "accreditation",
      // Déclaratif : jamais présenté comme vérifié.
      label: a.number ? `${org} · ${a.number}` : org,
      description: `${note} ${d.declaredSuffix}`,
      verified: false,
    });
  }

  // Formateur — placé après les badges vérifiés, parmi les déclaratifs.
  //
  // Cocher ne suffit pas : sans matières renseignées, le badge n'apparaît pas.
  // Un badge « Formateur » seul n'apprendrait rien à un visiteur, et Holiswiss
  // ne contrôlant pas qui forme qui, il ne peut jamais être « vérifié ».
  //
  // Le libellé ne s'accorde pas au genre : rien en base ne le renseigne, et le
  // déduire d'un prénom se tromperait sur de vraies personnes. Un praticien qui
  // veut « Formatrice » l'écrira dans ses matières.
  const tr = input.trainer;
  const subjects = (tr?.subjects ?? "").trim();
  if (tr?.isTrainer && subjects) {
    const since = typeof tr.since === "number" && Number.isFinite(tr.since) ? tr.since : null;
    const institution = (tr.institution ?? "").trim();
    const parts = [d.trainerTeaches(subjects)];
    if (institution) parts.push(`${institution}.`);
    parts.push(d.declaredSuffix);
    badges.push({
      key: "trainer",
      kind: "trainer",
      label: since ? `${d.trainer} · ${d.trainerSince(since)}` : d.trainer,
      description: parts.join(" "),
      verified: false,
    });
  }

  return badges;
}
