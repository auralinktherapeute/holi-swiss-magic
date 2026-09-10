/**
 * « Le fil Holiswiss » — source de contenu éditoriale.
 *
 * Volontairement en fichier de données : ajouter une publication = ajouter un
 * objet dans `FIL_POSTS`, sans toucher au code des pages. Le jour où ces
 * contenus viendront de la base, seules les fonctions ci-dessous changeront.
 */

export type FilLang = "fr" | "de" | "it" | "en";

export type FilCategory = {
  slug: string;
  label: Record<FilLang, string>;
};

/** Catégories initiales — en ajouter d'autres ici suffit. */
export const FIL_CATEGORIES: FilCategory[] = [
  { slug: "nouveautes", label: { fr: "Nouveautés", de: "Neuheiten", it: "Novità", en: "What's new" } },
  { slug: "actualites", label: { fr: "Actualités", de: "Aktuelles", it: "Attualità", en: "News" } },
  { slug: "partenariats", label: { fr: "Partenariats", de: "Partnerschaften", it: "Partnership", en: "Partnerships" } },
  { slug: "portraits", label: { fr: "Portraits", de: "Porträts", it: "Ritratti", en: "Portraits" } },
  { slug: "conseils", label: { fr: "Conseils", de: "Ratgeber", it: "Consigli", en: "Tips" } },
  { slug: "holiswiss", label: { fr: "Holiswiss", de: "Holiswiss", it: "Holiswiss", en: "Holiswiss" } },
];

export function filCategoryLabel(slug: string, lang: FilLang): string {
  const c = FIL_CATEGORIES.find((x) => x.slug === slug);
  return c ? (c.label[lang] ?? c.label.fr) : slug;
}

export type FilPost = {
  id: string;
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  /** Markdown léger (## titres, listes, **gras**) — rendu par ArticleContent. */
  content: string;
  image?: string | null;
  imageAlt?: string;
  date: string; // ISO
  author?: string | null;
  status: "published" | "draft";
  featured?: boolean;
  seoTitle?: string;
  seoDescription?: string;
};

/** Exemples de démonstration — remplaçables un par un. */
export const FIL_POSTS: FilPost[] = [
  {
    id: "fil-001",
    slug: "holiswiss-evolue-nouvelles-fonctionnalites",
    category: "nouveautes",
    title: "Holiswiss évolue : de nouvelles fonctionnalités arrivent",
    excerpt:
      "Agenda, facturation, fiches clients : les outils du quotidien des thérapeutes s'enrichissent, avec la même exigence de simplicité.",
    content: `Holiswiss continue de grandir avec celles et ceux qui l'utilisent chaque jour. Les prochaines semaines apportent une série d'améliorations pensées à partir de vos retours.

## Ce qui change
- Un agenda plus lisible, avec les actions essentielles à portée de clic.
- Une facturation suisse conforme, générée en quelques secondes.
- Des fiches clients complètes, reliées aux rendez-vous et aux notes de séance.

## Notre ligne directrice
Chaque nouveauté doit faire gagner du temps sans ajouter de complexité. Rien n'est ajouté qui ne serve directement la pratique.

> Un outil réussi est un outil qu'on oublie : il laisse toute la place à la relation avec la personne accompagnée.`,
    image: null,
    date: "2026-09-02",
    author: "L'équipe Holiswiss",
    status: "published",
    featured: true,
  },
  {
    id: "fil-002",
    slug: "holiswiss-nouveaux-partenaires-vision-commune",
    category: "partenariats",
    title: "Holiswiss et ses nouveaux partenaires : une vision commune",
    excerpt:
      "Des collaborations choisies avec soin, autour d'une même idée : rendre les approches complémentaires accessibles et lisibles en Suisse.",
    content: `Nous nouons des partenariats avec des acteurs qui partagent notre exigence : qualité de l'accompagnement, transparence et respect des personnes.

## Pourquoi ces collaborations
- Faire connaître des pratiques sérieuses auprès du grand public.
- Offrir aux thérapeutes des ressources concrètes.
- Renforcer la confiance autour des approches complémentaires.

Les prochaines annonces seront publiées ici, dans le fil.`,
    image: null,
    date: "2026-08-21",
    author: "L'équipe Holiswiss",
    status: "published",
  },
  {
    id: "fil-003",
    slug: "a-la-rencontre-d-un-therapeute-holiswiss",
    category: "portraits",
    title: "À la rencontre d'un thérapeute Holiswiss",
    excerpt:
      "Parcours, pratique, convictions : nous donnons la parole aux thérapeutes qui font vivre l'annuaire.",
    content: `Derrière chaque profil, il y a une histoire. Dans cette série de portraits, nous rencontrons des thérapeutes établis en Suisse et nous les écoutons parler de leur métier.

## Au programme
- Le chemin qui les a menés à leur pratique.
- Ce qu'ils observent chez les personnes accompagnées.
- Un conseil simple pour bien choisir son thérapeute.

Vous souhaitez apparaître dans un prochain portrait ? Écrivez-nous depuis votre espace thérapeute.`,
    image: null,
    date: "2026-08-12",
    author: "La rédaction",
    status: "published",
  },
  {
    id: "fil-004",
    slug: "comment-choisir-une-approche-therapeutique-adaptee",
    category: "conseils",
    title: "Comment choisir une approche thérapeutique adaptée ?",
    excerpt:
      "Quelques repères simples pour s'orienter parmi les approches complémentaires, sans se perdre dans les intitulés.",
    content: `Face à la diversité des approches, le choix peut sembler intimidant. Voici des repères concrets.

## Partir de son besoin
- Détente et récupération, douleurs physiques, stress, période de transition : le besoin oriente la famille d'approches.

## Vérifier le cadre
- Formation, expérience, reconnaissance éventuelle par les assurances complémentaires.
- Clarté sur les tarifs et la durée des séances.

## Faire confiance au premier contact
La qualité de la relation compte autant que la technique. Un premier échange suffit souvent à savoir si le courant passe.`,
    image: null,
    date: "2026-07-30",
    author: "La rédaction",
    status: "published",
  },
];

export function publishedFilPosts(): FilPost[] {
  return FIL_POSTS.filter((p) => p.status === "published").sort(
    (a, b) => +new Date(b.date) - +new Date(a.date),
  );
}

export function featuredFilPost(): FilPost | null {
  const posts = publishedFilPosts();
  return posts.find((p) => p.featured) ?? posts[0] ?? null;
}

export function filPostBySlug(slug: string): FilPost | null {
  return publishedFilPosts().find((p) => p.slug === slug) ?? null;
}

/** Catégories réellement utilisées par au moins une publication publiée. */
export function usedFilCategories(): Array<{ slug: string; count: number }> {
  const counts = new Map<string, number>();
  for (const p of publishedFilPosts()) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  return FIL_CATEGORIES.filter((c) => counts.has(c.slug)).map((c) => ({
    slug: c.slug,
    count: counts.get(c.slug)!,
  }));
}

export function relatedFilPosts(post: FilPost, limit = 3): FilPost[] {
  const others = publishedFilPosts().filter((p) => p.slug !== post.slug);
  const same = others.filter((p) => p.category === post.category);
  return [...same, ...others.filter((p) => p.category !== post.category)].slice(0, limit);
}

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
    featuredLabel: "À découvrir",
    all: "Tout",
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
    featuredLabel: "Entdecken",
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
    featuredLabel: "Da scoprire",
    all: "Tutto",
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
    featuredLabel: "Featured",
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
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}
