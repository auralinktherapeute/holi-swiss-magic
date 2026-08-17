import { ArrowRight, BadgeCheck, Languages, MapPin } from "lucide-react";
import { DEMO_THERAPISTS, type DemoTherapist } from "@/components/holiswiss/NewTherapistsVariants";

/**
 * 3 propositions d'ANIMATION pour la Version B (« humaine et chaleureuse »).
 * Même structure, même contenu : seules les animations changent.
 * Purement présentationnel (données de démo), la section publique est inchangée.
 *
 * Responsive : requêtes de conteneur (@container) pour que la grille suive la
 * largeur du cadre d'aperçu et non celle de la fenêtre — c'est ce qui évitait
 * le chevauchement des cartes en mode « Mobile 390 ».
 */

type Anim = "stagger" | "halo" | "shine";

function Card({ t, i, anim }: { t: DemoTherapist; i: number; anim: Anim }) {
  return (
    <li
      className={anim === "stagger" ? "nt-rise" : undefined}
      style={anim === "stagger" ? ({ "--nt-i": i } as React.CSSProperties) : undefined}
    >
      <a
        href="#"
        onClick={(e) => e.preventDefault()}
        className={`nt-card group flex h-full flex-col items-center rounded-3xl border border-[rgba(184,110,249,0.22)] bg-[#2d1248]/70 p-6 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9] ${
          anim === "halo" ? "nt-breathe" : ""
        }`}
      >
        <div className={`relative ${anim === "halo" ? "nt-ring" : ""}`}>
          <div
            className="relative grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-[#3d1a5c] to-[#1a1035] text-2xl font-semibold text-[#d4a5f9] ring-2 ring-[#b86ef9]/40"
            aria-hidden="true"
          >
            {t.initials}
          </div>
          {t.verified && (
            <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-[#1a1035] ring-1 ring-[#d4a05a]/60">
              <BadgeCheck className="h-4 w-4 text-[#f5c97a]" aria-label="Profil vérifié" />
            </span>
          )}
        </div>

        <h3 className="mt-4 text-lg font-semibold text-white">{t.name}</h3>
        <span className="mt-2 rounded-full bg-[#b86ef9]/15 px-3 py-1 text-xs font-medium text-[#e2c6ff]">
          {t.specialty}
        </span>
        <p className="mt-3 inline-flex items-center gap-1 text-xs text-[#d4c4e0]">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {t.city} ({t.canton})
        </p>
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-[#d4c4e0]">
          <Languages className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {t.languages.join(", ")}
        </p>

        <span
          className={`mt-5 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#b86ef9] px-4 text-sm font-semibold text-white transition-colors group-hover:bg-[#a855f7] ${
            anim === "shine" ? "nt-shine" : ""
          }`}
        >
          Voir le profil
          <ArrowRight className="nt-arrow h-4 w-4" aria-hidden="true" />
        </span>
      </a>
    </li>
  );
}

function Grid({ anim }: { anim: Anim }) {
  return (
    <section className="@container mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <h2
        className="text-2xl font-bold tracking-tight text-white"
        style={{ fontFamily: "'Cormorant Garamond', serif" }}
      >
        Nouveaux thérapeutes
      </h2>
      <p className="mt-2 text-sm text-[#d4c4e0]">Ils viennent de rejoindre le réseau Holiswiss</p>
      <ul className="mt-8 grid grid-cols-1 gap-6 @[560px]:grid-cols-2 @[960px]:grid-cols-4">
        {DEMO_THERAPISTS.map((t, i) => (
          <Card key={t.id} t={t} i={i} anim={anim} />
        ))}
      </ul>
    </section>
  );
}

export const NEW_THERAPISTS_ANIMATIONS = [
  {
    id: "animation-b1",
    name: "B1 — Apparition en cascade",
    description:
      "Les cartes montent une à une (60 ms d'écart, 500 ms, ease-out). Au survol : élévation de 6 px + ombre profonde, flèche qui avance.",
    Component: () => <Grid anim="stagger" />,
  },
  {
    id: "animation-b2",
    name: "B2 — Halo respirant + anneau lumineux",
    description:
      "Halo violet qui respire en continu (4,5 s). Au survol : anneau conique en rotation autour de l'avatar + élévation.",
    Component: () => <Grid anim="halo" />,
  },
  {
    id: "animation-b3",
    name: "B3 — Reflet sur le bouton",
    description:
      "Au survol : élévation, puis un reflet balaie le bouton « Voir le profil » (700 ms) et la flèche se décale.",
    Component: () => <Grid anim="shine" />,
  },
] as const;