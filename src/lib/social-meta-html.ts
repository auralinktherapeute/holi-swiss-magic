/**
 * Complète les balises de partage d'une page HTML rendue côté serveur, à
 * partir de SES propres titre et description (aucun texte inventé) :
 *  - og:locale : aligné sur la langue réelle de la page (<html lang>) quand il
 *    était resté sur la valeur française par défaut de la racine ;
 *  - twitter:card / twitter:title / twitter:description : ajoutés seulement
 *    s'ils manquent. Une valeur posée par la page n'est jamais remplacée.
 * Réseaux sociaux et robots lisent ce HTML initial.
 */
const LOCALES: Record<string, string> = { fr: "fr_CH", de: "de_CH", it: "it_CH", en: "en_GB" };

const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}="([^"]*)"`, "i"))?.[1];

function findMeta(head: string, key: "name" | "property", value: string): string | null {
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    if (attr(tag, key) === value) return tag;
  }
  return null;
}

function selfCanonicalIn(head: string, lang: string): boolean {
  const tag = (head.match(/<link\b[^>]*>/gi) ?? []).find((t) => /rel="canonical"/i.test(t));
  const href = tag ? attr(tag, "href") ?? "" : "";
  return new RegExp(`^https://holiswiss\\.ch/${lang}(/|$)`).test(href);
}

export function completeSocialHtml(html: string, ogLocaleFor: (l: string) => string = (l) => LOCALES[l]): string {
  const headEnd = html.indexOf("</head>");
  if (headEnd === -1) return html;
  let head = html.slice(0, headEnd);
  const lang = html.match(/<html[^>]*\blang="([a-z]{2})"/i)?.[1]?.toLowerCase();
  const add: string[] = [];

  if (lang && LOCALES[lang]) {
    const want = ogLocaleFor(lang);
    const tag = findMeta(head, "property", "og:locale");
    if (!tag) add.push(`<meta property="og:locale" content="${want}"/>`);
    // Seulement sur une page canonique d'elle-même dans cette langue : une
    // variante qui renvoie vers le français (profil, Voix d'experts…) garde fr.
    else if (lang !== "fr" && attr(tag, "content") === LOCALES.fr && selfCanonicalIn(head, lang)) {
      head = head.replace(tag, tag.replace(/content="[^"]*"/i, `content="${want}"`));
    }
  }

  const title = head.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
  if (title) {
    const description = attr(findMeta(head, "name", "description") ?? "", "content");
    const hasImage = Boolean(findMeta(head, "property", "og:image"));
    if (!findMeta(head, "name", "twitter:card")) add.push(`<meta name="twitter:card" content="${hasImage ? "summary_large_image" : "summary"}"/>`);
    if (!findMeta(head, "name", "twitter:title")) add.push(`<meta name="twitter:title" content="${title}"/>`);
    if (description && !findMeta(head, "name", "twitter:description")) add.push(`<meta name="twitter:description" content="${description}"/>`);
  }
  return head + add.join("") + html.slice(headEnd);
}
