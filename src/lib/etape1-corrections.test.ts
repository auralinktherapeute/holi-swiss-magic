import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { readSitemapUrls, parseSitemapXml } from "../../supabase/functions/run-indexation/sitemap-read";
import { legacyRedirectTarget, rewriteLegacyHref } from "./legacy-redirects";
import { sanitizeNotFoundHtml } from "./not-found-seo";
import { resumeTourStep, TOUR_LENGTH } from "./onboarding-checklist";
import { isRealInternalRoute } from "./internal-routes.shared";

const SITE = "https://holiswiss.ch";
const urlset = (urls: string[]) =>
  `<?xml version="1.0"?><urlset xmlns="x">${urls.map((u) => `<url><loc>${u}</loc><xhtml:link href="${u}?x"/></url>`).join("")}</urlset>`;
const index = (parts: string[]) =>
  `<?xml version="1.0"?><sitemapindex xmlns="x">${parts.map((p) => `<sitemap><loc>${SITE}/sitemaps/${p}.xml</loc></sitemap>`).join("")}</sitemapindex>`;
const PARTS = ["pages", "profils", "annuaire", "articles-fr", "articles-de", "articles-it", "articles-en"];

function fetcherFor(map: Record<string, string | number>) {
  return async (url: string) => {
    const v = map[url];
    if (typeof v === "number" || v === undefined) return { ok: false, status: (v as number) ?? 404, text: async () => "" };
    return { ok: true, status: 200, text: async () => v };
  };
}

describe("indexation : sitemap index", () => {
  const map: Record<string, string> = { [`${SITE}/sitemap.xml`]: index(PARTS) };
  for (const p of PARTS) {
    const n = p.startsWith("articles-") && p !== "articles-fr" ? 20 : 60;
    map[`${SITE}/sitemaps/${p}.xml`] = urlset(
      Array.from({ length: n }, (_, i) => `${SITE}/${p.replace("articles-", "")}/page-${i}`).concat(`${SITE}/fr`),
    );
  }

  it("suit les 7 parties, déduplique, ignore les hreflang", async () => {
    const r = await readSitemapUrls(SITE, fetcherFor(map));
    expect(r.parts).toBe(7);
    expect(r.errors).toEqual([]);
    // 4×60 + 3×20 traductions + /fr dédupliqué
    expect(r.urls!.size).toBe(4 * 60 + 3 * 20 + 1);
    expect([...r.urls!].some((u) => u.includes("?x"))).toBe(false);
  });

  it("l'index lui-même n'est pas jugé comme un sitemap de 7 URL", () => {
    expect(parseSitemapXml(index(PARTS)).kind).toBe("index");
  });

  it("une partie en échec → aucun périmètre (pas d'archivage à tort)", async () => {
    const r = await readSitemapUrls(SITE, fetcherFor({ ...map, [`${SITE}/sitemaps/profils.xml`]: 500 }));
    expect(r.urls).toBeNull();
    expect(r.errors[0]).toContain("profils");
  });

  it("IndexNow 200/202 n'est jamais compté comme indexé", () => {
    const src = readFileSync("supabase/functions/run-indexation/index.ts", "utf8");
    expect(src).not.toMatch(/indexNowStatus[^\n]*status\s*=\s*["']indexed/);
  });
});

describe("guide : reprise bornée", () => {
  it("reprend l'étape sauvegardée, bornée 1..8", () => {
    expect(resumeTourStep({ tour_step: 4 })).toBe(4);
    expect(resumeTourStep({ tour_step: 99 })).toBe(TOUR_LENGTH - 1);
    expect(resumeTourStep({ tour_step: -3 })).toBe(0);
  });
  it("le tableau de bord transmet l'étape au guide", () => {
    expect(readFileSync("src/routes/dashboard.tsx", "utf8")).toContain("initialStep={tourStart}");
  });
});

describe("langue des cartes de profils", () => {
  it("les liens gardent la langue consultée", () => {
    for (const f of ["NewTherapistsShowcase", "NearbyTherapistsSwiss"]) {
      const src = readFileSync(`src/components/holiswiss/${f}.tsx`, "utf8");
      expect(src).not.toContain("lang: th.profileLang");
    }
  });
});

describe("profil : lectures sensibles", () => {
  const src = readFileSync("src/routes/dashboard.profil.tsx", "utf8");
  it("pas de lecture sans jeton, échec mémorisé", () => {
    expect(src).toContain("hasToken");
    expect(src).toContain("setIdeLoadFailed(Boolean(data) && ideFailed)");
  });
  it("champ en échec et vide : non envoyé", () => {
    expect(src).toContain('phoneLoadFailed && phone.trim() === "" ? undefined');
    expect(src).toContain('ideLoadFailed && ide.trim() === "" ? undefined');
  });
});

describe("logos organismes", () => {
  it("retirer le logo ne supprime pas le fichier avant enregistrement", () => {
    const up = readFileSync("src/components/admin/OrganizationLogoUploader.tsx", "utf8");
    const rm = up.slice(up.indexOf("const removeLogo"), up.indexOf("return (", up.indexOf("const removeLogo")));
    expect(rm).not.toContain(".remove(");
  });
  it("ancien fichier nettoyé seulement après sauvegarde, repli visuel présent", () => {
    const form = readFileSync("src/routes/admin.certifications-organismes.tsx", "utf8");
    expect(form.indexOf(".remove([oldPath])")).toBeGreaterThan(form.indexOf("onSuccess: async"));
    expect(readFileSync("src/components/holiswiss/OrgCertificationBadges.tsx", "utf8")).toContain("onError={() => setFailed(true)}");
  });
});

describe("anciennes adresses", () => {
  const cases: Record<string, string> = {
    "/connexion": "/fr/connexion",
    "/de/therapeuten": "/de/therapeutes",
    "/en/practitioners": "/en/therapeutes",
    "/en/therapists": "/en/therapeutes",
    "/it/terapeuti": "/it/therapeutes",
    "/lithotherapie-suisse-cristaux-bien-etre-energetique": "/fr/blog/lithotherapie-suisse-cristaux-bien-etre-energetique",
    "/magnetisme-suisse": "/fr/specialites/magnetisme",
  };
  it.each(Object.entries(cases))("%s → %s (cible réelle)", (from, to) => {
    expect(legacyRedirectTarget(from)).toBe(to);
    expect(isRealInternalRoute(to)).toBe(true);
  });
  it("réécrit les liens absolus et garde les ancres", () => {
    expect(rewriteLegacyHref("https://www.holiswiss.ch/de/therapeuten?x=1")).toBe("/de/therapeutes?x=1");
    expect(rewriteLegacyHref("/fr/blog/autre")).toBe("/fr/blog/autre");
    expect(rewriteLegacyHref("https://exemple.ch/connexion")).toBe("https://exemple.ch/connexion");
  });
});

describe("vraie 404", () => {
  it("noindex,follow, sans canonique ni données structurées", () => {
    const out = sanitizeNotFoundHtml(
      `<html><head><title>Soins esseniens</title><meta name="robots" content="index, follow"/><link rel="canonical" href="x"/><link rel="alternate" hreflang="de" href="y"/><script type="application/ld+json">{"@type":"BreadcrumbList"}</script></head><body/></html>`,
    );
    expect(out).toContain('<meta name="robots" content="noindex,follow"/>');
    expect(out).not.toMatch(/canonical|alternate|ld\+json|index, follow/);
    expect(out).toContain("Page introuvable");
  });
});

describe("pages d'accès", () => {
  it.each(["connexion", "inscription", "mot-de-passe-oublie", "reinitialiser-mot-de-passe"])("%s : noindex,follow + canonique", (f) => {
    const src = readFileSync(`src/routes/$lang.${f}.index.tsx`, "utf8");
    expect(src).toContain('content: "noindex,follow"');
    expect(src).toContain('rel: "canonical"');
  });
  it("robots.txt ne bloque plus ces pages (noindex lisible), garde les zones privées", () => {
    const r = readFileSync("public/robots.txt", "utf8");
    expect(r).not.toMatch(/^Disallow: \/\*\/(connexion|inscription)/m);
    expect(r).toMatch(/^Disallow: \/admin\//m);
  });
});
