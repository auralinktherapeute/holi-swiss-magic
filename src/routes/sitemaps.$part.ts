import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { groupBlocks, isSitemapPart, latestLastmod, unavailableResponse, urlsetXml, xmlResponse } from "@/lib/sitemap-groups";

/** Une partie du plan du site, ex. `/sitemaps/articles-de.xml`. */
export const Route = createFileRoute("/sitemaps/$part")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const part = params.part.replace(/\.xml$/, "");
        if (!params.part.endsWith(".xml") || !isSitemapPart(part)) {
          return new Response("Not found", { status: 404 });
        }
        try {
          const { buildSitemapBlocks } = await import("@/lib/sitemap-build.server");
          const blocks = groupBlocks(await buildSitemapBlocks())[part];
          return xmlResponse(urlsetXml(blocks), latestLastmod(blocks));
        } catch (err) {
          console.error(`sitemap ${part}: génération abandonnée, réponse 503 —`, err);
          return unavailableResponse();
        }
      },
    },
  },
});
