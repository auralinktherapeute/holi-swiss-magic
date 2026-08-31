import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { resolveProfileLang } from "@/lib/seo";
import { cityToSlug } from "@/lib/city-slug";
import { getCategory } from "@/lib/article-categories";
import { isSpecialtyIndexable, isSpecialtyCityIndexable } from "@/lib/seo-thresholds";

const BASE_URL = "https://holiswiss.ch";
const LANGS = ["fr", "de", "it", "en"] as const;

/**
 * Plancher de vraisemblance — détecteur de fumée, pas seuil métier.
 *
 * Un sitemap amputé servi en 200 désindexe en silence. Les garde-fous par
 * requête (`unwrap`) attrapent les erreurs déclarées ; ce plancher attrape le
 * reste — une base qui répond `[]` sans erreur, une jointure qui cesse de
 * ramener ses lignes. Valeur choisie très en dessous du volume réel (585 au
 * 30/08/2026) pour ne jamais se déclencher sur une variation normale, y compris
 * après un éventuel relèvement des seuils de `seo-thresholds.ts` (~437 attendus).
 */
const MIN_EXPECTED_URLS = 200;

/**
 * `lastmod` des pages dont le contenu vit dans le code, pas en base.
 *
 * ⚠️ À BUMPER À LA MAIN quand le contenu de la page change réellement.
 *    Ne pas y mettre la date du build : un `lastmod` qui bouge à chaque
 *    déploiement sans que rien ne change est un signal faux, et Google cesse
 *    alors de faire confiance aux `lastmod` de TOUT le fichier. Mieux vaut une
 *    date ancienne mais vraie.
 *    Valeurs initiales = date du dernier commit du fichier de route
 *    correspondant (`git log -1 --date=short -- src/routes/$lang.<page>.index.tsx`).
 */
const STATIC_PATHS: {
  path: string;
  priority: string;
  changefreq: string;
  /** Date fixe, pour les pages sans contenu en base. */
  lastmod?: string;
  /** Collection dont la fraîcheur fait celle de la page d'index. */
  lastmodFrom?: "all" | "therapists" | "articles" | "paroles" | "events";
}[] = [
  { path: "", priority: "1.0", changefreq: "weekly", lastmodFrom: "all" },
  { path: "/therapeutes", priority: "0.9", changefreq: "daily", lastmodFrom: "therapists" },
  { path: "/blog", priority: "0.8", changefreq: "weekly", lastmodFrom: "articles" },
  { path: "/paroles", priority: "0.8", changefreq: "weekly", lastmodFrom: "paroles" },
  { path: "/evenements", priority: "0.8", changefreq: "daily", lastmodFrom: "events" },
  { path: "/tarifs", priority: "0.7", changefreq: "monthly", lastmod: "2026-07-04" },
  { path: "/faq", priority: "0.6", changefreq: "monthly", lastmod: "2026-08-17" },
  { path: "/contact", priority: "0.5", changefreq: "yearly", lastmod: "2026-07-19" },
  { path: "/impressum", priority: "0.3", changefreq: "yearly", lastmod: "2026-06-24" },
  { path: "/conditions", priority: "0.3", changefreq: "yearly", lastmod: "2026-06-24" },
  { path: "/confidentialite", priority: "0.3", changefreq: "yearly", lastmod: "2026-08-03" },
];

function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function urlBlock(loc: string, lastmod?: string, changefreq?: string, priority?: string) {
  return [
    "  <url>",
    `    <loc>${xmlEscape(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

/** `YYYY-MM-DD` à partir d'un timestamp Supabase, ou `undefined`. */
function day(ts: string | null | undefined): string | undefined {
  return ts ? ts.slice(0, 10) : undefined;
}

/** La plus récente de deux dates `YYYY-MM-DD`, en tolérant les absentes. */
function newer(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

/** Accumulateur de `lastmod` par clé (canton, ville, catégorie, paire…). */
function bump(map: Map<string, string | undefined>, key: string, d: string | undefined) {
  map.set(key, newer(map.get(key), d));
}

/**
 * Lit une réponse Supabase en REFUSANT l'échec silencieux.
 *
 * POURQUOI CETTE FONCTION EXISTE
 *   Le client Supabase ne lève pas : il renvoie `{ data: null, error }`. Le code
 *   de ce fichier déstructurait `const { data } = await …` puis écrivait
 *   `(data ?? [])`. Une erreur transitoire — réseau, RLS, timeout — produisait
 *   donc **zéro URL pour le bloc concerné, un sitemap servi en 200, et pas une
 *   ligne de log**. Le fichier pouvait perdre ses 196 articles sans que
 *   personne ne le voie, jusqu'à ce que Google les désindexe.
 *   Diagnostic du 30/08/2026, §3.3.
 *
 *   Un sitemap partiel est PIRE qu'une absence de sitemap : il déclare
 *   implicitement que le reste n'existe plus. La seule réponse correcte à une
 *   génération incomplète est un 5xx — Google réessaie et conserve la dernière
 *   version connue.
 */
function unwrap<T>(label: string, res: { data: T | null; error: unknown }): T {
  if (res.error) {
    const msg =
      typeof res.error === "object" && res.error !== null && "message" in res.error
        ? String((res.error as { message: unknown }).message)
        : String(res.error);
    throw new Error(`${label} — la base a répondu une erreur : ${msg}`);
  }
  if (res.data === null) {
    throw new Error(`${label} — réponse vide sans erreur déclarée`);
  }
  return res.data;
}

type SpecRow = {
  slug: string;
  slug_de?: string | null;
  slug_it?: string | null;
  slug_en?: string | null;
  updated_at: string | null;
};

type TherapistRow = {
  id: string;
  slug: string | null;
  updated_at: string | null;
  canton: string | null;
  city: string | null;
  languages: string[] | null;
  latitude: number | null;
  longitude: number | null;
};

/**
 * Même règle que `specialtySlugForLang` : slug localisé, sinon repli sur `slug`
 * (qui EST le slug français). Le sitemap et la page doivent nommer la même URL —
 * deux sources qui divergent publient des URL que le site ne sert pas.
 */
function specSlugForLang(
  s: Pick<SpecRow, "slug" | "slug_de" | "slug_it" | "slug_en">,
  lang: string,
) {
  return (
    (lang === "de" ? s.slug_de : lang === "it" ? s.slug_it : lang === "en" ? s.slug_en : null) ||
    s.slug
  );
}

async function buildSitemap(): Promise<string> {
  const urls: string[] = [];

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // ── Familles de spécialités ────────────────────────────────────────────────
  const families = unwrap(
    "sitemap: familles de spécialités",
    await supabaseAdmin.from("specialty_families").select("slug, updated_at"),
  ) as Array<{ slug: string; updated_at: string | null }>;

  // ── Spécialités actives ───────────────────────────────────────────────────
  // Les colonnes de slug localisé peuvent ne pas exister côté base (migration
  // pas encore appliquée) : on replie sur les colonnes de base plutôt que de
  // perdre les ~200 URL de spécialités. Mais si le REPLI échoue aussi, c'est une
  // vraie panne : on lève.
  // Pas encore dans les types générés → cast local.
  let specs: SpecRow[];
  {
    const rich = await (supabaseAdmin as any)
      .from("specialties")
      .select("slug, slug_de, slug_it, slug_en, updated_at")
      .eq("is_active", true);
    specs = rich.error
      ? (unwrap(
          "sitemap: spécialités (repli sans slugs localisés)",
          await (supabaseAdmin as any)
            .from("specialties")
            .select("slug, updated_at")
            .eq("is_active", true),
        ) as SpecRow[])
      : (rich.data as SpecRow[]);
  }

  // ── Praticiens actifs — UNE seule lecture ─────────────────────────────────
  // Ce bloc lisait quatre fois `therapists` avec quatre projections différentes
  // (fiches, canton/ville, cantons pour les événements, villes). Quatre lectures
  // du même ensemble, c'est quatre occasions de diverger et quatre allers-retours
  // dans une route déjà à ~1,5 s de TTFB.
  const therapists = unwrap(
    "sitemap: praticiens actifs",
    await supabaseAdmin
      .from("therapists")
      .select("id, slug, updated_at, canton, city, languages, latitude, longitude")
      .eq("status", "active"),
  ) as unknown as TherapistRow[];

  const therapistById = new Map<string, TherapistRow>();
  for (const t of therapists) therapistById.set(t.id, t);

  const therapistsFreshness = therapists.reduce<string | undefined>(
    (acc, t) => newer(acc, day(t.updated_at)),
    undefined,
  );

  // ── Slug de ville : `cities.slug` fait autorité ───────────────────────────
  //
  // Le sitemap slugifiait `therapists.city` tandis que la page lisait la base :
  // les deux ne coïncidaient que par la grâce du backfill. Un praticien
  // saisissant « Geneve » sans accent aurait suffi à les faire diverger — et à
  // rediriger une URL du sitemap vers une URL absente du sitemap, l'incident du
  // 25/08. La table tranche désormais.
  const citySlugByKey = new Map<string, string>();
  {
    const cityRows = unwrap(
      "sitemap: table cities",
      await (supabaseAdmin as any).from("cities").select("slug, canonical_name, aliases"),
    ) as Array<{ slug: string | null; canonical_name: string | null; aliases: string[] | null }>;
    for (const c of cityRows) {
      if (!c.slug) continue;
      for (const key of [c.canonical_name, ...(c.aliases ?? [])]) {
        const k = cityToSlug(key ?? "");
        if (k && !citySlugByKey.has(k)) citySlugByKey.set(k, c.slug);
      }
    }
  }

  /**
   * Résolution STRICTE : `null` si la ville n'est pas en base.
   *
   * Réservée aux URL dont la route refuse une ville inconnue — aujourd'hui les
   * pages spécialité × ville, dont le loader fait `notFound()` quand
   * `resolve_city` ne renvoie rien.
   */
  const strictCitySlug = (raw: string): string | null => citySlugByKey.get(cityToSlug(raw)) ?? null;

  /**
   * Résolution TOLÉRANTE : repli sur la slugification directe.
   *
   * Réservée aux listings `/therapeutes/ville/{slug}`, dont la route sait
   * afficher une ville absente de `cities` (repli sur le nom titre-casé, 200).
   * La distinction est délibérée : chaque résolution suit ce que sa route
   * SERT réellement. C'est leur confusion qui a produit les 4 × 404.
   */
  const tolerantCitySlug = (raw: string): string => strictCitySlug(raw) ?? cityToSlug(raw);

  // ── Paires spécialité × ville ─────────────────────────────────────────────
  //
  // TROIS conditions, et la troisième est celle qui manquait.
  //
  //   1. spécialité active, praticien actif ;
  //   2. la ville EXISTE dans `cities` — sinon le loader de la page fait
  //      `notFound()` (`$lang.specialites.$specialtySlug.$citySlug.tsx`) et le
  //      sitemap déclarait une URL en 404 ;
  //   3. le praticien PORTE DES COORDONNÉES — car la page ne liste pas les
  //      praticiens par le texte de `therapists.city`, elle les liste par la RPC
  //      `therapists_within_radius(_lat,_lng,30km)`. Un praticien sans
  //      latitude/longitude n'apparaît dans AUCUN rayon : la page serait servie
  //      vide.
  //
  // Cause racine des 4 × 404 du 30/08 (`/{lang}/specialites/hypnose/le-grand-saconnex`) :
  // la fiche de ce praticien n'a ni latitude ni longitude. La migration
  // `20260825140000_cities_slug_foundation.sql` crée les villes manquantes à
  // partir des coordonnées des fiches — elle a donc SAUTÉ cette ville, en
  // silence. Le sitemap se repliait alors sur `cityToSlug()` et publiait
  // l'URL que la route refusait.
  //
  // ⚠️ Créer la ville manquante N'AURAIT PAS corrigé le défaut : la page aurait
  //    répondu 200 avec « 0 thérapeute ». On aurait échangé un 404 franc contre
  //    une page vide indexable — un symptôme contre un autre. La condition
  //    ci-dessous traite la cause : ne déclarer une paire que si la page a
  //    réellement quelqu'un à montrer.
  const pairFreshness = new Map<string, string | undefined>();
  const pairCount = new Map<string, number>();
  const pairSpec = new Map<string, SpecRow>();
  {
    const select = (cols: string) => supabaseAdmin.from("therapist_specialties").select(cols);
    const rich = await select(
      "specialties!inner(slug,slug_de,slug_it,slug_en,is_active), therapists!inner(id,city,status)",
    );
    const geoPairs = (rich.error
      ? unwrap(
          "sitemap: paires spécialité × ville (repli sans slugs localisés)",
          await select("specialties!inner(slug,is_active), therapists!inner(id,city,status)"),
        )
      : rich.data) as unknown as Array<{
      specialties: (SpecRow & { is_active: boolean }) | null;
      therapists: { id: string; city: string | null; status: string | null } | null;
    }>;

    for (const row of geoPairs) {
      const spec = row.specialties;
      const link = row.therapists;
      if (!spec?.slug || !spec.is_active || !link || link.status !== "active") continue;

      // On repasse par la lecture unique des praticiens : c'est elle qui porte
      // les coordonnées, et une seule source évite qu'une projection oublie
      // une colonne au fil des refactos.
      const t = therapistById.get(link.id);
      if (!t || !t.city) continue;
      if (t.latitude === null || t.longitude === null) continue; // condition 3
      const cSlug = strictCitySlug(t.city); // condition 2
      if (!cSlug) continue;

      const key = `${spec.slug}::${cSlug}`;
      pairSpec.set(key, spec);
      pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
      bump(pairFreshness, key, day(t.updated_at));
    }
  }

  // Effectif par spécialité, toutes villes confondues — sert le seuil des pages
  // `/specialites/{spec}`. Recomposé depuis les paires : même source, donc pas
  // de comptage concurrent.
  const specCount = new Map<string, number>();
  for (const [key, n] of pairCount) {
    const slug = key.split("::")[0];
    specCount.set(slug, (specCount.get(slug) ?? 0) + n);
  }

  // ── Blog (projet CMS séparé) ──────────────────────────────────────────────
  // Lu AVANT l'assemblage : la page d'accueil et `/blog` ont besoin de la
  // fraîcheur des articles pour leur `lastmod`.
  type ArticleRow = {
    slug: string;
    slug_de?: string | null;
    category?: string | null;
    secondary_tags?: string[] | null;
    published_at: string | null;
    updated_at: string | null;
  };
  let articles: ArticleRow[];
  {
    const { holiswissPublic } = await import("@/integrations/supabase/holiswiss-public");
    // `slug_de` peut ne pas encore exister côté base : repli sur le slug de base
    // plutôt que de perdre les 150+ URL du blog. Si le repli échoue aussi, on lève.
    const rich = await (holiswissPublic as any)
      .from("articles")
      .select("slug, slug_de, category, secondary_tags, published_at, updated_at")
      .eq("status", "validated");
    articles = rich.error
      ? (unwrap(
          "sitemap: articles de blog (repli sans slug_de)",
          await (holiswissPublic as any)
            .from("articles")
            .select("slug, published_at, updated_at")
            .eq("status", "validated"),
        ) as ArticleRow[])
      : (rich.data as ArticleRow[]);
  }
  const articleDay = (a: ArticleRow) => day(a.updated_at) ?? day(a.published_at);
  const articlesFreshness = articles.reduce<string | undefined>(
    (acc, a) => newer(acc, articleDay(a)),
    undefined,
  );

  // ── Événements publiés à venir ────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const events = unwrap(
    "sitemap: événements publiés",
    await supabaseAdmin
      .from("events")
      .select("id, updated_at, therapist_id")
      .eq("status", "published")
      .gte("event_date", today),
  ) as unknown as Array<{ id: string; updated_at: string | null; therapist_id?: string | null }>;
  const eventsFreshness = events.reduce<string | undefined>(
    (acc, e) => newer(acc, day(e.updated_at)),
    undefined,
  );

  // ── « Voix d'experts » ────────────────────────────────────────────────────
  const paroles = unwrap(
    "sitemap: Voix d'experts",
    await supabaseAdmin
      .from("therapist_articles")
      .select("slug, updated_at, date_publication, therapist_id")
      .eq("statut", "publie"),
  ) as unknown as Array<{
    slug: string | null;
    updated_at: string | null;
    date_publication: string | null;
    therapist_id?: string | null;
  }>;
  const paroleDay = (a: (typeof paroles)[number]) => day(a.updated_at) ?? day(a.date_publication);
  const parolesFreshness = paroles.reduce<string | undefined>(
    (acc, a) => newer(acc, paroleDay(a)),
    undefined,
  );

  // ══ Assemblage ════════════════════════════════════════════════════════════

  // Pages statiques × langues.
  const freshnessOf = (from: NonNullable<(typeof STATIC_PATHS)[number]["lastmodFrom"]>) => {
    switch (from) {
      case "therapists":
        return therapistsFreshness;
      case "articles":
        return articlesFreshness;
      case "paroles":
        return parolesFreshness;
      case "events":
        return eventsFreshness;
      case "all":
        return [therapistsFreshness, articlesFreshness, parolesFreshness, eventsFreshness].reduce(
          newer,
          undefined,
        );
    }
  };
  for (const lang of LANGS) {
    for (const p of STATIC_PATHS) {
      const lastmod = p.lastmod ?? (p.lastmodFrom ? freshnessOf(p.lastmodFrom) : undefined);
      urls.push(urlBlock(`${BASE_URL}/${lang}${p.path}`, lastmod, p.changefreq, p.priority));
    }
  }

  // Familles.
  for (const f of families) {
    for (const lang of LANGS) {
      urls.push(
        urlBlock(
          `${BASE_URL}/${lang}/therapeutes/famille/${f.slug}`,
          day(f.updated_at),
          "weekly",
          "0.8",
        ),
      );
    }
  }

  // Pages spécialité.
  for (const s of specs) {
    if (!isSpecialtyIndexable(specCount.get(s.slug) ?? 0)) continue;
    // Fraîcheur = la plus récente entre la fiche de la spécialité et les
    // praticiens qu'elle liste : c'est ce que la page affiche qui change.
    const lastmod = newer(
      day(s.updated_at),
      specCount.has(s.slug) ? therapistsFreshness : undefined,
    );
    for (const lang of LANGS) {
      urls.push(
        urlBlock(
          `${BASE_URL}/${lang}/specialites/${specSlugForLang(s, lang)}`,
          lastmod,
          "weekly",
          "0.7",
        ),
      );
    }
  }

  // Pages spécialité × ville.
  for (const [key, count] of pairCount) {
    if (!isSpecialtyCityIndexable(count)) continue;
    const spec = pairSpec.get(key)!;
    const cSlug = key.split("::")[1];
    const lastmod = pairFreshness.get(key);
    for (const lang of LANGS) {
      urls.push(
        urlBlock(
          `${BASE_URL}/${lang}/specialites/${specSlugForLang(spec, lang)}/${cSlug}`,
          lastmod,
          "weekly",
          "0.6",
        ),
      );
    }
  }

  // Fiches praticiens — une SEULE URL par fiche, dans sa langue de rédaction.
  //
  // La table `therapists` n'a pas de colonnes de traduction : publier les quatre
  // langues revenait à déclarer quatre URL pour un unique texte français. Google
  // l'avait déjà compris et consolidait vers la version francophone
  // (`canonical_other` sur les variantes DE/EN/IT). La langue retenue suit le
  // canton, puis les langues parlées — même règle que le canonical de la fiche,
  // qu'il ne faut pas laisser diverger.
  for (const t of therapists) {
    if (!t.slug) continue;
    const lang = resolveProfileLang(null, t.canton, t.languages);
    urls.push(
      urlBlock(`${BASE_URL}/${lang}/therapeute/${t.slug}`, day(t.updated_at), "weekly", "0.8"),
    );
  }

  // Listings géographiques : canton et ville. Uniquement ceux qui comptent au
  // moins une fiche active (pas de page vide).
  {
    const cantons = new Map<string, string | undefined>();
    const cities = new Map<string, string | undefined>();
    for (const t of therapists) {
      const d = day(t.updated_at);
      const code = (t.canton ?? "").trim().toUpperCase();
      if (code.length === 2) bump(cantons, code, d);
      const cSlug = tolerantCitySlug((t.city ?? "").trim());
      if (cSlug) bump(cities, cSlug, d);
    }
    for (const [code, lastmod] of cantons) {
      for (const lang of LANGS) {
        urls.push(
          urlBlock(`${BASE_URL}/${lang}/therapeutes/canton/${code}`, lastmod, "weekly", "0.7"),
        );
      }
    }
    for (const [cSlug, lastmod] of cities) {
      for (const lang of LANGS) {
        urls.push(
          urlBlock(`${BASE_URL}/${lang}/therapeutes/ville/${cSlug}`, lastmod, "weekly", "0.7"),
        );
      }
    }
  }

  // Événements — une seule URL par événement, comme pour les fiches : `events`
  // n'a aucune colonne de traduction. La langue suit le canton du praticien
  // organisateur, même règle que le canonical de la page.
  for (const e of events) {
    const canton = e.therapist_id ? (therapistById.get(e.therapist_id)?.canton ?? null) : null;
    urls.push(
      urlBlock(
        `${BASE_URL}/${resolveProfileLang(null, canton, null)}/evenements/${e.id}`,
        day(e.updated_at),
        "weekly",
        "0.7",
      ),
    );
  }

  // « Voix d'experts » — une seule langue également : `therapist_articles` n'a
  // qu'une colonne `titre`, sans traduction. Quatre URL pour un texte unique,
  // c'est le doublon que `npm run seo:check` signalait.
  for (const a of paroles) {
    if (!a.slug) continue;
    const canton = a.therapist_id ? (therapistById.get(a.therapist_id)?.canton ?? null) : null;
    urls.push(
      urlBlock(
        `${BASE_URL}/${resolveProfileLang(null, canton, null)}/paroles/${a.slug}`,
        paroleDay(a),
        "monthly",
        "0.7",
      ),
    );
  }

  // Articles de blog.
  for (const a of articles) {
    if (!a.slug) continue;
    const lastmod = articleDay(a);
    for (const lang of LANGS) {
      urls.push(
        urlBlock(
          `${BASE_URL}/${lang}/blog/${lang === "de" ? a.slug_de || a.slug : a.slug}`,
          lastmod,
          "monthly",
          "0.7",
        ),
      );
    }
  }

  // Catégories du blog : seulement celles qui portent assez d'articles. Elles
  // étaient indexables mais jamais déclarées — 112 URLs dans un entre-deux. Le
  // seuil doit rester aligné sur MIN_ARTICLES_INDEXABLE dans
  // `$lang.blog.categorie.$slug.tsx` : au-dessous, la page émet un noindex, et
  // le sitemap ne doit jamais annoncer une page noindex.
  {
    const MIN_ARTICLES_INDEXABLE = 3;
    const perCategory = new Map<string, number>();
    const categoryFreshness = new Map<string, string | undefined>();
    for (const a of articles) {
      const keys = new Set<string>();
      if (a.category) keys.add(a.category);
      for (const t of a.secondary_tags ?? []) if (t) keys.add(t);
      for (const k of keys) {
        perCategory.set(k, (perCategory.get(k) ?? 0) + 1);
        bump(categoryFreshness, k, articleDay(a));
      }
    }
    for (const [slug, count] of perCategory) {
      if (count < MIN_ARTICLES_INDEXABLE) continue;
      if (!getCategory(slug)) continue; // catégorie inconnue de la route → 404
      for (const lang of LANGS) {
        urls.push(
          urlBlock(
            `${BASE_URL}/${lang}/blog/categorie/${slug}`,
            categoryFreshness.get(slug),
            "weekly",
            "0.6",
          ),
        );
      }
    }
  }

  if (urls.length < MIN_EXPECTED_URLS) {
    throw new Error(
      `sitemap: ${urls.length} URL assemblées, moins que le plancher de ${MIN_EXPECTED_URLS} — génération jugée incomplète`,
    );
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        let xml: string;
        try {
          xml = await buildSitemap();
        } catch (err) {
          // ÉCHOUER BRUYAMMENT. Un sitemap amputé servi en 200 dit à Google que
          // les URL manquantes n'existent plus ; un 503 lui dit de repasser et
          // de conserver la version qu'il connaît déjà. `no-store` empêche
          // Cloudflare de garder l'échec en cache une heure.
          console.error("sitemap: génération abandonnée, réponse 503 —", err);
          return new Response(
            `<?xml version="1.0" encoding="UTF-8"?>\n<!-- sitemap temporairement indisponible -->`,
            {
              status: 503,
              headers: {
                "Content-Type": "application/xml; charset=utf-8",
                "Cache-Control": "no-store",
                "Retry-After": "3600",
              },
            },
          );
        }

        // `Last-Modified` = le `lastmod` le plus récent du fichier, pas l'heure
        // du build : une requête conditionnelle de Google doit apprendre quelque
        // chose de vrai. Sans lui, la seule information portée par la réponse
        // était un `max-age` qui invite à ne pas revenir.
        const latest = xml.match(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g)?.reduce((acc, m) => {
          const d = m.slice(9, 19);
          return d > acc ? d : acc;
        }, "0000-00-00");
        const headers: Record<string, string> = {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        };
        if (latest && latest !== "0000-00-00") {
          headers["Last-Modified"] = new Date(`${latest}T00:00:00Z`).toUTCString();
          headers["ETag"] = `W/"${xml.match(/<loc>/g)?.length ?? 0}-${latest}"`;
        }
        return new Response(xml, { headers });
      },
    },
  },
});
