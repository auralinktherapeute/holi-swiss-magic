// Swiss cantons (official 26)
export const CANTONS: { code: string; name: string }[] = [
  { code: "AG", name: "Argovie" }, { code: "AI", name: "Appenzell Rh.-Int." },
  { code: "AR", name: "Appenzell Rh.-Ext." }, { code: "BE", name: "Berne" },
  { code: "BL", name: "Bâle-Campagne" }, { code: "BS", name: "Bâle-Ville" },
  { code: "FR", name: "Fribourg" }, { code: "GE", name: "Genève" },
  { code: "GL", name: "Glaris" }, { code: "GR", name: "Grisons" },
  { code: "JU", name: "Jura" }, { code: "LU", name: "Lucerne" },
  { code: "NE", name: "Neuchâtel" }, { code: "NW", name: "Nidwald" },
  { code: "OW", name: "Obwald" }, { code: "SG", name: "Saint-Gall" },
  { code: "SH", name: "Schaffhouse" }, { code: "SO", name: "Soleure" },
  { code: "SZ", name: "Schwytz" }, { code: "TG", name: "Thurgovie" },
  { code: "TI", name: "Tessin" }, { code: "UR", name: "Uri" },
  { code: "VD", name: "Vaud" }, { code: "VS", name: "Valais" },
  { code: "ZG", name: "Zoug" }, { code: "ZH", name: "Zurich" },
];

// 18 approches bien-être — formulation conforme LPMéd (vocabulaire interdit exclu)
export const THERAPY_CATEGORIES: { slug: string; label: string; emoji: string }[] = [
  { slug: "sophrologie", label: "Sophrologie", emoji: "🧘" },
  { slug: "hypnose", label: "Hypnose", emoji: "✨" },
  { slug: "naturopathie", label: "Naturopathie", emoji: "🌿" },
  { slug: "reflexologie", label: "Réflexologie", emoji: "🦶" },
  { slug: "massage-bien-etre", label: "Massage bien-être", emoji: "💆" },
  { slug: "shiatsu", label: "Shiatsu", emoji: "🌀" },
  { slug: "reiki", label: "Reiki", emoji: "🕯️" },
  { slug: "kinesiologie", label: "Kinésiologie", emoji: "🤲" },
  { slug: "acupuncture", label: "Acupuncture", emoji: "🪡" },
  { slug: "osteopathie", label: "Ostéopathie", emoji: "🦴" },
  { slug: "psychotherapie", label: "Accompagnement psy", emoji: "💬" },
  { slug: "coaching", label: "Coaching de vie", emoji: "🎯" },
  { slug: "meditation", label: "Méditation", emoji: "🧠" },
  { slug: "yoga", label: "Yoga", emoji: "🧎" },
  { slug: "art-therapie", label: "Art-thérapie", emoji: "🎨" },
  { slug: "aromatherapie", label: "Aromathérapie", emoji: "🌸" },
  { slug: "phytotherapie", label: "Phytothérapie", emoji: "🍃" },
  { slug: "fleurs-de-bach", label: "Fleurs de Bach", emoji: "🌼" },
];

export const SPOKEN_LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "en", label: "English" },
];

export const LANGS = [
  { code: "fr", label: "FR", flag: "🇫🇷" },
  { code: "de", label: "DE", flag: "🇩🇪" },
  { code: "it", label: "IT", flag: "🇮🇹" },
  { code: "en", label: "EN", flag: "🇬🇧" },
] as const;

export const formatCHF = (n: number) =>
  new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(n);