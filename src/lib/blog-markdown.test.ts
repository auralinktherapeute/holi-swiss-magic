import { describe, expect, it } from "vitest";
import { markdownLinkHref, renderMarkdown } from "./blog-markdown";

describe("markdownLinkHref", () => {
  it("garde un chemin interne", () => {
    expect(markdownLinkHref("/fr/faq", "fr")).toBe("/fr/faq");
  });

  it("ramène les chemins d'annuaire traduits (404) vers /{lang}/therapeutes", () => {
    expect(markdownLinkHref("/de/therapeuten", "de")).toBe("/de/therapeutes");
    expect(markdownLinkHref("/en/therapists", "en")).toBe("/en/therapeutes");
    expect(markdownLinkHref("/it/terapeuti", "it")).toBe("/it/therapeutes");
  });

  it("aligne la langue de l'annuaire sur celle de l'article", () => {
    expect(markdownLinkHref("/fr/therapeutes", "de")).toBe("/de/therapeutes");
    expect(markdownLinkHref("/fr/therapeutes?specialite=reiki", "it")).toBe("/it/therapeutes?specialite=reiki");
  });

  it("ne touche pas aux autres chemins qui commencent pareil", () => {
    expect(markdownLinkHref("/fr/therapeutes-a-la-une", "de")).toBe("/fr/therapeutes-a-la-une");
    expect(markdownLinkHref("/fr/blog/un-article", "de")).toBe("/fr/blog/un-article");
  });

  it("accepte https, refuse tout le reste", () => {
    expect(markdownLinkHref("https://www.bag.admin.ch/", "fr")).toBe("https://www.bag.admin.ch/");
    expect(markdownLinkHref("javascript:alert(1)", "fr")).toBeNull();
    expect(markdownLinkHref("data:text/html,x", "fr")).toBeNull();
    expect(markdownLinkHref("http://exemple.ch", "fr")).toBeNull();
    expect(markdownLinkHref("//evil.example", "fr")).toBeNull();
    expect(markdownLinkHref("relatif/page", "fr")).toBeNull();
  });
});

describe("renderMarkdown", () => {
  it("rend un lien Markdown cliquable au lieu du texte brut", () => {
    const html = renderMarkdown("**[Consultez l'annuaire Holiswiss](/fr/therapeutes)**", "fr");
    expect(html).toContain('<a href="/fr/therapeutes"');
    expect(html).toContain(">Consultez l'annuaire Holiswiss</a>");
    expect(html).not.toContain("](/fr/therapeutes)");
  });

  it("corrige la cible d'un article allemand", () => {
    const html = renderMarkdown("[Verzeichnis](/de/therapeuten)", "de");
    expect(html).toContain('href="/de/therapeutes"');
  });

  it("n'ouvre dans un nouvel onglet que les liens externes", () => {
    expect(renderMarkdown("[OFSP](https://www.bag.admin.ch/)", "fr")).toContain('target="_blank" rel="noopener noreferrer"');
    expect(renderMarkdown("[FAQ](/fr/faq)", "fr")).not.toContain("target=");
  });

  it("garde le texte seul quand la cible est refusée", () => {
    const html = renderMarkdown("[clic](javascript:alert(1))", "fr");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("javascript:");
  });

  it("ne laisse passer aucune balise venue du texte", () => {
    const html = renderMarkdown('[<img src=x onerror=alert(1)>](/fr/faq)', "fr");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("rend --- en séparateur et plus en texte", () => {
    const html = renderMarkdown("Avant\n\n---\n\nAprès", "fr");
    expect(html).toContain("<hr");
    expect(html).not.toContain("---");
  });

  it("enveloppe un paragraphe qui commence par un lien", () => {
    const html = renderMarkdown("[FAQ](/fr/faq) pour en savoir plus.", "fr");
    expect(html.startsWith("<p ")).toBe(true);
  });

  it("ne change pas le rendu existant (titres, gras, listes)", () => {
    const html = renderMarkdown("## Titre\n\nTexte **fort**.\n\n- un\n- deux", "fr");
    expect(html).toContain('<h2 class="text-2xl font-bold text-white mt-10 mb-4">Titre</h2>');
    expect(html).toContain('<strong class="text-white font-semibold">fort</strong>');
    expect(html).toContain('<ul class="my-4 space-y-1.5">');
  });
});
