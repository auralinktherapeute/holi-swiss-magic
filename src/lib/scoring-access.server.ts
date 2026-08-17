/**
 * Éligibilité au scoring avancé — source unique de vérité.
 * Le calcul d'audit lui-même reste dans `showcase-audit.ts` : ce module ne
 * décide QUE du niveau d'accès (base / avancé / administrateur).
 */

export type ScoringSource =
  | "elite_pro"
  | "early_adopter"
  | "admin_manual"
  | "commercial_offer"
  | "offer_accepted";

export type ScoringAccess = {
  level: "basic" | "advanced";
  advanced: boolean;
  source: ScoringSource | null;
  /** Toutes les raisons qui ouvrent l'accès (peut en contenir plusieurs). */
  sources: ScoringSource[];
  since: string | null;
  earlyRank: number | null;
  earlySlots: number;
  /** Place fondateur immuable (1..70) si attribuée. */
  seatNumber: number | null;
  seatStatus: "active" | "revoked" | null;
  seatGrantedAt: string | null;
  seatSource: string | null;
  seatsUsed: number;
  seatsRemaining: number;
  /** Réglage admin : afficher ou non le numéro de place au thérapeute. */
  showSeatNumber: boolean;
};

export const EARLY_SLOTS = 70;

export const SOURCE_LABEL: Record<ScoringSource, string> = {
  elite_pro: "Formule Elite Pro",
  early_adopter: `Parmi les ${EARLY_SLOTS} premiers inscrits`,
  admin_manual: "Activation manuelle par l'administration",
  commercial_offer: "Offre commerciale accordée",
  offer_accepted: "Offre commerciale acceptée",
};

/** `sb` doit être le client service-role : la fonction SQL est réservée au serveur. */
export async function resolveScoringAccess(sb: any, therapistId: string): Promise<ScoringAccess> {
  const { data, error } = await sb.rpc("advanced_scoring_eligibility", { _therapist_id: therapistId });
  if (error) throw new Error(error.message);
  const e = (data ?? {}) as {
    early_rank?: number | null;
    is_early?: boolean;
    is_elite_pro?: boolean;
    grant_source?: string | null;
    granted_at?: string | null;
    seat_status?: "active" | "revoked" | null;
    seat_granted_at?: string | null;
    seat_source?: string | null;
    seats_used?: number | null;
  };

  const sources: ScoringSource[] = [];
  if (e.is_elite_pro) sources.push("elite_pro");
  if (e.is_early) sources.push("early_adopter");
  if (e.grant_source) sources.push(e.grant_source as ScoringSource);

  const seatsUsed = e.seats_used ?? 0;
  const { data: setting } = await sb
    .from("app_settings")
    .select("value")
    .eq("key", "founder_seat_number_display")
    .maybeSingle();
  const showSeatNumber = setting?.value === true || setting?.value === "true" || setting == null;

  return {
    level: sources.length > 0 ? "advanced" : "basic",
    advanced: sources.length > 0,
    source: sources[0] ?? null,
    sources,
    since: e.granted_at ?? null,
    earlyRank: e.early_rank ?? null,
    earlySlots: EARLY_SLOTS,
    seatNumber: e.early_rank ?? null,
    seatStatus: e.seat_status ?? null,
    seatGrantedAt: e.seat_granted_at ?? null,
    seatSource: e.seat_source ?? null,
    seatsUsed,
    seatsRemaining: Math.max(0, EARLY_SLOTS - seatsUsed),
    showSeatNumber,
  };
}