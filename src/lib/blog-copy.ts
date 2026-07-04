export type BlogLang = "fr" | "de" | "it" | "en";

type BlogCopy = {
  navBlog: string;
  badge: string;
  heroTitlePart1: string;
  heroTitleHighlight: string;
  heroSubtitle: string;
  emptyTitle: string;
  emptySubtitle: string;
  featured: string;
  readArticle: string;
  read: string;
  categoryComingSoon: string;
  categoryEmpty: (name: string) => string;
  seeAllBlog: string;
  notFoundTitle: string;
  notFoundSubtitle: string;
  backToBlog: string;
  readTime: (count: number) => string;
  languageFallback: (lang: string) => string;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaButton: string;
  allArticles: string;
  categoryCount: (count: number) => string;
};

export const BLOG_COPY: Record<BlogLang, BlogCopy> = {
  fr: {
    navBlog: "Blog",
    badge: "Blog bien-être",
    heroTitlePart1: "Blog bien-être :",
    heroTitleHighlight: "thérapies holistiques en Suisse",
    heroSubtitle: "Pratiques, guides et témoignages pour prendre soin de vous — corps, âme et esprit.",
    emptyTitle: "Aucun article pour l'instant",
    emptySubtitle: "Revenez bientôt !",
    featured: "À la une",
    readArticle: "Lire l'article",
    read: "Lire",
    categoryComingSoon: "Bientôt des articles dans cette catégorie.",
    categoryEmpty: (name) => `Aucun article publié dans « ${name} » pour le moment.`,
    seeAllBlog: "Voir tout le blog",
    notFoundTitle: "Article introuvable",
    notFoundSubtitle: "Cet article n'existe pas ou n'est plus disponible.",
    backToBlog: "Retour au blog",
    readTime: (count) => `${count} min de lecture`,
    languageFallback: (lang) => `Cet article n'est pas encore disponible en ${lang} — affiché en français.`,
    ctaTitle: "Trouver un thérapeute en Suisse",
    ctaSubtitle: "Découvrez nos praticiens holistiques qualifiés, partout en Suisse.",
    ctaButton: "Voir les thérapeutes",
    allArticles: "Tous les articles",
    categoryCount: (count) => `${count} article${count > 1 ? "s" : ""} disponible${count > 1 ? "s" : ""}`,
  },
  de: {
    navBlog: "Blog",
    badge: "Wellness-Blog",
    heroTitlePart1: "Wellness-Blog:",
    heroTitleHighlight: "ganzheitliche Therapien in der Schweiz",
    heroSubtitle: "Praktiken, Leitfäden und Erfahrungsberichte für Ihr Wohlbefinden — Körper, Seele und Geist.",
    emptyTitle: "Noch keine Artikel",
    emptySubtitle: "Schauen Sie bald wieder vorbei!",
    featured: "Im Fokus",
    readArticle: "Artikel lesen",
    read: "Lesen",
    categoryComingSoon: "Bald erscheinen Artikel in dieser Kategorie.",
    categoryEmpty: (name) => `Derzeit ist kein Artikel in « ${name} » veröffentlicht.`,
    seeAllBlog: "Gesamten Blog ansehen",
    notFoundTitle: "Artikel nicht gefunden",
    notFoundSubtitle: "Dieser Artikel existiert nicht oder ist nicht mehr verfügbar.",
    backToBlog: "Zurück zum Blog",
    readTime: (count) => `${count} Min. Lesezeit`,
    languageFallback: (lang) => `Dieser Artikel ist noch nicht auf ${lang} verfügbar — angezeigt wird Französisch.`,
    ctaTitle: "Therapeuten in der Schweiz finden",
    ctaSubtitle: "Entdecken Sie qualifizierte ganzheitliche Praktizierende in der ganzen Schweiz.",
    ctaButton: "Therapeuten ansehen",
    allArticles: "Alle Artikel",
    categoryCount: (count) => `${count} Artikel verfügbar`,
  },
  it: {
    navBlog: "Blog",
    badge: "Blog benessere",
    heroTitlePart1: "Blog benessere:",
    heroTitleHighlight: "terapie olistiche in Svizzera",
    heroSubtitle: "Pratiche, guide e testimonianze per prenderti cura di te — corpo, anima e mente.",
    emptyTitle: "Ancora nessun articolo",
    emptySubtitle: "Torna presto a trovarci!",
    featured: "In evidenza",
    readArticle: "Leggi l'articolo",
    read: "Leggi",
    categoryComingSoon: "Presto arriveranno articoli in questa categoria.",
    categoryEmpty: (name) => `Nessun articolo pubblicato in « ${name} » per il momento.`,
    seeAllBlog: "Vedi tutto il blog",
    notFoundTitle: "Articolo non trovato",
    notFoundSubtitle: "Questo articolo non esiste o non è più disponibile.",
    backToBlog: "Torna al blog",
    readTime: (count) => `${count} min di lettura`,
    languageFallback: (lang) => `Questo articolo non è ancora disponibile in ${lang} — viene mostrato in francese.`,
    ctaTitle: "Trova un terapeuta in Svizzera",
    ctaSubtitle: "Scopri praticanti olistici qualificati in tutta la Svizzera.",
    ctaButton: "Vedi i terapeuti",
    allArticles: "Tutti gli articoli",
    categoryCount: (count) => `${count} articol${count === 1 ? "o" : "i"} disponibil${count === 1 ? "e" : "i"}`,
  },
  en: {
    navBlog: "Blog",
    badge: "Wellness blog",
    heroTitlePart1: "Wellness blog:",
    heroTitleHighlight: "holistic therapies in Switzerland",
    heroSubtitle: "Practices, guides and first-hand stories to care for yourself — body, soul and mind.",
    emptyTitle: "No articles yet",
    emptySubtitle: "Please check back soon!",
    featured: "Featured",
    readArticle: "Read article",
    read: "Read",
    categoryComingSoon: "Articles in this category are coming soon.",
    categoryEmpty: (name) => `No articles published in “${name}” yet.`,
    seeAllBlog: "View the full blog",
    notFoundTitle: "Article not found",
    notFoundSubtitle: "This article does not exist or is no longer available.",
    backToBlog: "Back to blog",
    readTime: (count) => `${count} min read`,
    languageFallback: (lang) => `This article is not available in ${lang} yet — shown in French.`,
    ctaTitle: "Find a therapist in Switzerland",
    ctaSubtitle: "Discover qualified holistic practitioners throughout Switzerland.",
    ctaButton: "View therapists",
    allArticles: "All articles",
    categoryCount: (count) => `${count} article${count > 1 ? "s" : ""} available`,
  },
};

export function blogCopy(lang: string | undefined): BlogCopy {
  return BLOG_COPY[(lang as BlogLang) || "fr"] ?? BLOG_COPY.fr;
}