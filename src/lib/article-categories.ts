// Catalogue centralisé des catégories d'articles HoliSwiss.
// La table `public.article_categories` est la source de vérité en base ;
// ce fichier est sa miroir frontend pour pouvoir rendre labels et groupes
// sans aller-retour réseau (SSR friendly).

export type Lang = "fr" | "de" | "it" | "en";

export type ArticleCategory = {
  slug: string;
  name_fr: string;
  name_de: string;
  name_it: string;
  name_en: string;
  parent: GroupKey;
};

export type GroupKey =
  | "corporelles"
  | "energetiques"
  | "psycho"
  | "naturelles"
  | "bien-etre";

export const GROUP_LABELS: Record<GroupKey, Record<Lang, string>> = {
  corporelles: {
    fr: "Approches corporelles",
    de: "Körperliche Ansätze",
    it: "Approcci corporei",
    en: "Body-based approaches",
  },
  energetiques: {
    fr: "Approches énergétiques",
    de: "Energetische Ansätze",
    it: "Approcci energetici",
    en: "Energy approaches",
  },
  psycho: {
    fr: "Approches psycho-émotionnelles",
    de: "Psycho-emotionale Ansätze",
    it: "Approcci psico-emotivi",
    en: "Psycho-emotional approaches",
  },
  naturelles: {
    fr: "Médecines naturelles",
    de: "Naturmedizin",
    it: "Medicine naturali",
    en: "Natural medicines",
  },
  "bien-etre": {
    fr: "Bien-être général",
    de: "Allgemeines Wohlbefinden",
    it: "Benessere generale",
    en: "General well-being",
  },
};

export const ARTICLE_CATEGORIES: ArticleCategory[] = [
  // Approches corporelles
  { slug: "massage-bien-etre", name_fr: "Massage bien-être", name_de: "Wellness-Massage", name_it: "Massaggio benessere", name_en: "Wellness massage", parent: "corporelles" },
  { slug: "osteopathie", name_fr: "Ostéopathie", name_de: "Osteopathie", name_it: "Osteopatia", name_en: "Osteopathy", parent: "corporelles" },
  { slug: "kinesitherapie", name_fr: "Kinésithérapie", name_de: "Physiotherapie", name_it: "Fisioterapia", name_en: "Physiotherapy", parent: "corporelles" },
  { slug: "chiropraxie", name_fr: "Chiropraxie", name_de: "Chiropraktik", name_it: "Chiropratica", name_en: "Chiropractic", parent: "corporelles" },
  { slug: "reflexologie", name_fr: "Réflexologie", name_de: "Reflexologie", name_it: "Riflessologia", name_en: "Reflexology", parent: "corporelles" },
  { slug: "shiatsu", name_fr: "Shiatsu", name_de: "Shiatsu", name_it: "Shiatsu", name_en: "Shiatsu", parent: "corporelles" },
  { slug: "tuina", name_fr: "Tuina", name_de: "Tuina", name_it: "Tuina", name_en: "Tuina", parent: "corporelles" },
  { slug: "yoga", name_fr: "Yoga", name_de: "Yoga", name_it: "Yoga", name_en: "Yoga", parent: "corporelles" },
  { slug: "pilates", name_fr: "Pilates", name_de: "Pilates", name_it: "Pilates", name_en: "Pilates", parent: "corporelles" },
  { slug: "tai-chi-qi-gong", name_fr: "Tai Chi / Qi Gong", name_de: "Tai Chi / Qi Gong", name_it: "Tai Chi / Qi Gong", name_en: "Tai Chi / Qi Gong", parent: "corporelles" },
  // Énergétiques
  { slug: "reiki", name_fr: "Reiki", name_de: "Reiki", name_it: "Reiki", name_en: "Reiki", parent: "energetiques" },
  { slug: "magnetisme", name_fr: "Magnétisme", name_de: "Magnetismus", name_it: "Magnetismo", name_en: "Magnetism", parent: "energetiques" },
  { slug: "acupuncture", name_fr: "Acupuncture", name_de: "Akupunktur", name_it: "Agopuntura", name_en: "Acupuncture", parent: "energetiques" },
  { slug: "lithotherapie", name_fr: "Lithothérapie", name_de: "Lithotherapie", name_it: "Litoterapia", name_en: "Lithotherapy", parent: "energetiques" },
  { slug: "cristallotherapie", name_fr: "Cristallothérapie", name_de: "Kristalltherapie", name_it: "Cristalloterapia", name_en: "Crystal therapy", parent: "energetiques" },
  { slug: "sonotherapie", name_fr: "Sonothérapie", name_de: "Klangtherapie", name_it: "Sonoterapia", name_en: "Sound therapy", parent: "energetiques" },
  { slug: "access-bars", name_fr: "Access Bars", name_de: "Access Bars", name_it: "Access Bars", name_en: "Access Bars", parent: "energetiques" },
  { slug: "theta-healing", name_fr: "Theta Healing", name_de: "Theta Healing", name_it: "Theta Healing", name_en: "Theta Healing", parent: "energetiques" },
  // Psycho-émotionnelles
  { slug: "hypnose", name_fr: "Hypnose", name_de: "Hypnose", name_it: "Ipnosi", name_en: "Hypnosis", parent: "psycho" },
  { slug: "sophrologie", name_fr: "Sophrologie", name_de: "Sophrologie", name_it: "Sofrologia", name_en: "Sophrology", parent: "psycho" },
  { slug: "coaching", name_fr: "Coaching", name_de: "Coaching", name_it: "Coaching", name_en: "Coaching", parent: "psycho" },
  { slug: "pnl", name_fr: "PNL", name_de: "NLP", name_it: "PNL", name_en: "NLP", parent: "psycho" },
  { slug: "emdr", name_fr: "EMDR", name_de: "EMDR", name_it: "EMDR", name_en: "EMDR", parent: "psycho" },
  { slug: "tcc", name_fr: "TCC", name_de: "KVT", name_it: "TCC", name_en: "CBT", parent: "psycho" },
  { slug: "psychotherapie", name_fr: "Psychothérapie", name_de: "Psychotherapie", name_it: "Psicoterapia", name_en: "Psychotherapy", parent: "psycho" },
  { slug: "art-therapie", name_fr: "Art-thérapie", name_de: "Kunsttherapie", name_it: "Arteterapia", name_en: "Art therapy", parent: "psycho" },
  // Médecines naturelles
  { slug: "naturopathie", name_fr: "Naturopathie", name_de: "Naturheilkunde", name_it: "Naturopatia", name_en: "Naturopathy", parent: "naturelles" },
  { slug: "aromatherapie", name_fr: "Aromathérapie", name_de: "Aromatherapie", name_it: "Aromaterapia", name_en: "Aromatherapy", parent: "naturelles" },
  { slug: "homeopathie", name_fr: "Homéopathie", name_de: "Homöopathie", name_it: "Omeopatia", name_en: "Homeopathy", parent: "naturelles" },
  { slug: "phytotherapie", name_fr: "Phytothérapie", name_de: "Phytotherapie", name_it: "Fitoterapia", name_en: "Phytotherapy", parent: "naturelles" },
  { slug: "ayurveda", name_fr: "Ayurveda", name_de: "Ayurveda", name_it: "Ayurveda", name_en: "Ayurveda", parent: "naturelles" },
  { slug: "medecine-traditionnelle-chinoise", name_fr: "Médecine Traditionnelle Chinoise", name_de: "Traditionelle Chinesische Medizin", name_it: "Medicina Tradizionale Cinese", name_en: "Traditional Chinese Medicine", parent: "naturelles" },
  // Bien-être général
  { slug: "meditation", name_fr: "Méditation", name_de: "Meditation", name_it: "Meditazione", name_en: "Meditation", parent: "bien-etre" },
  { slug: "mindfulness", name_fr: "Mindfulness", name_de: "Achtsamkeit", name_it: "Mindfulness", name_en: "Mindfulness", parent: "bien-etre" },
  { slug: "nutrition-sante", name_fr: "Nutrition & Santé", name_de: "Ernährung & Gesundheit", name_it: "Nutrizione & Salute", name_en: "Nutrition & Health", parent: "bien-etre" },
  { slug: "bien-etre", name_fr: "Bien-être général", name_de: "Allgemeines Wohlbefinden", name_it: "Benessere generale", name_en: "General well-being", parent: "bien-etre" },
  { slug: "developpement-personnel", name_fr: "Développement personnel", name_de: "Persönliche Entwicklung", name_it: "Sviluppo personale", name_en: "Personal development", parent: "bien-etre" },
  { slug: "spiritualite", name_fr: "Spiritualité", name_de: "Spiritualität", name_it: "Spiritualità", name_en: "Spirituality", parent: "bien-etre" },
];

export const GROUP_ORDER: GroupKey[] = ["corporelles", "energetiques", "psycho", "naturelles", "bien-etre"];

export function categoryLabel(slug: string | null | undefined, lang: Lang = "fr"): string {
  if (!slug) return "";
  const cat = ARTICLE_CATEGORIES.find((c) => c.slug === slug);
  if (!cat) return slug;
  return cat[`name_${lang}` as const] || cat.name_fr;
}

export function getCategory(slug: string | null | undefined): ArticleCategory | undefined {
  if (!slug) return undefined;
  return ARTICLE_CATEGORIES.find((c) => c.slug === slug);
}

export function groupedCategories(lang: Lang = "fr") {
  return GROUP_ORDER.map((g) => ({
    key: g,
    label: GROUP_LABELS[g][lang],
    items: ARTICLE_CATEGORIES
      .filter((c) => c.parent === g)
      .slice()
      .sort((a, b) => (a[`name_${lang}` as const] || a.name_fr).localeCompare(b[`name_${lang}` as const] || b.name_fr, lang)),
  }));
}