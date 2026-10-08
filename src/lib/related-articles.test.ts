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

  const frBody = "Les bienfaits de la méthode sont nombreux pour votre santé et pour la vie dans une ville suisse. ".repeat(5);
  const deBody = "Die Methode bietet viele Vorteile für Ihre Gesundheit und das Leben in einer Schweizer Stadt heute. ".repeat(5);
  const full = (id: string) =>
    art(id, "hypnose", [], {
      title_fr: `Titre ${id}`, excerpt_fr: "Un résumé en français pour cette page.", body_fr: frBody,
      title_de: `Titel ${id}`, excerpt_de: "Eine kurze Zusammenfassung auf Deutsch.", body_de: deBody,
      meta_title_de: `Meta ${id}`, meta_description_de: "Eine Beschreibung auf Deutsch für Suchmaschinen.",
      slug_de: `de-${id}`,
    });

  it("hors FR : traduction complète conservée avec slug et titre localisés", () => {
    const r = pickRelatedArticles(cur, [full("x")], "de");
    expect(r).toEqual([{ id: "x", slug: "de-x", title: "Titel x", category: "hypnose" }]);
  });

  it("hors FR : titre traduit seul (corps, résumé ou méta manquants) exclu", () => {
    const noBody = { ...full("a"), body_de: "" };
    const noExcerpt = { ...full("b"), excerpt_de: "" };
    const noMeta = { ...full("c"), meta_description_de: "" };
    const titleOnly = art("d", "hypnose", [], { title_de: "Nur Titel", slug_de: "de-d" });
    const badSlug = { ...full("e"), slug_de: "Mauvais Slug" };
    expect(pickRelatedArticles(cur, [noBody, noExcerpt, noMeta, titleOnly, badSlug], "de")).toEqual([]);
  });

  it("utilise la règle centrale isTranslationComplete, pas une copie", () => {
    const src = readFileSync("src/lib/related-articles.ts", "utf8");
    expect(src).toMatch(/import \{[^}]*isTranslationComplete[^}]*\} from "@\/lib\/article-translation"/);
  });

  it("filtrage côté serveur : seules les suggestions finales sont renvoyées", () => {
    const fn = readFileSync("src/lib/articles.functions.ts", "utf8");
    expect(fn).toMatch(/getRelatedArticles = createServerFn[\s\S]*?return \{ related: pickRelatedArticles\(/);
    const page = readFileSync("src/routes/$lang.blog.$slug.tsx", "utf8");
    expect(page).toMatch(/getRelatedArticles\(/);
    expect(page).not.toMatch(/pickRelatedArticles\(/);
  });

  it("le bloc est rendu par la page article depuis le loader", () => {
    const src = readFileSync("src/routes/$lang.blog.$slug.tsx", "utf8");
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
