import { createFileRoute } from "@tanstack/react-router";
import { INDEXNOW_KEY } from "@/lib/indexing.functions";

// Fichier de vérification IndexNow (Bing, Seznam, Yandex — et donc les IA
// qui s'appuient sur l'index Bing, ChatGPT en tête). Doit servir la clé en
// texte brut à https://holiswiss.ch/<clé>.txt
export const Route = createFileRoute("/41c3cce6c762af43d78a7895dfc0afe3.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(INDEXNOW_KEY, {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }),
    },
  },
});
