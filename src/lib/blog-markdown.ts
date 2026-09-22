/**
 * Rendu Markdown minimal des articles du blog (titres, gras, italique, listes,
 * paragraphes), sorti de `$lang.blog.$slug.tsx` le 22/09/2026 pour être testé.
 *
 * Le texte est échappé AVANT toute transformation : seules les balises
 * produites ici atteignent le HTML.
 */
// Chemins d'annuaire traduits que les articles générés emploient mais qui
// n'existent pas : la route est `/{lang}/therapeutes` dans les 4 langues.
const DIRECTORY_ALIASES = /^\/(fr|de|it|en)\/(therapeutes|therapeuten|therapists|terapeuti)(?=$|[/?#])/;

/**
 * Cible d'un lien Markdown, ou `null` s'il ne doit pas devenir un lien.
 * Seuls les chemins internes (`/…`) et les URL `https://` sont acceptés —
 * jamais `javascript:`, `data:` ni une URL relative ambiguë. Les liens vers
 * l'annuaire sont ramenés à la langue de l'article et au bon chemin.
 */
export function markdownLinkHref(raw: string, lang: string): string | null {
  const href = raw.trim();
  if (href.startsWith("/") && !href.startsWith("//")) {
    return href.replace(DIRECTORY_ALIASES, `/${lang}/therapeutes`);
  }
  if (/^https:\/\/[^\s/]+/i.test(href)) return href;
  return null;
}

export function renderMarkdown(md: string, lang = "fr"): string {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // Séparateurs `---` seuls sur leur ligne (affichés en texte jusqu'au 22/09).
    .replace(/^-{3,}\s*$/gm, '<hr class="my-8 border-white/10" />')
    // Liens `[texte](url)` : jusqu'au 22/09 ils sortaient en texte brut.
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, text: string, url: string) => {
      const href = markdownLinkHref(url.replace(/&amp;/g, "&"), lang);
      if (!href) return text;
      const safe = href.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      const ext = href.startsWith("https://") && !href.startsWith("https://holiswiss.ch");
      return `<a href="${safe}" class="text-[#5cc8fa] underline underline-offset-2 hover:text-white"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>${text}</a>`;
    })
    .replace(/^### (.+)$/gm, '<h3 class="text-xl font-bold text-white mt-8 mb-3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold text-white mt-10 mb-4">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold text-white mt-10 mb-4">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-[#d4c4e0] italic">$1</em>')
    .replace(/^- (.+)$/gm, '<li class="text-[#d4c4e0] leading-relaxed ml-4 list-disc">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, m => `<ul class="my-4 space-y-1.5">${m}</ul>`)
    .split(/\n\n+/)
    .map(block => block.trim().startsWith("<") && !block.trim().startsWith("<a ") ? block : `<p class="text-[#d4c4e0] leading-relaxed mb-4">${block.replace(/\n/g, " ")}</p>`)
    .join("\n");
}
