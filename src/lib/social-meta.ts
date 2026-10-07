import { ogLocale } from "@/lib/seo";

type Meta = Record<string, unknown>;
type Head = { meta?: Meta[]; [k: string]: unknown };

const LANGS = ["fr", "de", "it", "en"];

/**
 * Complète les balises de partage manquantes d'une page à partir de SES
 * propres titre et description : og:locale de la langue servie, et
 * twitter:card / twitter:title / twitter:description. Ne remplace jamais une
 * valeur déjà posée par la page, et n'invente aucun texte : sans titre ni
 * description, rien n'est ajouté. Pages en noindex comprises (balises neutres).
 */
export function completeSocialMeta(lang: string | undefined, meta: Meta[] | undefined): Meta[] | undefined {
  if (!meta) return meta;
  const has = (k: "name" | "property", v: string) => meta.some((m) => m[k] === v);
  const title = (meta.find((m) => typeof m.title === "string")?.title as string | undefined)
    ?? (meta.find((m) => m.property === "og:title")?.content as string | undefined);
  const description = meta.find((m) => m.name === "description")?.content as string | undefined;
  const out = [...meta];
  if (lang && LANGS.includes(lang) && !has("property", "og:locale")) {
    out.push({ property: "og:locale", content: ogLocale(lang) });
  }
  if (!title) return out;
  if (!has("name", "twitter:card")) {
    out.push({ name: "twitter:card", content: has("property", "og:image") ? "summary_large_image" : "summary" });
  }
  if (!has("name", "twitter:title")) out.push({ name: "twitter:title", content: title });
  if (description && !has("name", "twitter:description")) out.push({ name: "twitter:description", content: description });
  return out;
}

/** Enveloppe un `head()` de route pour compléter ses balises de partage. */
export function withSocialHead<C extends { params?: unknown }, R>(fn: (ctx: C) => R): (ctx: C) => R {
  return (ctx: C) => {
    const res = fn(ctx) as unknown as Head;
    if (!res || typeof res !== "object") return res as unknown as R;
    const lang = (ctx.params as { lang?: string } | undefined)?.lang;
    return { ...res, meta: completeSocialMeta(lang, res.meta) } as unknown as R;
  };
}
