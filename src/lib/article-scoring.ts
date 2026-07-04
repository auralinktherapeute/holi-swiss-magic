// Modular SEO + GEO scoring for HoliSwiss articles.
// Pure functions — easy to evolve later.

export const SWISS_CANTONS = [
  "Vaud", "Genève", "Geneve", "Valais", "Fribourg", "Neuchâtel", "Neuchatel",
  "Jura", "Berne", "Bern", "Zurich", "Zürich", "Lucerne", "Luzern", "Bâle", "Basel",
  "Saint-Gall", "St. Gallen", "Tessin", "Ticino", "Grisons", "Graubünden",
  "Soleure", "Solothurn", "Schaffhouse", "Schaffhausen", "Thurgovie", "Thurgau",
  "Argovie", "Aargau", "Glaris", "Glarus", "Uri", "Schwyz", "Obwald", "Obwalden",
  "Nidwald", "Nidwalden", "Appenzell", "Zoug", "Zug",
];

export const SWISS_CITIES = [
  "Lausanne", "Genève", "Geneve", "Zurich", "Zürich", "Bâle", "Basel", "Berne", "Bern",
  "Lugano", "Locarno", "Bellinzone", "Bellinzona", "Sion", "Martigny", "Montreux",
  "Vevey", "Nyon", "Morges", "Yverdon", "Fribourg", "Neuchâtel", "Neuchatel",
  "Bienne", "Biel", "Thoune", "Thun", "Coire", "Chur", "Saint-Gall", "St. Gallen",
  "Winterthour", "Winterthur", "Lucerne", "Luzern", "Aarau", "Delémont", "Delemont",
  "Schaffhouse", "Schaffhausen", "Zoug", "Zug",
];

const SWISS_KEYWORDS = [
  "suisse", "swiss", "schweiz", "svizzera", "romande", "romandie",
  "lac léman", "lac leman", "alpes suisses", "helvétique", "helvetique",
];

export interface ChecklistItem {
  key: string;
  label: string;
  ok: boolean;
  hint?: string;
}

export interface SeoResult {
  score: number;          // 0-100
  checklist: ChecklistItem[];
}

export interface GeoResult {
  score: number;          // 0-100
  cities: string[];
  cantons: string[];
  keywords: string[];
}

type ArticleLike = {
  title_fr?: string | null;
  body_fr?: string | null;
  excerpt_fr?: string | null;
  meta_title_fr?: string | null;
  meta_description_fr?: string | null;
  slug?: string | null;
  cover_image_url?: string | null;
  image_alt_text?: string | null;
  category?: string | null;
};

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

export function computeSeo(a: ArticleLike): SeoResult {
  const title = (a.title_fr ?? "").trim();
  const body = (a.body_fr ?? "").trim();
  const meta = (a.meta_description_fr ?? a.excerpt_fr ?? "").trim();
  const slug = (a.slug ?? "").trim();
  const wc = wordCount(body);
  const slugClean = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
  const altPresent = /!\[[^\]]+\]\(/.test(body); // markdown image with alt
  const coverAltPresent = !!(a.image_alt_text && a.image_alt_text.trim().length > 0);
  const internalLinks = countMatches(body, /\[[^\]]+\]\(\/[^)]+\)/g);
  const h2 = countMatches(body, /^##\s+/gm);
  const h3 = countMatches(body, /^###\s+/gm);
  const titleLen = title.length;
  const metaLen = meta.length;

  // primary keyword = category (lowercased) or first significant word in title
  const kw = (a.category ?? title.split(/\s+/).filter((w) => w.length > 4)[0] ?? "")
    .toLowerCase();
  const titleHasKw = kw.length > 2 && title.toLowerCase().includes(kw);

  // GEO mention in body
  const lower = (title + " " + body).toLowerCase();
  const cityMention = SWISS_CITIES.some((c) => lower.includes(c.toLowerCase()));
  const cantonMention = SWISS_CANTONS.some((c) => lower.includes(c.toLowerCase()));

  // Readability heuristic — avg sentence length 12-22 words is good
  const sentences = body.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgSentence = sentences.length ? wc / sentences.length : 0;
  const readabilityOk = avgSentence >= 10 && avgSentence <= 25;

  const checklist: ChecklistItem[] = [
    { key: "title", label: "Titre optimisé (50–60 caractères)", ok: titleLen >= 50 && titleLen <= 60, hint: `Actuel : ${titleLen} car.` },
    { key: "meta", label: "Meta description (150–160 caractères)", ok: metaLen >= 150 && metaLen <= 160, hint: `Actuel : ${metaLen} car.` },
    { key: "slug", label: "Slug URL propre", ok: slugClean && slug.length > 0, hint: slug || "manquant" },
    { key: "image", label: "Image principale + alt text", ok: !!a.cover_image_url && coverAltPresent, hint: !a.cover_image_url ? "Pas de cover" : coverAltPresent ? "OK" : "Alt text de l'image manquant" },
    { key: "body_alt", label: "Images du contenu avec alt", ok: !altPresent ? true : altPresent, hint: altPresent ? "OK" : "—" },
    { key: "internal", label: "Au moins 1 lien interne", ok: internalLinks >= 1, hint: `${internalLinks} lien(s)` },
    { key: "words", label: "Au moins 300 mots", ok: wc >= 300, hint: `${wc} mots` },
    { key: "kw_title", label: "Mot-clé principal dans le titre", ok: titleHasKw, hint: kw ? `« ${kw} »` : "—" },
    { key: "geo", label: "Ville ou canton mentionné (GEO)", ok: cityMention || cantonMention },
    { key: "structure", label: "H2 / H3 structurés", ok: h2 >= 2 && h3 >= 1, hint: `${h2} H2 / ${h3} H3` },
    { key: "readability", label: "Score de lisibilité correct", ok: readabilityOk, hint: sentences.length ? `Phrase moy. ${avgSentence.toFixed(1)} mots` : "—" },
  ];

  const okCount = checklist.filter((c) => c.ok).length;
  const score = Math.round((okCount / checklist.length) * 100);
  return { score, checklist };
}

export function computeGeo(a: ArticleLike): GeoResult {
  const text = ((a.title_fr ?? "") + " " + (a.body_fr ?? "") + " " + (a.excerpt_fr ?? "")).toLowerCase();
  if (!text.trim()) return { score: 0, cities: [], cantons: [], keywords: [] };

  const cities = SWISS_CITIES.filter((c) => text.includes(c.toLowerCase()));
  const cantons = SWISS_CANTONS.filter((c) => text.includes(c.toLowerCase()));
  const keywords = SWISS_KEYWORDS.filter((k) => text.includes(k));

  // dedupe (cities/cantons may overlap e.g. Genève)
  const cityUniq = Array.from(new Set(cities.map((c) => c.toLowerCase())));
  const cantonUniq = Array.from(new Set(cantons.map((c) => c.toLowerCase())));

  // Scoring: cities 40 pts (cap 4×10), cantons 30 pts (cap 3×10), keywords 30 pts (cap 3×10)
  const cityScore = Math.min(cityUniq.length, 4) * 10;
  const cantonScore = Math.min(cantonUniq.length, 3) * 10;
  const kwScore = Math.min(keywords.length, 3) * 10;
  const score = Math.min(100, cityScore + cantonScore + kwScore);

  return { score, cities: cityUniq, cantons: cantonUniq, keywords };
}

export function scoreColor(s: number): { bg: string; text: string; border: string; label: string; emoji: string } {
  if (s >= 80) return { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/40", label: "Bon", emoji: "✅" };
  if (s >= 50) return { bg: "bg-orange-500/15", text: "text-orange-300", border: "border-orange-500/40", label: "À améliorer", emoji: "⚠️" };
  return { bg: "bg-red-500/15", text: "text-red-300", border: "border-red-500/40", label: "Faible", emoji: "❌" };
}