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

// Extended therapy specialties (holistic + manual + energetic + psycho-emotional)
export const THERAPY_SPECIALTIES: string[] = [
  "Énergéticien", "Magnétiseur", "Sophrologue", "Hypnothérapeute",
  "Naturopathe", "Ostéopathe", "Réflexologue", "Kinésiologue",
  "Acupuncteur", "Praticien Shiatsu", "Praticien Reiki", "Lithothérapeute",
  "Radiesthésiste", "Médium", "Cartomancien", "Coach holistique",
  "Art-thérapeute", "Aromathérapeute", "Phytothérapeute", "Fleurs de Bach",
  "Praticien Méditation", "Yoga thérapeutique", "Ayurveda",
  "Massage californien", "Massage suédois", "Massage thaï", "Massage lomi-lomi",
  "Drainage lymphatique", "Réflexologie plantaire", "Fasciathérapie",
  "Biorésonance", "EFT", "EMDR", "PNL", "Somatothérapie",
  "Gestalt-thérapie", "Analyse transactionnelle", "Constellation familiale",
  "Hypnose ericksonienne", "Respiration holotropique", "Sound healing",
  "Chamanisme", "Soins esséniens", "Biomagnétisme", "Acupressure",
  "Reboutement", "Iridologie", "Numérologie", "Médecine chinoise",
  "Médecine ayurvédique", "Tarot thérapeutique",
];

export type TherapistService = {
  id: string;
  name: string;
  duration_min: number;
  description?: string;
  color?: string;
  price_chf?: number;
  format?: "in_person" | "online" | "hybrid";
  kind?: "session" | "package";
  short_description?: string;
  visible?: boolean;
};

// Swiss recognized organizations that approve complementary therapists for
// reimbursement by supplementary health insurance.
export const ACCREDITATION_ORGS: { code: string; label: string; description: string }[] = [
  { code: "ASCA", label: "ASCA", description: "Fondation suisse pour les médecines complémentaires" },
  { code: "RME", label: "RME / EMR", description: "Registre de Médecine Empirique" },
  { code: "OrTraTC", label: "OrTra TC", description: "Organisation faîtière du monde du travail Thérapie Complémentaire" },
  { code: "NVS", label: "NVS", description: "Naturärzte Vereinigung der Schweiz" },
  { code: "APTN", label: "APTN", description: "Association Professionnelle des Thérapeutes Naturopathes" },
  { code: "SBO-TCM", label: "SBO-TCM", description: "Schweizer Berufsorganisation für TCM" },
  { code: "ASMG", label: "ASMG", description: "Association Suisse de Médecine Globale" },
  { code: "ASNB", label: "ASNB", description: "Association Suisse de Naturopathie" },
];

export type Accreditation = {
  org: string;
  number?: string;
};

// Swiss IDE / UID format: CHE-XXX.XXX.XXX (9 digits after CHE-)
export const SWISS_IDE_REGEX = /^CHE-?\d{3}\.?\d{3}\.?\d{3}$/i;

export function normalizeSwissIde(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length !== 9) return null;
  return `CHE-${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}`;
}