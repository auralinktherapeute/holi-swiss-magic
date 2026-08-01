import { createFileRoute } from "@tanstack/react-router";
import { Lightbulb } from "lucide-react";
import {
  MarketingTopicsPanel,
  type MarketingTopic,
} from "@/components/admin/MarketingTopicsPanel";

/**
 * Route d'inspection visuelle du panneau « Sujets » de /admin/marketing.
 *
 * Raison d'être : le layout /admin redirige vers /connexion sans session, ce qui
 * rend le rendu invérifiable pendant le développement. Cette route affiche le
 * MÊME composant, avec des données de démonstration.
 *
 * Sécurité : purement présentationnelle. Aucune fonction serveur, aucune requête
 * base, aucune donnée réelle — les gestionnaires sont inertes. Rien à divulguer.
 */
export const Route = createFileRoute("/preview/marketing-topics")({
  ssr: false,
  component: PreviewMarketingTopics,
});

const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const hier = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

/** Jeu de démonstration : couvre les trois statuts et le cas de l'angle de repli. */
const DEMO: MarketingTopic[] = [
  {
    id: "demo-1",
    subject: "Les 4 questions à poser avant une première séance",
    target_date: demain,
    network: "instagram",
    format: "carrousel",
    note: null,
    status: "en_attente",
    reject_reason: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-2",
    subject: "Les bienfaits du Reiki",
    target_date: demain,
    network: null,
    format: null,
    note: null,
    status: "en_attente",
    reject_reason:
      "« Ce qu'un praticien Reiki peut dire — et ce qu'il n'a pas le droit de promettre » (86/100). Le sujet d'origine plafonne à 41 : différenciation nulle, aucune conversion.",
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-3",
    subject: "Pourquoi deux séances de la même thérapie peuvent varier du simple au double",
    target_date: hier,
    network: "linkedin",
    format: "post",
    note: null,
    status: "traite",
    reject_reason: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-4",
    subject: "Un sujet que j'ai finalement retiré de la file",
    target_date: hier,
    network: null,
    format: null,
    note: null,
    status: "abandonne",
    reject_reason: null,
    created_at: new Date().toISOString(),
  },
];

function PreviewMarketingTopics() {
  return (
    <div style={{ minHeight: "100dvh", background: "#0f0a1e" }}>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <strong>Aperçu visuel.</strong> Données de démonstration, boutons inertes. Le panneau réel
          se trouve dans <code className="text-amber-100">/admin/marketing</code>, onglet « Sujets ».
        </div>

        <header className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white sm:text-3xl">
            <Lightbulb className="h-6 w-6 text-[#b86ef9]" /> Sujets
          </h1>
          <p className="mt-2 text-sm text-[#d4c4e0]">
            Soumettez un sujet pour le lendemain. Il est produit en supplément de la publication
            programmée, jamais à sa place.
          </p>
        </header>

        <MarketingTopicsPanel
          topics={DEMO}
          onSubmit={async (input) => {
            // Inerte : on renvoie simplement la date qu'aurait retenue le serveur.
            return { target_date: input.target_date || demain };
          }}
          onAbandon={async () => {
            /* inerte */
          }}
        />
      </div>
    </div>
  );
}
