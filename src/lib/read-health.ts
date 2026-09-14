/**
 * Distinguer une PANNE technique d'un résultat réellement vide.
 *
 * Jusqu'ici, les loaders publics (annuaire, canton, ville, famille, catégorie,
 * fiche) attrapaient silencieusement toute erreur et renvoyaient `[]` / `null` :
 * une panne de lecture était servie en HTTP 200, avec un ItemList vide et
 * parfois un `noindex` — un vrai risque de désindexation de pages qui ont du
 * contenu.
 *
 * Ici, une panne est signalée explicitement :
 *  - le loader renvoie `{ unavailable: true }` (aucun faux SEO vide) ;
 *  - côté SSR, un en-tête marqueur est posé sur la réponse, que `src/server.ts`
 *    transforme en véritable HTTP 503 + `no-store` + `Retry-After`.
 *
 * Le statut ne peut pas être posé directement depuis un loader : TanStack Start
 * écrase le statut du document après rendu (mesuré : `setResponseStatus(503)`
 * dans un loader ou une server function laisse un 200), alors que les en-têtes,
 * eux, sont conservés. D'où le marqueur relayé par le wrapper serveur.
 *
 * Un résultat réellement vide garde exactement le comportement d'avant.
 */

import { createIsomorphicFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

export const UNAVAILABLE_MARKER_HEADER = "x-holiswiss-read-unavailable";
export const UNAVAILABLE_RETRY_AFTER_SECONDS = 120;

/**
 * Pose le marqueur SSR. `createIsomorphicFn` garantit que l'implémentation
 * serveur (et son import `@tanstack/react-start/server`) n'entre pas dans le
 * bundle navigateur ; côté client (navigation SPA) l'appel est neutre.
 */
export const markEssentialReadUnavailable = createIsomorphicFn()
  .client(() => {})
  .server(() => {
    try {
      setResponseHeader(UNAVAILABLE_MARKER_HEADER, "1");
      setResponseHeader("Cache-Control", "no-store");
      setResponseHeader("Retry-After", String(UNAVAILABLE_RETRY_AFTER_SECONDS));
    } catch {
      // Hors contexte de requête : rien à signaler.
    }
  });

export type EssentialRead<T> = { ok: true; data: T } | { ok: false };

/**
 * Exécute une lecture ESSENTIELLE (celle sans laquelle la page n'a pas de sens).
 * En cas d'échec technique : marqueur SSR + `{ ok: false }`, jamais un faux vide.
 */
export async function loadEssential<T>(run: () => Promise<T>): Promise<EssentialRead<T>> {
  try {
    return { ok: true, data: await run() };
  } catch {
    markEssentialReadUnavailable();
    return { ok: false };
  }
}
