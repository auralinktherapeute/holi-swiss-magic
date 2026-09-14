/**
 * Instrumentation serveur des lectures publiques.
 *
 * Règle stricte : AUCUNE donnée personnelle, aucun slug, identifiant, URL,
 * paramètre, jeton, ni objet d'erreur brut de la base. On journalise seulement
 * un nom d'opération constant, une durée, un succès/échec et une catégorie
 * d'erreur courte (code PostgREST ou nom de classe d'erreur).
 *
 * Fichier `*.server.ts` : exclu des bundles navigateur. À importer
 * dynamiquement DANS un handler, jamais au niveau module d'un `*.functions.ts`.
 */

/** Catégorie d'erreur non identifiante : code PostgREST court ou nom de classe. */
export function errorKind(error: unknown): string {
  if (error && typeof error === "object") {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && /^[A-Za-z0-9_]{1,12}$/.test(code)) return code;
    const name = (error as { name?: unknown }).name;
    if (typeof name === "string" && /^[A-Za-z]{1,40}$/.test(name)) return name;
  }
  return "unknown";
}

/** Lecture essentielle : mesurée, l'échec est journalisé puis propagé. */
export async function timedRead<T>(operation: string, run: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await run();
    console.info(`[read] op=${operation} ms=${Date.now() - startedAt} ok=1`);
    return result;
  } catch (error) {
    console.warn(
      `[read] op=${operation} ms=${Date.now() - startedAt} ok=0 kind=${errorKind(error)}`,
    );
    throw error;
  }
}

/**
 * Lecture SECONDAIRE tolérée (avis, diplômes, certifications d'organismes,
 * articles, événements, FAQ) : l'échec est journalisé et dégrade la page sans
 * la rendre indisponible. Aucun badge, aucune confirmation n'est inventé —
 * la valeur de repli est simplement vide.
 */
export async function timedOptionalRead<T>(
  operation: string,
  run: () => Promise<T>,
  fallback: T,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await run();
    console.info(`[read] op=${operation} ms=${Date.now() - startedAt} ok=1`);
    return result;
  } catch (error) {
    console.warn(
      `[read] op=${operation} ms=${Date.now() - startedAt} ok=0 degraded=1 kind=${errorKind(error)}`,
    );
    return fallback;
  }
}
