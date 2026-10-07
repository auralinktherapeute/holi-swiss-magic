/**
 * Lecture du sitemap en ligne, compatible avec un sitemap INDEX.
 *
 * `/sitemap.xml` est un `<sitemapindex>` qui pointe vers 7 parties
 * (`/sitemaps/<part>.xml`). L'ancienne lecture comptait les `<loc>` de l'index
 * lui-même (≤ 7) et jugeait donc le sitemap « suspect ». Ici on suit chaque
 * partie, on rassemble leurs URL et on déduplique.
 *
 * Tout ou rien : si une seule partie échoue, on renvoie `urls: null` — un
 * périmètre partiel archiverait à tort les URL des parties manquantes.
 * Module pur (aucune API Deno) : testé par vitest.
 */

export type Fetcher = (url: string) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

export function parseSitemapXml(xml: string): { kind: "index" | "urlset" | "unknown"; locs: string[] } {
  const kind = /<sitemapindex[\s>]/.test(xml) ? "index" : /<urlset[\s>]/.test(xml) ? "urlset" : "unknown";
  // Seules les <loc> directes comptent (pas les <xhtml:link href> des hreflang).
  const locs = [...xml.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)].map((m) => decode(m[1].trim()));
  return { kind, locs };
}

/** Normalise une URL canonique pour la déduplication (sans fragment ni slash final hors racine). */
export function canonicalKey(u: string): string {
  const noHash = u.split("#")[0];
  return noHash.length > 1 && noHash.endsWith("/") && !/^https?:\/\/[^/]+\/$/.test(noHash) ? noHash.slice(0, -1) : noHash;
}

export async function readSitemapUrls(
  site: string,
  fetcher: Fetcher,
): Promise<{ urls: Set<string> | null; parts: number; errors: string[] }> {
  const errors: string[] = [];
  const root = await fetcher(`${site}/sitemap.xml`);
  if (!root.ok) return { urls: null, parts: 0, errors: [`Sitemap HTTP ${root.status}`] };
  const top = parseSitemapXml(await root.text());

  let pageLocs: string[] = [];
  let parts = 0;
  if (top.kind === "index") {
    const children = top.locs.filter((u) => u.startsWith(site));
    parts = children.length;
    for (const child of children) {
      const r = await fetcher(child);
      if (!r.ok) {
        errors.push(`Sous-sitemap ${child} HTTP ${r.status}`);
        return { urls: null, parts, errors };
      }
      const sub = parseSitemapXml(await r.text());
      if (sub.kind !== "urlset") {
        errors.push(`Sous-sitemap ${child} illisible`);
        return { urls: null, parts, errors };
      }
      pageLocs = pageLocs.concat(sub.locs);
    }
  } else if (top.kind === "urlset") {
    pageLocs = top.locs;
  } else {
    return { urls: null, parts: 0, errors: ["Sitemap illisible"] };
  }

  const urls = new Set(pageLocs.filter((u) => u.startsWith(site)).map(canonicalKey));
  return { urls, parts, errors };
}
