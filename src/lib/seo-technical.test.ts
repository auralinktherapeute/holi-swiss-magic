/**
 * Lot SEO/GEO technique — garde-fous.
 *
 * Ces tests ne vérifient pas des textes visibles : ils verrouillent trois
 * régressions déjà constatées (titre coupé au milieu d'un mot, groupe de robots
 * nommé plus permissif que « * », billets du fil publiés sous deux adresses).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildMetaTitle, SEO_TITLE_MAX } from "./seo-title";
import { FIL_CATEGORY_SLUGS } from "@/data/fil-holiswiss";

describe("buildMetaTitle", () => {
  it("garde la marque intacte et coupe sur un mot", () => {
    const long =
      "Sophrologie, relaxation profonde et gestion du stress au quotidien en Suisse romande";
    const out = buildMetaTitle(long, "Holiswiss");
    expect([...out].length).toBeLessThanOrEqual(SEO_TITLE_MAX);
    expect(out.endsWith(" | Holiswiss")).toBe(true);
    // aucun mot amputé : le segment avant l'ellipse finit sur un mot complet
    const head = out.slice(0, out.indexOf("…"));
    expect(long.startsWith(head)).toBe(true);
    expect(long[head.length] === " " || long.length === head.length).toBe(true);
  });

  it("n'ajoute pas d'ellipse quand le titre tient", () => {
    expect(buildMetaTitle("Sophrologie en Suisse", "Holiswiss")).toBe(
      "Sophrologie en Suisse | Holiswiss",
    );
  });

  it("n'écrit jamais la marque « HoliSwiss »", () => {
    expect(buildMetaTitle("Titre", "Holiswiss")).not.toContain("HoliSwiss");
  });
});

describe("robots.txt", () => {
  const txt = readFileSync("public/robots.txt", "utf8");

  const groups = () => {
    const out = new Map<string, string[]>();
    let current: string[] | null = null;
    for (const raw of txt.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const ua = /^user-agent:\s*(.+)$/i.exec(line);
      if (ua) {
        current = [];
        out.set(ua[1].trim(), current);
        continue;
      }
      const dis = /^disallow:\s*(.+)$/i.exec(line);
      if (dis && current) current.push(dis[1].trim());
    }
    return out;
  };

  it("chaque groupe nommé reprend exactement les exclusions de « * »", () => {
    const g = groups();
    const star = g.get("*");
    expect(star && star.length).toBeGreaterThan(0);
    for (const [ua, rules] of g) {
      if (ua === "*") continue;
      expect([ua, [...rules].sort()]).toEqual([ua, [...star!].sort()]);
    }
  });

  it("déclare les robots IA et moteurs attendus", () => {
    const g = groups();
    for (const ua of [
      "GPTBot",
      "OAI-SearchBot",
      "ClaudeBot",
      "PerplexityBot",
      "Bingbot",
      "CCBot",
      "Amazonbot",
      "meta-externalagent",
    ]) {
      expect([...g.keys()]).toContain(ua);
    }
  });

  it("déclare le sitemap", () => {
    expect(txt).toContain("Sitemap: https://holiswiss.ch/sitemap.xml");
  });
});

describe("sitemap — séparation blog / fil", () => {
  const src = readFileSync("src/routes/sitemap[.]xml.ts", "utf8");

  it("les billets du fil ne passent plus par la boucle du blog", () => {
    expect(src).toContain("const blogArticles = articles.filter((a) => !isFil(a));");
    expect(src).toMatch(/for \(const a of blogArticles\) \{[\s\S]*?\/blog\//);
    expect(src).not.toMatch(/for \(const a of articles\) \{/);
  });

  it("déclare l'index et les billets du fil, jamais une catégorie du fil", () => {
    expect(src).toContain('{ path: "/fil-holiswiss"');
    expect(src).toContain("/fil-holiswiss/${a.slug}");
    for (const slug of FIL_CATEGORY_SLUGS) {
      expect(src).not.toContain(`/blog/categorie/${slug}`);
    }
  });

  it("déclare la page sophrologie avec un lastmod fixe et véridique", () => {
    expect(src).toMatch(
      /path: "\/blog\/qu-est-ce-que-la-sophrologie"[^}]*lastmod: "2026-08-31"/,
    );
  });
});
