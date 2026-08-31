import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/**
 * `/llms-full.txt` — corpus texte intégral de Holiswiss pour les agents IA.
 *
 * Pourquoi cette route existe : jusqu'au 30/08/2026, l'URL répondait **200 avec
 * 87 117 octets de HTML React** (`content-type: text/html`) — le catch-all du
 * routeur servait la page d'accueil. Un agent qui récupérait le fichier
 * n'obtenait pas du texte mais du balisage : pire que l'absence de fichier,
 * puisque le 200 laisse croire que la ressource existe. `/llms.txt`, lui, est un
 * vrai fichier statique de `public/` et répondait correctement — d'où l'illusion
 * que « les deux fichiers llms sont en place ».
 *
 * Une route de fichier explicite prime sur le catch-all (même mécanique que
 * `/sitemap.xml`), donc ce correctif ne dépend pas de la correction du soft-404
 * et ne la contredit pas.
 *
 * Attente réaliste : aucun moteur génératif n'a annoncé lire llms.txt, et les
 * analyses de logs publiées mesurent ces récupérations à ~0,1 % des hits de bots
 * (John Mueller, Google — https://www.searchenginejournal.com/google-says-llms-txt-comparable-to-keywords-meta-tag/544804/).
 * On le répare parce qu'un fichier qui ment est un défaut, pas parce qu'on en
 * attend des citations.
 */

const SITE = "https://holiswiss.ch";

const HEADER = `# Holiswiss — corpus intégral

> Plateforme suisse dédiée aux thérapies holistiques et médecines douces, qui
> connecte patients et praticiens certifiés dans les 26 cantons, en 4 langues
> (français, allemand, italien, anglais).

Entité : Holiswiss (${SITE}). Éditeur : Gérald Henry, entrepreneur individuel,
Impasse Nussbaum, 68300 Saint-Louis, France (SIREN 103 987 061).
Contact : contact@holiswiss.ch. Marché desservi : Suisse (CH).
Langues : FR, DE, IT, EN.

Ce fichier reprend le texte intégral des articles éditoriaux publiés sur
${SITE}. Le résumé court et la liste des pages principales sont dans
${SITE}/llms.txt. Les fiches de thérapeutes ne sont pas incluses : elles
changent en continu, leur source fait foi (${SITE}/fr/therapeutes).

## Pages principales
- ${SITE}/fr — Accueil : trouver un thérapeute holistique certifié en Suisse.
- ${SITE}/fr/therapeutes — Annuaire : recherche par spécialité, canton et langue.
- ${SITE}/fr/blog — Blog bien-être.
- ${SITE}/fr/paroles — Voix d'experts : articles publiés par les thérapeutes.
- ${SITE}/fr/evenements — Ateliers, retraites et conférences en Suisse.
- ${SITE}/fr/tarifs — Abonnements pour les praticiens.
- ${SITE}/fr/faq — Remboursement LAMal/ASCA/RME, spécialités, réservation.
- ${SITE}/fr/impressum — Mentions légales et identité de l'éditeur.
`;

type ArticleRow = {
  slug: string | null;
  slug_de: string | null;
  category: string | null;
  published_at: string | null;
  updated_at: string | null;
  title_fr: string | null;
  title_de: string | null;
  title_it: string | null;
  title_en: string | null;
  body_fr: string | null;
};

function section(a: ArticleRow) {
  const title = a.title_fr?.trim();
  const body = a.body_fr?.trim();
  if (!a.slug || !title || !body) return null;
  const date = (a.published_at || a.updated_at)?.slice(0, 10);
  const others = [
    a.title_de ? `${SITE}/de/blog/${a.slug_de || a.slug}` : null,
    a.title_it ? `${SITE}/it/blog/${a.slug}` : null,
    a.title_en ? `${SITE}/en/blog/${a.slug}` : null,
  ].filter(Boolean);
  return [
    `## ${title}`,
    `URL : ${SITE}/fr/blog/${a.slug}`,
    date ? `Date : ${date}` : null,
    a.category ? `Catégorie : ${a.category}` : null,
    others.length ? `Autres langues : ${others.join(" · ")}` : null,
    "",
    body,
    "",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export const Route = createFileRoute("/llms-full.txt")({
  server: {
    handlers: {
      GET: async () => {
        const parts: string[] = [HEADER];
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("articles")
            .select(
              "slug,slug_de,category,published_at,updated_at,title_fr,title_de,title_it,title_en,body_fr",
            )
            .eq("status", "validated")
            .order("published_at", { ascending: false });
          if (error) throw error;
          parts.push(`\n# Articles (${(data ?? []).length})\n`);
          for (const a of (data ?? []) as unknown as ArticleRow[]) {
            const s = section(a);
            if (s) parts.push(s);
          }
        } catch (err) {
          // Ne jamais renvoyer de HTML ni de 200 trompeur : mieux vaut un corpus
          // réduit au socle d'identité, en text/plain, qu'une page React.
          console.error("llms-full.txt: articles fetch failed", err);
          parts.push("\n# Articles\n\nCorpus temporairement indisponible. Voir " + SITE + "/fr/blog\n");
        }
        return new Response(parts.join("\n"), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
            "X-Robots-Tag": "noindex",
          },
        });
      },
    },
  },
});
