import type { QueryClient } from "@tanstack/react-query";

/**
 * Clés de cache dépendant des données de scoring.
 * Toute mutation d'un champ utilisé par l'audit doit passer par
 * `refreshShowcaseAfterSave` pour éviter d'afficher un ancien résultat.
 */
export const SHOWCASE_QUERY_KEYS = [
  ["my-showcase-report"],
  ["my-showcase-audit"],
] as const;

export const PROFILE_QUERY_KEYS = [
  ["my-therapist-profile"],
  ["my-specialty-ids"],
  ["onboarding-state"],
] as const;

/**
 * Après confirmation de sauvegarde serveur : invalide le profil et l'audit,
 * puis relance réellement l'audit depuis les données persistées (refetch) et
 * renvoie l'horodatage de la nouvelle analyse.
 */
export async function refreshShowcaseAfterSave(qc: QueryClient): Promise<string | null> {
  await Promise.all(PROFILE_QUERY_KEYS.map((key) => qc.invalidateQueries({ queryKey: key })));
  await Promise.all(SHOWCASE_QUERY_KEYS.map((key) => qc.invalidateQueries({ queryKey: key })));
  // refetch = nouvel appel serveur : score, catégories, actions prioritaires
  // et éléments manquants sont recalculés à partir de la base.
  await Promise.all(SHOWCASE_QUERY_KEYS.map((key) => qc.refetchQueries({ queryKey: key, type: "active" })));
  const report = qc.getQueryData<{ analyzedAt?: string | null }>(["my-showcase-report"]);
  return report?.analyzedAt ?? new Date().toISOString();
}

export function formatAnalysisDate(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("fr-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
