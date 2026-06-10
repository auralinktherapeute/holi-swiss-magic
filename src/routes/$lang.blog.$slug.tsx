import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getArticleBySlug, titleForLang, bodyForLang, excerptForLang } from "@/lib/articles.functions";
import { ArrowLeft, CalendarDays, Clock, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/$lang/blog/$slug")({ component: Page });

type Lang = "fr" | "de" | "it" | "en";

const CATEGORY_LABELS: Record<string, string> = {
  reflexologie: "Réflexologie", reiki: "Reiki", naturopathie: "Naturopathie",
  sophrologie: "Sophrologie", acupuncture: "Acupuncture", osteopathie: "Ostéopathie",
  yoga: "Yoga", hypnose: "Hypnose", aromatherapie: "Aromathérapie",
  magnetisme: "Magnétisme", shiatsu: "Shiatsu", meditation: "Méditation",
  coaching: "Coaching", ayurveda: "Ayurveda",
};

function formatDate(iso: string | null, lang: string) {
  if (!iso) return "";
  const locale = { de: "de-CH", it: "it-CH", en: "en-GB" }[lang] ?? "fr-CH";
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

function estimateReadTime(text: string): number {
  return Math.max(1, Math.round(text.split(/\s+/).length / 200));
}

// Markdown → HTML sécurisé (sans innerHTML d'user input non contrôlé)
function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 class="text-xl font-bold text-white mt-8 mb-3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold text-white mt-10 mb-4">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold text-white mt-10 mb-4">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-[#d4c4e0] italic">$1</em>')
    .replace(/^- (.+)$/gm, '<li class="text-[#d4c4e0] leading-relaxed ml-4 list-disc">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, m => `<ul class="my-4 space-y-1.5">${m}</ul>`)
    .split(/\n\n+/)
    .map(block => block.trim().startsWith("<") ? block : `<p class="text-[#d4c4e0] leading-relaxed mb-4">${block.replace(/\n/g, " ")}</p>`)
    .join("\n");
}

function SkeletonPage() {
  return (
    <div className="min-h-screen bg-[#2d1248]">
      <div className="w-full h-80 bg-[#3d1a5c] animate-pulse" />
      <div className="mx-auto max-w-3xl px-4 py-12 space-y-5">
        <div className="h-8 w-3/4 rounded bg-[#3d1a5c] animate-pulse" />
        <div className="h-4 w-1/2 rounded bg-[#3d1a5c] animate-pulse" />
        {[...Array(10)].map((_, i) => <div key={i} className="h-4 rounded bg-[#3d1a5c] animate-pulse" style={{ width: `${70 + Math.random() * 30}%` }} />)}
      </div>
    </div>
  );
}

function Page() {
  const { lang, slug } = useParams({ from: "/$lang/blog/$slug" });
  const { t } = useTranslation();
  const l = (lang as Lang) ?? "fr";

  const { data, isLoading } = useQuery({
    queryKey: ["article", slug],
    queryFn: () => getArticleBySlug({ data: { slug } }),
  });

  if (isLoading) return <SkeletonPage />;

  const raw = data?.article as Record<string, unknown> | null | undefined;
  const article = data?.article;

  if (!article || !raw) {
    return (
      <div className="min-h-screen bg-[#2d1248] flex items-center justify-center">
        <div className="text-center px-4">
          <div className="text-6xl mb-4">🌿</div>
          <p className="text-2xl font-bold text-white mb-2">Article introuvable</p>
          <p className="text-[#d4c4e0] mb-8">Cet article n'existe pas ou n'est plus disponible.</p>
          <Link to="/$lang/blog" params={{ lang: l }}
            className="inline-flex items-center gap-2 rounded-xl border border-[rgba(184,110,249,0.4)] bg-[rgba(184,110,249,0.1)] px-5 py-2.5 text-sm font-medium text-[#d4a5f9] hover:bg-[rgba(184,110,249,0.2)] transition-colors">
            <ArrowLeft className="h-4 w-4" /> Retour au blog
          </Link>
        </div>
      </div>
    );
  }

  const title   = titleForLang(raw, l);
  const body    = bodyForLang(raw, l);
  const excerpt = excerptForLang(raw, l);
  const readTime = body ? estimateReadTime(body) : null;

  return (
    <div className="min-h-screen bg-[#2d1248]">

      {/* ── Hero image ── */}
      {article.cover_image_url && (
        <div className="relative w-full h-72 md:h-96 overflow-hidden">
          <img src={article.cover_image_url} alt={title} className="w-full h-full object-cover" />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#2d1248] via-[#2d1248]/40 to-transparent" />
        </div>
      )}

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">

        {/* Retour */}
        <Link to="/$lang/blog" params={{ lang: l }}
          className="inline-flex items-center gap-1.5 text-sm text-[#d4c4e0]/70 hover:text-[#d4a5f9] transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" /> {t("nav.blog")}
        </Link>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {article.category && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(184,110,249,0.4)] bg-[rgba(184,110,249,0.12)] px-3 py-1 text-xs font-medium text-[#d4a5f9]">
              <Tag className="h-3 w-3" />
              {CATEGORY_LABELS[article.category] ?? article.category}
            </span>
          )}
          {article.published_at && (
            <span className="text-sm text-[#d4c4e0]/60 flex items-center gap-1">
              <CalendarDays className="h-4 w-4" />{formatDate(article.published_at, l)}
            </span>
          )}
          {readTime && (
            <span className="text-sm text-[#d4c4e0]/60 flex items-center gap-1">
              <Clock className="h-4 w-4" />{readTime} min de lecture
            </span>
          )}
        </div>

        {/* Titre */}
        <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-5">{title}</h1>

        {/* Extrait */}
        {excerpt && (
          <p className="text-lg text-[#d4c4e0] border-l-4 border-[#b86ef9]/50 pl-5 mb-10 italic leading-relaxed">
            {excerpt}
          </p>
        )}

        {/* Séparateur décoratif */}
        <div className="flex items-center gap-3 mb-10">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[rgba(184,110,249,0.3)] to-transparent" />
          <div className="h-2 w-2 rounded-full bg-[#b86ef9]/50" />
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[rgba(184,110,249,0.3)] to-transparent" />
        </div>

        {/* Corps de l'article */}
        {body && (
          <div
            className="text-base leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
          />
        )}

        {/* ── CTA ── */}
        <div className="mt-16 rounded-2xl border border-[rgba(184,110,249,0.25)] bg-gradient-to-br from-[#522870] to-[#3d1a5c] p-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#b86ef9]/30 to-[#5cc8fa]/20 ring-1 ring-[#b86ef9]/30 mb-4">
            <span className="text-xl">🌿</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            Trouver un thérapeute en Suisse
          </h3>
          <p className="text-[#d4c4e0] text-sm mb-6 max-w-sm mx-auto">
            Découvrez nos praticiens holistiques qualifiés, partout en Suisse.
          </p>
          <Link
            to="/$lang/therapeutes"
            params={{ lang: l }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#b86ef9] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#b86ef9]/30 hover:bg-[#a855f7] hover:shadow-[#b86ef9]/40 transition-all"
          >
            Voir les thérapeutes →
          </Link>
        </div>

        {/* Retour blog */}
        <div className="mt-10 text-center">
          <Link to="/$lang/blog" params={{ lang: l }}
            className="inline-flex items-center gap-1.5 text-sm text-[#d4c4e0]/60 hover:text-[#d4a5f9] transition-colors">
            <ArrowLeft className="h-4 w-4" /> Tous les articles
          </Link>
        </div>
      </div>
    </div>
  );
}
