import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Music2, Volume2 } from "lucide-react";

/**
 * Aperçu : 3 propositions pour le bouton d'ambiance sonore.
 * Purement présentationnel — aucun son, le composant public est inchangé.
 */
export const Route = createFileRoute("/preview/ambiance")({
  ssr: false,
  component: PreviewAmbiance,
  head: () => ({
    meta: [
      { title: "Aperçu — bouton d'ambiance sonore | Holiswiss" },
      { name: "description", content: "Trois propositions d'animation pour le bouton d'ambiance sonore Holiswiss." },
      { property: "og:title", content: "Aperçu — bouton d'ambiance sonore | Holiswiss" },
      { property: "og:description", content: "Trois propositions d'animation pour le bouton d'ambiance sonore Holiswiss." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const PURPLE = "#b86ef9";
const CYAN = "#5cc8fa";

function Bars({ color = PURPLE }: { color?: string }) {
  return (
    <span className="flex items-end gap-[3px] h-4" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block rounded-full"
          style={{
            width: 3,
            background: i === 1 ? CYAN : color,
            animation: `pv-bar-${i} ${0.7 + i * 0.1}s ease-in-out infinite alternate`,
          }}
        />
      ))}
    </span>
  );
}

/** A — Halo respirant : anneaux d'onde qui se propagent quand la musique joue. */
function VariantA({ playing, onToggle }: { playing: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={playing ? "Désactiver la musique" : "Activer l'ambiance sonore"}
      aria-pressed={playing}
      className="pv-btn group relative grid h-14 w-14 place-items-center rounded-full transition-transform duration-200 ease-out hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0a1e]"
      style={{
        background: "rgba(184,110,249,0.16)",
        border: "1px solid rgba(184,110,249,0.4)",
        backdropFilter: "blur(12px)",
        color: playing ? PURPLE : "rgba(255,255,255,0.65)",
        boxShadow: playing ? "0 0 28px rgba(184,110,249,0.45)" : "0 0 0 rgba(0,0,0,0)",
      }}
    >
      {playing && (
        <>
          <span className="pv-ripple" />
          <span className="pv-ripple pv-ripple--2" />
        </>
      )}
      <span className="pv-idle-glow" />
      {playing ? <Bars /> : <Volume2 className="h-5 w-5" />}
    </button>
  );
}

/** B — Anneau lumineux rotatif + libellé qui se déplie. */
function VariantB({ playing, onToggle }: { playing: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={playing ? "Désactiver la musique" : "Activer l'ambiance sonore"}
      aria-pressed={playing}
      className="pv-pill group relative flex h-14 items-center gap-0 overflow-hidden rounded-full pl-[3px] pr-[3px] transition-[padding] duration-300 ease-out hover:pr-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0a1e]"
      style={{
        background: "rgba(20,10,40,0.7)",
        border: "1px solid rgba(184,110,249,0.35)",
        backdropFilter: "blur(12px)",
      }}
    >
      <span className="relative grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full">
        <span className={playing ? "pv-conic pv-conic--on" : "pv-conic"} />
        <span
          className="relative grid h-[38px] w-[38px] place-items-center rounded-full"
          style={{ background: "#1a1035", color: playing ? PURPLE : "rgba(255,255,255,0.7)" }}
        >
          {playing ? <Bars /> : <Music2 className="h-[18px] w-[18px]" />}
        </span>
      </span>
      <span className="pv-label whitespace-nowrap text-sm font-medium text-white/90">
        {playing ? "Musique active" : "Ambiance sonore"}
      </span>
    </button>
  );
}

/** C — Onde audio pleine largeur, aimantée au survol. */
function VariantC({ playing, onToggle }: { playing: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={playing ? "Désactiver la musique" : "Activer l'ambiance sonore"}
      aria-pressed={playing}
      className="pv-wave group relative grid h-14 w-14 place-items-center rounded-2xl transition-all duration-300 ease-out hover:-translate-y-1 hover:rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5cc8fa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0a1e]"
      style={{
        background: playing
          ? "linear-gradient(135deg, rgba(184,110,249,0.35), rgba(92,200,250,0.25))"
          : "rgba(255,255,255,0.06)",
        border: "1px solid rgba(92,200,250,0.35)",
        backdropFilter: "blur(12px)",
        color: playing ? "#ffffff" : "rgba(255,255,255,0.65)",
        boxShadow: playing ? "0 10px 30px -10px rgba(92,200,250,0.6)" : "none",
      }}
    >
      <span className="pv-sheen" />
      {playing ? (
        <span className="flex items-end gap-[2px] h-5" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="inline-block rounded-full"
              style={{
                width: 2.5,
                background: i % 2 ? CYAN : "#e2c6ff",
                animation: `pv-bar-${i % 3} ${0.6 + (i % 3) * 0.15}s ease-in-out infinite alternate`,
              }}
            />
          ))}
        </span>
      ) : (
        <Volume2 className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
      )}
    </button>
  );
}

const VARIANTS = [
  {
    id: "A",
    name: "A — Halo respirant",
    desc: "Au repos : léger halo violet qui respire (4 s) pour attirer l'œil sans distraire. Actif : deux ondes concentriques se propagent en continu + lueur portée. Survol : élévation 5 %.",
    Component: VariantA,
  },
  {
    id: "B",
    name: "B — Anneau rotatif + libellé",
    desc: "Anneau conique violet→cyan qui tourne quand la musique joue. Au survol, la pastille se déplie en pilule et révèle le libellé (300 ms, ease-out) — plus explicite, zéro tooltip.",
    Component: VariantB,
  },
  {
    id: "C",
    name: "C — Onde & reflet",
    desc: "Carré arrondi qui devient cercle au survol avec élévation et reflet balayant. Actif : dégradé violet→cyan et onde de 5 barres. Le plus contrasté et le plus visible.",
    Component: VariantC,
  },
] as const;

function PreviewAmbiance() {
  const [playing, setPlaying] = useState<Record<string, boolean>>({});

  return (
    <div className="min-h-dvh bg-[#0f0a1e]">
      <style>{`
        @keyframes pv-bar-0 { from { height: 4px } to { height: 15px } }
        @keyframes pv-bar-1 { from { height: 8px } to { height: 18px } }
        @keyframes pv-bar-2 { from { height: 6px } to { height: 13px } }
        @keyframes pv-ripple-k {
          0% { transform: scale(1); opacity: .55 }
          100% { transform: scale(1.9); opacity: 0 }
        }
        @keyframes pv-breathe {
          0%,100% { opacity: .25; transform: scale(1) }
          50% { opacity: .6; transform: scale(1.12) }
        }
        @keyframes pv-spin { to { transform: rotate(360deg) } }
        @keyframes pv-sheen-k {
          0% { transform: translateX(-140%) skewX(-18deg) }
          100% { transform: translateX(240%) skewX(-18deg) }
        }
        .pv-ripple {
          position: absolute; inset: 0; border-radius: 999px;
          border: 1px solid rgba(184,110,249,.7);
          animation: pv-ripple-k 2.4s ease-out infinite;
        }
        .pv-ripple--2 { animation-delay: 1.2s; border-color: rgba(92,200,250,.6) }
        .pv-idle-glow {
          position: absolute; inset: -6px; border-radius: 999px; pointer-events: none;
          background: radial-gradient(circle, rgba(184,110,249,.35), transparent 70%);
          animation: pv-breathe 4s ease-in-out infinite;
        }
        .pv-conic {
          position: absolute; inset: 0; border-radius: 999px;
          background: conic-gradient(from 0deg, transparent 0 60%, ${PURPLE} 78%, ${CYAN} 92%, transparent 100%);
          opacity: .5;
        }
        .pv-conic--on { opacity: 1; animation: pv-spin 3.2s linear infinite }
        .pv-label {
          max-width: 0; opacity: 0; margin-left: 0;
          transition: max-width .35s ease-out, opacity .25s ease-out, margin-left .35s ease-out;
        }
        .pv-pill:hover .pv-label, .pv-pill:focus-visible .pv-label {
          max-width: 200px; opacity: 1; margin-left: 10px;
        }
        .pv-sheen {
          position: absolute; inset: 0; overflow: hidden; border-radius: inherit; pointer-events: none;
        }
        .pv-sheen::after {
          content: ""; position: absolute; top: 0; bottom: 0; width: 40%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent);
          transform: translateX(-140%) skewX(-18deg);
        }
        .pv-wave:hover .pv-sheen::after { animation: pv-sheen-k .8s ease-out }
        @media (prefers-reduced-motion: reduce) {
          .pv-ripple, .pv-idle-glow, .pv-conic--on, .pv-sheen::after { animation: none !important }
        }
      `}</style>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          Bouton d'ambiance sonore — 3 propositions
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#d4c4e0]">
          Cliquez sur chaque bouton pour voir l'état « musique active », et survolez-le pour
          l'animation d'interaction. Le bouton actuel du site n'est pas modifié : dites-moi la
          lettre choisie et je l'installe.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {VARIANTS.map((v) => {
            const C = v.Component;
            const on = !!playing[v.id];
            return (
              <section
                key={v.id}
                className="rounded-2xl border border-[rgba(184,110,249,0.22)] bg-[#1d0d3d] p-6"
              >
                <h2 className="text-base font-semibold text-white">{v.name}</h2>
                <div className="mt-6 grid h-40 place-items-center rounded-xl bg-[#150a2e]">
                  <C playing={on} onToggle={() => setPlaying((p) => ({ ...p, [v.id]: !on }))} />
                </div>
                <p className="mt-5 text-sm leading-relaxed text-[#d4c4e0]">{v.desc}</p>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
