import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Monitor, RotateCcw, Smartphone, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NEW_THERAPISTS_ANIMATIONS } from "@/components/holiswiss/NewTherapistsAnimated";

/**
 * Aperçus d'ANIMATION pour la Version B de « Nouveaux thérapeutes ».
 * Purement présentationnel : aucune fonction serveur, section publique intacte.
 */
export const Route = createFileRoute("/preview/animations-therapeutes")({
  ssr: false,
  component: PreviewAnimations,
});

const DEVICES = [
  { id: "desktop", label: "Desktop 1440", width: 1440, Icon: Monitor },
  { id: "tablet", label: "Tablette 768", width: 768, Icon: Tablet },
  { id: "mobile", label: "Mobile 390", width: 390, Icon: Smartphone },
] as const;

type DeviceId = (typeof DEVICES)[number]["id"];

function PreviewAnimations() {
  const [device, setDevice] = useState<DeviceId>("mobile");
  const [chosen, setChosen] = useState<string | null>(null);
  const [replay, setReplay] = useState(0);
  const current = DEVICES.find((d) => d.id === device)!;

  return (
    <div className="min-h-dvh bg-[#0f0a1e]">
      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            Version B — 3 propositions d'animation
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#d4c4e0]">
            Survolez (ou tabulez sur) une carte pour déclencher l'animation. La grille suit
            désormais la largeur du cadre d'aperçu : plus aucun chevauchement en 390 px. Rien n'est
            appliqué au site tant que vous n'avez pas choisi.
          </p>
        </header>

        <div className="sticky top-0 z-20 -mx-4 mb-6 flex flex-wrap items-center gap-2 border-b border-[rgba(184,110,249,0.2)] bg-[#0f0a1e]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <span className="mr-1 text-xs uppercase tracking-wide text-[#a89bc4]">Aperçu</span>
          {DEVICES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setDevice(id)}
              aria-pressed={device === id}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9] ${
                device === id
                  ? "border-[#b86ef9] bg-[#b86ef9]/20 text-white"
                  : "border-[rgba(184,110,249,0.3)] text-[#d4c4e0] hover:bg-[#b86ef9]/10"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setReplay((r) => r + 1)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[rgba(184,110,249,0.3)] px-3 text-sm text-[#d4c4e0] transition-colors hover:bg-[#b86ef9]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Rejouer
          </button>
        </div>

        {chosen && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-[#7de3b8]/40 bg-[#7de3b8]/10 px-4 py-3 text-sm text-[#a8f0d0]"
          >
            <strong>Choix enregistré (localement) :</strong>{" "}
            {NEW_THERAPISTS_ANIMATIONS.find((v) => v.id === chosen)?.name}. Confirmez-moi
            « Applique la {chosen} » pour l'appliquer au site.
          </div>
        )}

        <div className="space-y-10">
          {NEW_THERAPISTS_ANIMATIONS.map(({ id, name, description, Component }) => (
            <section
              key={id}
              className="overflow-hidden rounded-2xl border border-[rgba(184,110,249,0.25)] bg-[#160b28]"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-[rgba(184,110,249,0.2)] px-4 py-3 sm:px-6">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-white sm:text-lg">{name}</h2>
                  <p className="mt-0.5 text-xs text-[#a89bc4] sm:text-sm">{description}</p>
                </div>
                <Button
                  type="button"
                  onClick={() => setChosen(id)}
                  className={`min-h-[44px] shrink-0 gap-2 text-white ${
                    chosen === id
                      ? "bg-[#7de3b8]/25 hover:bg-[#7de3b8]/30"
                      : "bg-[#b86ef9] hover:bg-[#a855f7]"
                  }`}
                >
                  {chosen === id ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                  Choisir cette animation
                </Button>
              </div>
              <div className="overflow-x-auto bg-[#0f0a1e] p-4 sm:p-6">
                <div
                  key={`${id}-${replay}-${device}`}
                  className="mx-auto overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)]"
                  style={{ width: current.width, maxWidth: "100%" }}
                >
                  <Component />
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}