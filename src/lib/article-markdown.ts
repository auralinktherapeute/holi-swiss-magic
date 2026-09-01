/**
 * Mise en page simple des articles thérapeutes.
 *
 * Le contenu est stocké en Markdown léger (titres, gras, italique, listes,
 * citations, liens). Deux utilitaires :
 *  - `htmlToMarkdown`  : conversion d'un copier-coller riche (Word, Docs, web)
 *  - `parseArticleMarkdown` : découpage en blocs sémantiques pour le rendu SEO
 *
 * Aucun HTML brut n'est réinjecté dans la page : le rendu construit des
 * éléments React à partir des blocs analysés.
 */

export type InlineToken =
  | { type: "text"; value: string }
  | { type: "strong"; value: string }
  | { type: "em"; value: string }
  | { type: "link"; value: string; href: string };

export type ArticleBlock =
  | { type: "heading"; level: 2 | 3 | 4; tokens: InlineToken[] }
  | { type: "paragraph"; tokens: InlineToken[] }
  | { type: "quote"; tokens: InlineToken[] }
  | { type: "list"; ordered: boolean; items: InlineToken[][] };

/* ------------------------------------------------------------------ */
/* Collage riche -> Markdown                                           */
/* ------------------------------------------------------------------ */

function textOf(node: Node): string {
  return (node.textContent ?? "").replace(/\s+/g, " ").trim();
}

function inlineMarkdown(node: Node): string {
  if (node.nodeType === 3) return (node.nodeValue ?? "").replace(/\s+/g, " ");
  if (node.nodeType !== 1) return "";
  const el = node as HTMLElement;
  const inner = Array.from(el.childNodes).map(inlineMarkdown).join("");
  const tag = el.tagName.toLowerCase();
  const trimmed = inner.trim();
  if (!trimmed) return tag === "br" ? "\n" : "";
  const style = el.getAttribute("style") ?? "";
  const bolded =
    tag === "strong" || tag === "b" ||
    /font-weight:\s*(bold|[6-9]00)/i.test(style);
  const italic = tag === "em" || tag === "i" || /font-style:\s*italic/i.test(style);
  if (tag === "a") {
    const href = el.getAttribute("href") ?? "";
    return href ? `[${trimmed}](${href})` : trimmed;
  }
  if (bolded) return `**${trimmed}**`;
  if (italic) return `*${trimmed}*`;
  if (tag === "br") return "\n";
  return inner;
}

/** Convertit un fragment HTML collé en Markdown léger. */
export function htmlToMarkdown(html: string): string {
  if (typeof window === "undefined" || !html.trim()) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,meta,link,noscript").forEach((n) => n.remove());
  const out: string[] = [];

  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      const t = (node.nodeValue ?? "").replace(/\s+/g, " ").trim();
      if (t) out.push(t);
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    switch (tag) {
      case "h1":
      case "h2":
        if (textOf(el)) out.push(`## ${inlineMarkdown(el).trim()}`);
        return;
      case "h3":
        if (textOf(el)) out.push(`### ${inlineMarkdown(el).trim()}`);
        return;
      case "h4":
      case "h5":
      case "h6":
        if (textOf(el)) out.push(`#### ${inlineMarkdown(el).trim()}`);
        return;
      case "blockquote":
        if (textOf(el)) out.push(`> ${inlineMarkdown(el).trim().replace(/\n+/g, " ")}`);
        return;
      case "ul":
      case "ol": {
        const ordered = tag === "ol";
        const items = Array.from(el.children)
          .filter((c) => c.tagName.toLowerCase() === "li")
          .map((li) => inlineMarkdown(li).trim().replace(/\n+/g, " "))
          .filter(Boolean);
        items.forEach((it, i) => out.push(ordered ? `${i + 1}. ${it}` : `- ${it}`));
        if (items.length) out.push("");
        return;
      }
      case "p":
      case "div":
      case "section":
      case "article": {
        const hasBlockChild = Array.from(el.children).some((c) =>
          ["p", "div", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "table", "section", "article"].includes(
            c.tagName.toLowerCase(),
          ),
        );
        if (hasBlockChild) {
          Array.from(el.childNodes).forEach(walk);
          return;
        }
        const md = inlineMarkdown(el).trim();
        if (md) out.push(md);
        return;
      }
      case "br":
        return;
      default: {
        const md = inlineMarkdown(el).trim();
        if (md) out.push(md);
      }
    }
  };

  Array.from(doc.body.childNodes).forEach(walk);

  return out
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(^|\n)((?:[-*] |\d+\. )[^\n]*)\n\n(?=(?:[-*] |\d+\. ))/g, "$1$2\n")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Markdown -> blocs                                                   */
/* ------------------------------------------------------------------ */

const INLINE_RE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|\[[^\]]+\]\([^)\s]+\))/g;

export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) tokens.push({ type: "text", value: text.slice(last, idx) });
    const raw = m[0];
    if (raw.startsWith("**") || raw.startsWith("__")) {
      tokens.push({ type: "strong", value: raw.slice(2, -2) });
    } else if (raw.startsWith("[")) {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(raw);
      if (link) tokens.push({ type: "link", value: link[1], href: link[2] });
      else tokens.push({ type: "text", value: raw });
    } else {
      tokens.push({ type: "em", value: raw.slice(1, -1) });
    }
    last = idx + raw.length;
  }
  if (last < text.length) tokens.push({ type: "text", value: text.slice(last) });
  return tokens.length ? tokens : [{ type: "text", value: text }];
}

/** Découpe le Markdown léger en blocs sémantiques prêts à rendre. */
export function parseArticleMarkdown(source: string): ArticleBlock[] {
  const lines = (source ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: ArticleBlock[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    const text = paragraph.join(" ").trim();
    paragraph = [];
    if (text) blocks.push({ type: "paragraph", tokens: parseInline(text) });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { flush(); continue; }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flush();
      const depth = heading[1].length;
      const level: 2 | 3 | 4 = depth <= 2 ? 2 : depth === 3 ? 3 : 4;
      blocks.push({ type: "heading", level, tokens: parseInline(heading[2].trim()) });
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      flush();
      blocks.push({ type: "quote", tokens: parseInline(trimmed.replace(/^>\s?/, "")) });
      continue;
    }

    const bullet = /^[-*•–—]\s+(.*)$/.exec(trimmed);
    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(trimmed);
    if (bullet || numbered) {
      flush();
      const ordered = !!numbered;
      const items: InlineToken[][] = [];
      let j = i;
      while (j < lines.length) {
        const t = lines[j].trim();
        const b = /^[-*•]\s+(.*)$/.exec(t);
        const n = /^(\d+)[.)]\s+(.*)$/.exec(t);
        if (ordered && n) items.push(parseInline(n[2]));
        else if (!ordered && b) items.push(parseInline(b[1]));
        else break;
        j++;
      }
      blocks.push({ type: "list", ordered, items });
      i = j - 1;
      continue;
    }

    paragraph.push(trimmed);
  }
  flush();
  return blocks;
}
