import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { groupBlocks, latestLastmod, sitemapIndexXml, unavailableResponse, xmlResponse } from "@/lib/sitemap-groups";

/**
 * Index des sitemaps : pages principales, profils, annuaire et articles par
 * langue (`/sitemaps/<partie>.xml`). Le générateur est dans
 * `src/lib/sitemap-build.server.ts`.
 */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { buildSitemapBlocks } = await import("@/lib/sitemap-build.server");
          const blocks = await buildSitemapBlocks();
          return xmlResponse(sitemapIndexXml(groupBlocks(blocks)), latestLastmod(blocks));
        } catch (err) {
          console.error("sitemap: génération abandonnée, réponse 503 —", err);
          return unavailableResponse();
        }
      },
    },
  },
});
