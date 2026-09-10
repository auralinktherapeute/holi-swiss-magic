/**
 * « Le fil Holiswiss » — libellés et catégories de la rubrique.
 *
 * Les CONTENUS ne vivent pas ici : ils sont gérés depuis l'administration
 * existante (Admin → Articles), dans la table `articles`. Une publication du
 * fil est simplement un article dont la catégorie fait partie de
 * `FIL_CATEGORY_SLUGS` (préfixe `fil-`). Ce fichier est le miroir frontend des
 * lignes correspondantes de `article_categories`.
 */

export type FilLang = "fr" | "de" | "it" | "en";

export type FilCategory = {
  slug: string;
  label: Record<FilLang, string>;
};

/** Catégories du fil — miroir de `article_categories` (parent_category = 'fil'). */
export const FIL_CATEGORIES: FilCategory[] = [
  { slug: "fil-nouveautes", label: { fr: "Nouveautés", de: "Neuigkeiten", it: "Novità", en: "What's new" } },
  { slug: "fil-actualites", label: { fr: "Actualités", de: "Aktuelles", it: "Attualità", en: "News" } },
  { slug: "fil-partenariats", label: { fr: "Partenariats", de: "Partnerschaften", it: "Partnership", en: "Partnerships" } },
  { slug: "fil-portraits", label: { fr: "Portraits", de: "Porträts", it: "Ritratti", en: "Portraits" } },
  { slug: "fil-conseils", label: { fr: "Conseils", de: "Ratgeber", it: "Consigli", en: "Tips" } },
  { slug: "fil-holiswiss", label: { fr: "Holiswiss", de: "Holiswiss", it: "Holiswiss", en: "Holiswiss" } },
];

export const FIL_CATEGORY_SLUGS: string[] = FIL_CATEGORIES.map((c) => c.slug);

export function isFilCategory(slug: string | null | undefined): boolean {
  return !!slug && FIL_CATEGORY_SLUGS.includes(slug);
}

export function filCategoryLabel(slug: string, lang: FilLang): string {
  const c = FIL_CATEGORIES.find((x) => x.slug === slug);
  return c ? (c.label[lang] ?? c.label.fr) : slug;
}

/** Forme normalisée d'une publication du fil (projection d'une ligne `articles`). */
export type FilPost = {
  id: string;
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  /** Markdown léger — rendu par `ArticleContent`. */
  content: string;
  image?: string | null;
  imageAlt?: string;
  date: string; // ISO
  author?: string | null;
  featured?: boolean;
  seoTitle?: string;
  seoDescription?: string;
};

/** Libellés d'interface de la rubrique, dans les 4 langues du site. */
export const FIL_COPY: Record<FilLang, {
  kicker: string;
  title: string;
  subtitle: string;
  featuredLabel: string;
  all: string;
  discover: string;
  back: string;
  related: string;
  empty: string;
  by: string;
  metaTitle: string;
  metaDescription: string;
}> = {
  fr: {
    kicker: "L'univers Holiswiss",
    title: "Le fil Holiswiss",
    subtitle: "Les nouveautés, rencontres, collaborations et actualités qui font vivre Holiswiss.",
    featuredLabel: "En ce moment chez Holiswiss",
    all: "Tous",
    discover: "Découvrir",
    back: "Retour au fil Holiswiss",
    related: "À lire aussi",
    empty: "Aucune publication dans cette catégorie pour le moment.",
    by: "Par",
    metaTitle: "Le fil Holiswiss — nouveautés, actualités et collaborations",
    metaDescription:
      "Les nouveautés, rencontres, collaborations et actualités qui font vivre Holiswiss, l'annuaire suisse des thérapeutes complémentaires.",
  },
  de: {
    kicker: "Die Welt von Holiswiss",
    title: "Der Holiswiss-Feed",
    subtitle: "Neuheiten, Begegnungen, Kooperationen und News rund um Holiswiss.",
    featuredLabel: "Aktuell bei Holiswiss",
    all: "Alle",
    discover: "Entdecken",
    back: "Zurück zum Holiswiss-Feed",
    related: "Ebenfalls lesenswert",
    empty: "In dieser Kategorie gibt es derzeit keine Beiträge.",
    by: "Von",
    metaTitle: "Der Holiswiss-Feed — Neuheiten, News und Kooperationen",
    metaDescription:
      "Neuheiten, Begegnungen, Kooperationen und News rund um Holiswiss, das Schweizer Verzeichnis für Komplementärtherapeuten.",
  },
  it: {
    kicker: "L'universo Holiswiss",
    title: "Il filo Holiswiss",
    subtitle: "Novità, incontri, collaborazioni e attualità che animano Holiswiss.",
    featuredLabel: "In questo momento da Holiswiss",
    all: "Tutti",
    discover: "Scopri",
    back: "Torna al filo Holiswiss",
    related: "Da leggere anche",
    empty: "Nessuna pubblicazione in questa categoria per ora.",
    by: "Di",
    metaTitle: "Il filo Holiswiss — novità, attualità e collaborazioni",
    metaDescription:
      "Novità, incontri, collaborazioni e attualità che animano Holiswiss, la directory svizzera dei terapisti complementari.",
  },
  en: {
    kicker: "The Holiswiss universe",
    title: "The Holiswiss feed",
    subtitle: "The news, encounters, partnerships and updates that keep Holiswiss alive.",
    featuredLabel: "Right now at Holiswiss",
    all: "All",
    discover: "Discover",
    back: "Back to the Holiswiss feed",
    related: "Also worth reading",
    empty: "No posts in this category yet.",
    by: "By",
    metaTitle: "The Holiswiss feed — news, updates and partnerships",
    metaDescription:
      "News, encounters, partnerships and updates from Holiswiss, the Swiss directory of complementary therapists.",
  },
};

export function asFilLang(lang: string | undefined): FilLang {
  return (["fr", "de", "it", "en"] as const).includes(lang as FilLang) ? (lang as FilLang) : "fr";
}

export function formatFilDate(iso: string, lang: FilLang): string {
  const locale: Record<FilLang, string> = { fr: "fr-CH", de: "de-CH", it: "it-CH", en: "en-GB" };
  return new Date(iso).toLocaleDateString(locale[lang], { day: "numeric", month: "long", year: "numeric" });
}
