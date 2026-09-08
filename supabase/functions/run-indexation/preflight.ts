/**
 * Pré-contrôle d'indexabilité — la garde d'entrée de la file IndexNow.
 *
 * POURQUOI CE FICHIER EXISTE
 *   Relevé du 08/09/2026 sur les 280 URLs déjà poussées : **77 n'auraient
 *   jamais dû l'être** — 14 en 404, 59 en `noindex`, 4 qui redirigent, 4 dont
 *   la canonical désigne une autre page. Soit 27 % de la file.
 *
 *   La sélection ne regardait que l'état du SUIVI (`archived_at`, cooldown,
 *   priorité). Elle ne regardait jamais ce que l'URL RÉPOND. Or le suivi peut
 *   être en retard sur la réalité de plusieurs jours : un article dont le slug
 *   allemand vient d'être traduit redirige, une page passée sous le seuil
 *   d'indexabilité émet un `noindex`, une fiche dépubliée rend 404 — et rien
 *   n'en informait la file.
 *
 *   Notifier IndexNow d'une URL en noindex ou en 404 n'est pas seulement
 *   inutile : c'est se signaler à Bing comme une source peu fiable.
 *
 * LE CAS DES 59 `noindex` — une régression introduite la veille
 *   Les seuils de `seo-thresholds.ts` ont été relevés le 07/09 : 152 pages
 *   spécialité sont passées en `noindex,follow` et ont quitté le sitemap. Le
 *   délai de grâce de 14 jours (`OUT_OF_SITEMAP_GRACE_DAYS`) les a maintenues
 *   dans la file active — et donc poussées. Ce délai existe pour absorber un
 *   sitemap TRANSITOIREMENT incomplet ; il n'a aucun sens face à un `noindex`
 *   explicite, qui est une décision, pas un accident. D'où l'archivage
 *   immédiat, sans grâce, dès qu'un `noindex` est constaté.
 *
 * CE QUE CE MODULE NE FAIT PAS
 *   Il ne juge pas la QUALITÉ d'une page (contenu mince, doublon, orpheline) :
 *   c'est le rôle de `scripts/seo/audit-indexability.mjs`, qui tourne à froid
 *   sur tout le site. Ici on ne tranche que l'indexabilité TECHNIQUE, celle
 *   qui se lit dans la réponse HTTP.
 */

const SITE = "https://holiswiss.ch";
const UA = "holiswiss-indexation-agent/3.0 (+https://holiswiss.ch)";

export type Preflight = {
  url: string;
  /** Poussable à IndexNow ? */
  indexable: boolean;
  /** Motif d'exclusion, aussi précis que possible. Vide si indexable. */
  reason: string;
  /** Raison d'archivage à écrire en base, ou null si l'URL reste en file. */
  archiveReason: string | null;
  httpStatus: number | null;
  finalUrl: string | null;
  metaRobots: string | null;
  xRobotsTag: string | null;
  canonical: string | null;
};

/** Compare deux URLs en ignorant le slash final. */
function sameUrl(a: string, b: string): boolean {
  return a.replace(/\/+$/, "") === b.replace(/\/+$/, "");
}

function ok(url: string, extra: Partial<Preflight>): Preflight {
  return {
    url,
    indexable: true,
    reason: "",
    archiveReason: null,
    httpStatus: null,
    finalUrl: null,
    metaRobots: null,
    xRobotsTag: null,
    canonical: null,
    ...extra,
  };
}

/**
 * Contrôle UNE URL. Ne lève jamais : une erreur réseau rend l'URL non
 * poussable pour ce run, mais ne l'archive pas (`archiveReason: null`) — une
 * coupure passagère ne doit pas sortir une page du périmètre.
 */
export async function preflight(url: string): Promise<Preflight> {
  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    return {
      ...ok(url, {}),
      indexable: false,
      reason: `injoignable : ${(e as Error).message}`,
      archiveReason: null, // transitoire : on retente au prochain run
    };
  }

  const finalUrl = resp.url || url;
  const xRobotsTag = resp.headers.get("x-robots-tag");

  if (resp.status === 404 || resp.status === 410) {
    return {
      ...ok(url, { httpStatus: resp.status, finalUrl, xRobotsTag }),
      indexable: false,
      reason: `HTTP ${resp.status}`,
      archiveReason: "http_absent",
    };
  }
  if (resp.status !== 200) {
    return {
      ...ok(url, { httpStatus: resp.status, finalUrl, xRobotsTag }),
      indexable: false,
      reason: `HTTP ${resp.status}`,
      // 5xx : très probablement passager, on ne condamne pas l'URL.
      archiveReason: resp.status >= 500 ? null : "http_erreur",
    };
  }

  // `redirect: "follow"` a déjà suivi la chaîne : une URL finale différente
  // signifie que l'URL déclarée n'est pas la bonne adresse.
  if (!sameUrl(finalUrl, url)) {
    return {
      ...ok(url, { httpStatus: 200, finalUrl, xRobotsTag }),
      indexable: false,
      reason: `redirige vers ${finalUrl}`,
      archiveReason: "redirection",
    };
  }

  if (xRobotsTag && /noindex/i.test(xRobotsTag)) {
    return {
      ...ok(url, { httpStatus: 200, finalUrl, xRobotsTag }),
      indexable: false,
      reason: `X-Robots-Tag: ${xRobotsTag}`,
      archiveReason: "noindex",
    };
  }

  const html = await resp.text();
  const metaRobots =
    html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']robots["']/i)?.[1] ??
    null;
  const canonical =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i)?.[1] ?? null;

  if (metaRobots && /noindex/i.test(metaRobots)) {
    return {
      ...ok(url, { httpStatus: 200, finalUrl, xRobotsTag, metaRobots, canonical }),
      indexable: false,
      reason: `meta robots: ${metaRobots}`,
      // Archivage IMMÉDIAT, sans délai de grâce : un noindex est une décision,
      // pas un sitemap momentanément incomplet.
      archiveReason: "noindex",
    };
  }

  if (canonical && !sameUrl(canonical, url)) {
    return {
      ...ok(url, { httpStatus: 200, finalUrl, xRobotsTag, metaRobots, canonical }),
      indexable: false,
      reason: `canonical vers ${canonical}`,
      archiveReason: "canonical_autre",
    };
  }

  return ok(url, { httpStatus: 200, finalUrl, xRobotsTag, metaRobots, canonical });
}

/** Contrôle un lot, par vagues parallèles bornées. */
export async function preflightAll(urls: string[], concurrency = 10): Promise<Preflight[]> {
  const out: Preflight[] = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    out.push(...(await Promise.all(urls.slice(i, i + concurrency).map(preflight))));
  }
  return out;
}
