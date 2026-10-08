/**
 * Liens internes entrants — fonctions pures utilisées par `scripts/seo-check.mjs`.
 * Une URL indexable sans lien entrant = échec ; un article indexable avec
 * moins de trois liens entrants = avertissement. Les liens d'une page vers
 * elle-même ne comptent pas.
 */

export const ARTICLE_MIN_INBOUND = 3;

/** Normalise une URL interne (absolue ou relative) ; `null` si externe. */
export function normalizeInternal(href, base) {
  if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) return null;
  let u;
  try {
    u = new URL(href, base + "/");
  } catch {
    return null;
  }
  const b = new URL(base);
  const host = (h) => h.replace(/^www\./, "");
  if (host(u.hostname) !== host(b.hostname)) return null;
  const path = u.pathname.replace(/\/+$/, "") || "/";
  return `${b.origin}${path}`;
}

/** Ensemble des liens internes distincts d'une page HTML. */
export function extractInternalLinks(html, base) {
  const out = new Set();
  for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)) {
    const n = normalizeInternal(m[1].replace(/&amp;/g, "&"), base);
    if (n) out.add(n);
  }
  return out;
}

/**
 * @param urls     URLs indexables (sitemap)
 * @param linksBy  Map<url source, Set<url cible>>
 * @param isArticle (url) => boolean
 */
export function evaluateInbound(urls, linksBy, isArticle, base) {
  const norm = (u) => normalizeInternal(u, base);
  const counts = new Map(urls.map((u) => [norm(u), 0]));
  for (const [src, targets] of linksBy) {
    const s = norm(src);
    for (const t of targets) {
      if (t === s || !counts.has(t)) continue;
      counts.set(t, counts.get(t) + 1);
    }
  }
  const orphans = [];
  const weak = [];
  for (const u of urls) {
    const n = counts.get(norm(u)) ?? 0;
    if (n === 0) orphans.push(u);
    else if (isArticle(u) && n < ARTICLE_MIN_INBOUND) weak.push({ url: u, count: n });
  }
  return { orphans, weak, counts };
}
