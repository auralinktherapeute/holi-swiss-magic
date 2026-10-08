import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { pickRelatedArticles } from "./related-articles";
// @ts-expect-error module JS sans types
import { evaluateInbound, extractInternalLinks } from "../../scripts/seo/inbound-links.mjs";

const art = (id: string, category: string | null, tags: string[] = [], extra: Record<string, unknown> = {}) => ({
  id, slug: `s-${id}`, title_fr: `T ${id}`, category, secondary_tags: tags, ...extra,
});

describe("articles connexes", () => {
  const cur = art("cur", "hypnose", ["stress"]);
  const list = [art("a", "yoga"), art("b", "hypnose"), cur, art("c", "yoga", ["stress"]), art("d", "reiki", ["hypnose"]), art("e", "yoga"), art("f", "yoga")];

  it("exclut l'article courant, max 5, même catégorie puis tags", () => {
    const r = pickRelatedArticles(cur, list, "fr");
    expect(r.map((x) => x.id)).toEqual(["b", "d", "c", "a", "e"]);
    expect(r.some((x) => x.id === "cur")).toBe(false);
  });

  it("hors FR : seulement les titres traduits, slug localisé", () => {
    const l2 = [art("x", "hypnose", [], { title_de: "DE x", slug_de: "de-x" }), art("y", "hypnose")];
    const r = pickRelatedArticles(cur, l2, "de");
    expect(r).toEqual([{ id: "x", slug: "de-x", title: "DE x", category: "hypnose" }]);
  });

  it("le bloc est rendu par la page article depuis le loader", () => {
    const src = readFileSync("src/routes/$lang.blog.$slug.tsx", "utf8");
    expect(src).toMatch(/pickRelatedArticles\(/);
    expect(src).toMatch(/<RelatedArticles/);
  });
});

describe("orpheline sophrologie", () => {
  it("le listing blog FR lie la page sophrologie", () => {
    const src = readFileSync("src/routes/$lang.blog.index.tsx", "utf8");
    expect(src).toMatch(/to="\/\$lang\/blog\/qu-est-ce-que-la-sophrologie"/);
  });
});

describe("contrôle des liens entrants", () => {
  const B = "https://holiswiss.ch";
  it("extrait liens relatifs et absolus, ignore l'externe", () => {
    const s = extractInternalLinks('<a href="/fr/blog/x/">a</a><a href="https://holiswiss.ch/fr/y?z=1">b</a><a href="https://ex.com/">c</a>', B);
    expect([...s]).toEqual([`${B}/fr/blog/x`, `${B}/fr/y`]);
  });
  it("orpheline = échec, article < 3 = avertissement, auto-lien ignoré", () => {
    const urls = [`${B}/fr`, `${B}/fr/blog/a`, `${B}/fr/blog/b`];
    const links = new Map([
      [`${B}/fr`, new Set([`${B}/fr/blog/a`])],
      [`${B}/fr/blog/b`, new Set([`${B}/fr/blog/b`, `${B}/fr`])],
    ]);
    const r = evaluateInbound(urls, links, (u: string) => u.includes("/blog/"), B);
    expect(r.orphans).toEqual([`${B}/fr/blog/b`]);
    expect(r.weak).toEqual([{ url: `${B}/fr/blog/a`, count: 1 }]);
  });
});
