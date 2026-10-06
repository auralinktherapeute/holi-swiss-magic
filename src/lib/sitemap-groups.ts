/**
 * Découpage du plan du site en sitemaps contrôlables séparément dans
 * Search Console. Le classement se fait sur l'URL (`<loc>`) de chaque bloc.
 */
const BASE_URL = "https://holiswiss.ch";

export const SITEMAP_PARTS = [
  "pages",
  "profils",
  "annuaire",
  "articles-fr",
  "articles-de",
  "articles-it",
  "articles-en",
] as const;
export type SitemapPart = (typeof SITEMAP_PARTS)[number];

export function isSitemapPart(v: string): v is SitemapPart {
  return (SITEMAP_PARTS as readonly string[]).includes(v);
}

export function partForLoc(loc: string): SitemapPart {
  const path = loc.replace(BASE_URL, "");
  const m = path.match(/^\/(fr|de|it|en)\/blog\/(?!categorie\/)[^/]+$/);
  if (m) return `articles-${m[1]}` as SitemapPart;
  if (/^\/(fr|de|it|en)\/therapeute\//.test(path)) return "profils";
  if (/^\/(fr|de|it|en)\/(therapeutes\/.+|specialites(\/.*)?)$/.test(path)) return "annuaire";
  return "pages";
}

export function locOfBlock(block: string): string {
  return (block.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? "").replace(/&amp;/g, "&");
}

export function groupBlocks(blocks: string[]): Record<SitemapPart, string[]> {
  const out = Object.fromEntries(SITEMAP_PARTS.map((p) => [p, [] as string[]])) as Record<SitemapPart, string[]>;
  for (const b of blocks) out[partForLoc(locOfBlock(b))].push(b);
  return out;
}

export function latestLastmod(blocks: string[]): string | undefined {
  let latest: string | undefined;
  for (const b of blocks) {
    const d = b.match(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/)?.[1];
    if (d && (!latest || d > latest)) latest = d;
  }
  return latest;
}

export function urlsetXml(blocks: string[]): string {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`,
    ...blocks,
    `</urlset>`,
  ].join("\n");
}

export function partUrl(part: SitemapPart): string {
  return `${BASE_URL}/sitemaps/${part}.xml`;
}

/** Index : un `<sitemap>` par partie non vide, `lastmod` = le plus récent de la partie. */
export function sitemapIndexXml(groups: Record<SitemapPart, string[]>): string {
  const items = SITEMAP_PARTS.filter((p) => groups[p].length > 0).map((p) => {
    const lm = latestLastmod(groups[p]);
    return ["  <sitemap>", `    <loc>${partUrl(p)}</loc>`, lm ? `    <lastmod>${lm}</lastmod>` : null, "  </sitemap>"]
      .filter(Boolean)
      .join("\n");
  });
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...items,
    `</sitemapindex>`,
  ].join("\n");
}

export function xmlResponse(xml: string, lastmod?: string): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  };
  if (lastmod) {
    headers["Last-Modified"] = new Date(`${lastmod}T00:00:00Z`).toUTCString();
    headers["ETag"] = `W/"${xml.match(/<loc>/g)?.length ?? 0}-${lastmod}"`;
  }
  return new Response(xml, { headers });
}

export function unavailableResponse(): Response {
  // Un 503 dit à Google de repasser et de conserver la version connue.
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<!-- sitemap temporairement indisponible -->`, {
    status: 503,
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "3600" },
  });
}
