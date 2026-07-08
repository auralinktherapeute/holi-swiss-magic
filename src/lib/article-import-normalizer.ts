function slugifyImport(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 140);
}

function cleanStr(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function normalizeTagsImport(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((t) => cleanStr(t)).filter(Boolean).map(slugifyImport).slice(0, 12);
}

function resolveCategoryImport(input: Record<string, unknown>, title: string): string {
  const explicit = cleanStr(input.category || (input as any).category_slug || (input as any).main_category);
  if (explicit) return slugifyImport(explicit);
  const haystack = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const pairs: Array<[string, string[]]> = [
    ["geobiologie", ["geobiologie", "geobiologue", "habitat sain", "harmonisation lieu"]],
    ["chromotherapie", ["chromotherapie", "luminotherapie", "couleur"]],
    ["magnetisme", ["magnetiseur", "magnetisme"]],
    ["lithotherapie", ["lithotherapie", "cristaux", "pierres"]],
    ["ayurveda", ["ayurveda", "ayurvedique"]],
    ["coaching", ["coach", "coaching"]],
    ["shiatsu", ["shiatsu"]],
    ["hypnose", ["hypnose"]],
    ["massage-bien-etre", ["massage"]],
    ["naturopathie", ["naturopathe", "naturopathie"]],
    ["sophrologie", ["sophrologie"]],
    ["acupuncture", ["acupuncture"]],
    ["meditation", ["meditation"]],
    ["reflexologie", ["reflexologie"]],
    ["yoga", ["yoga"]],
  ];
  return pairs.find(([, needles]) => needles.some((n) => haystack.includes(n)))?.[0] ?? "bien-etre";
}

export function normalizeImportArticle(input: Record<string, unknown>) {
  const title = cleanStr(
    input.title_fr || input.title || (input as any).name || (input as any).h1,
  );
  if (!title) throw new Error("Chaque article doit contenir title_fr ou title.");
  const slug = slugifyImport(cleanStr(input.slug) || title);
  const excerpt = cleanStr(input.excerpt_fr || (input as any).excerpt || (input as any).summary).slice(0, 500);
  const body = cleanStr(
    input.body_fr || (input as any).body || (input as any).markdown || (input as any).content,
  ) || `## ${title}\n\nArticle importé depuis l'Agent Articles GEO/SEO HoliSwiss. À relire et compléter avant publication.`;
  const category = resolveCategoryImport(input, title);
  return {
    slug,
    status: "pending_validation" as const,
    lang: cleanStr(input.lang, "fr") || "fr",
    category,
    title_fr: title,
    excerpt_fr: excerpt || title,
    body_fr: body,
    meta_title_fr:
      cleanStr(input.meta_title_fr || (input as any).meta_title) || title.slice(0, 70),
    meta_description_fr:
      cleanStr(
        input.meta_description_fr || (input as any).meta_description || (input as any).seo_description,
      ).slice(0, 180) ||
      (excerpt || `Article HoliSwiss en attente de validation : ${title}`).slice(0, 180),
    cover_image_url: cleanStr(input.cover_image_url || (input as any).image_url) || null,
    secondary_tags: normalizeTagsImport((input as any).secondary_tags || (input as any).tags),
  };
}