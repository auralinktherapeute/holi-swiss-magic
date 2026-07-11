// Score de complétion du profil thérapeute — fonctions pures.
// Calculé côté client sur les colonnes existantes (aucune migration DB).

export interface CompletionInput {
  photo_url?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  short_bio?: string | null;
  bio?: string | null;
  languages?: string[] | null;
  specialties?: string[] | null;
  price_min?: number | null;
  city?: string | null;
  canton?: string | null;
  phone?: string | null;
  accreditations?: unknown[] | null;
  website?: string | null;
  google_reviews_url?: string | null;
}

export interface CompletionItem {
  key: string;
  label: string;
  ok: boolean;
  /** Poids en points (total = 100) */
  weight: number;
}

export interface CompletionResult {
  percent: number;
  items: CompletionItem[];
  missing: CompletionItem[];
}

const has = (s?: string | null, min = 1) => !!s && s.trim().length >= min;

export function computeProfileCompletion(p: CompletionInput): CompletionResult {
  const items: CompletionItem[] = [
    { key: "photo", label: "Ajouter une photo professionnelle", ok: has(p.photo_url), weight: 15 },
    { key: "short_bio", label: "Rédiger votre présentation courte", ok: has(p.short_bio, 40), weight: 10 },
    { key: "bio", label: "Détailler votre parcours (200 caractères min.)", ok: has(p.bio, 200), weight: 15 },
    { key: "specialties", label: "Sélectionner vos spécialités", ok: (p.specialties ?? []).length >= 1, weight: 15 },
    { key: "languages", label: "Indiquer vos langues parlées", ok: (p.languages ?? []).length >= 1, weight: 10 },
    { key: "location", label: "Renseigner ville et canton", ok: has(p.city) && has(p.canton), weight: 10 },
    { key: "price", label: "Indiquer vos tarifs", ok: p.price_min != null && p.price_min > 0, weight: 10 },
    { key: "phone", label: "Ajouter un téléphone de contact", ok: has(p.phone, 6), weight: 5 },
    { key: "accreditations", label: "Ajouter vos certifications (ASCA, RME…)", ok: (p.accreditations ?? []).length >= 1, weight: 5 },
    { key: "links", label: "Lier votre site web ou vos avis Google", ok: has(p.website) || has(p.google_reviews_url), weight: 5 },
  ];

  const percent = items.reduce((sum, item) => sum + (item.ok ? item.weight : 0), 0);
  return { percent, items, missing: items.filter((i) => !i.ok) };
}
