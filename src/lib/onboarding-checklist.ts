// Logique pure de la prise en main thérapeute (checklist + reprise du guide).
// Aucune dépendance serveur : testable et partagée entre serveur et interface.

export const SETUP_STEPS = [
  "profile",
  "services",
  "currency",
  "availability",
  "publicPage",
  "booking",
  "billing",
] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/** Événements explicites enregistrés seulement après une action du thérapeute. */
export const ONBOARDING_EVENTS = ["currency_confirmed", "public_page_viewed", "booking_checked"] as const;
export type OnboardingEvent = (typeof ONBOARDING_EVENTS)[number];

export const TOUR_LENGTH = 8;

export interface SetupSignals {
  bio?: string | null;
  shortBio?: string | null;
  specialties?: unknown;
  address?: string | null;
  activeServicesWithPrice: number;
  packages: number;
  practiceCurrencyConsents: number;
  activeAvailabilities: number;
  iban?: string | null;
  billingStreet?: string | null;
  /** Devise du cabinet enregistrée dans les paramètres de facturation (null si aucun paramétrage). */
  practiceCurrency?: string | null;
  /** Statut de la fiche (`active` = publiée dans l'annuaire). */
  status?: string | null;
  slug?: string | null;
  /** Nombre de réservations réelles, tous statuts. */
  appointments?: number;
}

const VALID_CURRENCIES = ["CHF", "EUR"];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type SetupChecklist = Record<SetupStep, boolean>;

const filled = (s: string | null | undefined, min: number) => !!s && s.trim().length >= min;

export function computeSetupChecklist(
  s: SetupSignals,
  events: Partial<Record<string, unknown>> | null | undefined,
): SetupChecklist {
  const ev = events ?? {};
  const has = (k: OnboardingEvent) => typeof ev[k] === "string" && (ev[k] as string).length > 0;
  return {
    profile:
      (filled(s.bio, 21) || filled(s.shortBio, 21)) &&
      Array.isArray(s.specialties) &&
      s.specialties.length > 0 &&
      filled(s.address, 4),
    services: s.activeServicesWithPrice > 0 || s.packages > 0,
    currency:
      VALID_CURRENCIES.includes(String(s.practiceCurrency ?? "").toUpperCase()) ||
      s.practiceCurrencyConsents > 0 ||
      has("currency_confirmed"),
    availability: s.activeAvailabilities > 0,
    publicPage: (s.status === "active" && !!s.slug && SLUG_RE.test(s.slug)) || has("public_page_viewed"),
    booking: (s.appointments ?? 0) > 0 || has("booking_checked"),
    billing: filled(s.iban, 6) && filled(s.billingStreet, 2),
  };
}

export function countDone(c: SetupChecklist): number {
  return SETUP_STEPS.filter((k) => c[k]).length;
}

/** Étape du guide à rouvrir : la dernière atteinte, bornée, sauf si le guide est terminé. */
export function resumeTourStep(p: { tour_step?: number | null; tour_completed_at?: string | null } | null): number {
  if (!p || p.tour_completed_at) return 0;
  const n = Number(p.tour_step ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(TOUR_LENGTH - 1, Math.floor(n));
}

/** Badge « Nouveau » tant que le guide n'a jamais été lancé. */
export function showNewBadge(p: { tour_started_at?: string | null } | null): boolean {
  return !p?.tour_started_at;
}

/** Ouverture automatique : seulement si le guide n'a jamais été lancé ni terminé. */
export function shouldAutoOpenTour(
  onboardingComplete: boolean,
  p: { tour_started_at?: string | null; tour_completed_at?: string | null } | null,
): boolean {
  return !onboardingComplete && !p?.tour_started_at && !p?.tour_completed_at;
}

/** La carte reste visible tant que tout n'est pas fait, ou si elle a été rouverte. */
export function shouldShowChecklistCard(c: SetupChecklist, reopened: boolean): boolean {
  return countDone(c) < SETUP_STEPS.length || reopened;
}
