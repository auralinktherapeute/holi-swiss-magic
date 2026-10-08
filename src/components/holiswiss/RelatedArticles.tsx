import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { categoryLabel } from "@/lib/article-categories";
import type { RelatedArticleLink, RelatedLang } from "@/lib/related-articles";

const TITLES: Record<RelatedLang, string> = {
  fr: "Articles connexes",
  de: "Verwandte Artikel",
  it: "Articoli correlati",
  en: "Related articles",
};

/** Liens rendus au SSR depuis le loader de l'article. Aucun lien : bloc absent. */
export function RelatedArticles({ items, lang }: { items: ReadonlyArray<RelatedArticleLink>; lang: RelatedLang }) {
  if (items.length === 0) return null;
  return (
    <nav aria-labelledby="related-articles" className="mx-auto mt-12 w-full max-w-[800px]">
      <h2 id="related-articles" className="mb-4 flex items-center gap-2 text-xl font-semibold text-white">
        <BookOpen className="h-5 w-5 text-[#b86ef9]" aria-hidden />
        {TITLES[lang]}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((a) => {
          const cat = a.category ? categoryLabel(a.category, lang) : null;
          return (
            <li key={a.id}>
              <Link
                to="/$lang/blog/$slug"
                params={{ lang, slug: a.slug }}
                className="flex min-h-[44px] h-full flex-col gap-1 rounded-xl border border-[rgba(184,110,249,0.2)] bg-[#3d1a5c]/60 p-4 transition-colors hover:border-[#b86ef9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9]"
              >
                {cat && <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5cc8fa]">{cat}</span>}
                <span className="text-sm font-semibold leading-snug text-white">{a.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
