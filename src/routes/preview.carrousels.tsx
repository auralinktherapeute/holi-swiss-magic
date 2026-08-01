import { createFileRoute } from "@tanstack/react-router";
import { LayoutGrid } from "lucide-react";
import { CarouselViewer } from "@/components/admin/CarouselViewer";
import { CAROUSELS } from "@/data/marketing-carousels";

/**
 * Inspection visuelle de l'onglet « Carrousels » de /admin/marketing.
 *
 * Le layout /admin redirige vers /connexion sans session : cette route affiche
 * le MÊME composant avec les MÊMES données, sans garde. Purement
 * présentationnel — aucune fonction serveur, aucune requête base.
 */
export const Route = createFileRoute("/preview/carrousels")({
  ssr: false,
  component: PreviewCarrousels,
});

function PreviewCarrousels() {
  return (
    <div style={{ minHeight: "100dvh", background: "#0f0a1e" }}>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <strong>Aperçu visuel.</strong> Rendu identique à l'onglet « Carrousels » de{" "}
          <code className="text-amber-100">/admin/marketing</code>.
        </div>

        <header className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white sm:text-3xl">
            <LayoutGrid className="h-6 w-6 text-[#b86ef9]" /> Carrousels
          </h1>
          <p className="mt-2 text-sm text-[#d4c4e0]">
            Carrousels produits et validés, au format réel 4:5. Faites défiler chaque rangée
            horizontalement. Le bouton portant un point indique la langue de rédaction d'origine.
          </p>
        </header>

        <div className="space-y-5">
          {CAROUSELS.map((c) => (
            <CarouselViewer key={c.id} carousel={c} />
          ))}
        </div>
      </div>
    </div>
  );
}
