import { BadgeCheck, MapPin, Languages, ArrowRight } from "lucide-react";

/**
 * 3 variantes VISUELLES de la section « Nouveaux thérapeutes ».
 * Purement présentationnel : données de démonstration, aucun appel réseau,
 * aucune modification du composant de production `NewTherapistsShowcase`.
 */

export type DemoTherapist = {
  id: string;
  name: string;
  specialty: string;
  city: string;
  canton: string;
  languages: string[];
  verified: boolean;
  initials: string;
};

export const DEMO_THERAPISTS: DemoTherapist[] = [
  { id: "1", name: "Gregory Arshakuni", specialty: "Hypnothérapie", city: "Genève", canton: "GE", languages: ["FR", "EN"], verified: true, initials: "GA" },
  { id: "2", name: "Olivier Larue", specialty: "Ostéopathie", city: "Lausanne", canton: "VD", languages: ["FR"], verified: true, initials: "OL" },
  { id: "3", name: "Émilie Chardon", specialty: "Sophrologie", city: "Sion", canton: "VS", languages: ["FR", "DE"], verified: false, initials: "ÉC" },
  { id: "4", name: "Caroline Roch", specialty: "Réflexologie", city: "Fribourg", canton: "FR", languages: ["FR", "EN", "DE"], verified: true, initials: "CR" },
];

function Avatar({ t, className }: { t: DemoTherapist; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-[#3d1a5c] to-[#1a1035] font-semibold text-[#d4a5f9] ${className ?? ""}`}
      aria-hidden="true"
    >
      {t.initials}
    </div>
  );
}

function SectionShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <h2
        className="text-2xl font-bold tracking-tight text-white sm:text-3xl"
        style={{ fontFamily: "'Cormorant Garamond', serif" }}
      >
        {title}
      </h2>
      <p className="mt-2 text-sm text-[#d4c4e0]">{subtitle}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}

/* ---------- Version A — Éditoriale premium ---------- */
function VersionA() {
  return (
    <SectionShell title="Nouveaux thérapeutes" subtitle="Ils viennent de rejoindre le réseau Holiswiss">
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {DEMO_THERAPISTS.map((t) => (
          <li key={t.id}>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="group relative block overflow-hidden rounded-3xl ring-1 ring-[rgba(184,110,249,0.25)] transition-transform duration-200 ease-out hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9] motion-reduce:transform-none"
            >
              <Avatar t={t} className="aspect-[4/5] w-full text-4xl" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0f0a1e] via-[#0f0a1e]/85 to-transparent p-4 pt-16">
                <div className="flex items-center gap-1.5">
                  <h3 className="truncate text-lg font-semibold text-white">{t.name}</h3>
                  {t.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-[#f5c97a]" aria-label="Profil vérifié" />}
                </div>
                <p className="mt-0.5 text-sm text-[#d4a5f9]">{t.specialty}</p>
                <p className="mt-1 text-xs text-[#d4c4e0]">
                  {t.city} · {t.canton} · {t.languages.join(" ")}
                </p>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

/* ---------- Version B — Humaine et chaleureuse ---------- */
function VersionB() {
  return (
    <SectionShell title="Nouveaux thérapeutes" subtitle="Ils viennent de rejoindre le réseau Holiswiss">
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {DEMO_THERAPISTS.map((t) => (
          <li key={t.id}>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="group flex h-full flex-col items-center rounded-3xl border border-[rgba(184,110,249,0.22)] bg-[#2d1248]/70 p-6 text-center transition-all duration-200 ease-out hover:-translate-y-1 hover:border-[#b86ef9]/60 hover:shadow-[0_0_32px_rgba(184,110,249,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9] motion-reduce:transform-none"
            >
              <div className="relative">
                <Avatar t={t} className="h-24 w-24 rounded-full text-2xl ring-2 ring-[#b86ef9]/40" />
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
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {t.city} ({t.canton})
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-[#d4c4e0]">
                <Languages className="h-3.5 w-3.5" aria-hidden="true" /> {t.languages.join(", ")}
              </p>
              <span className="mt-auto flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#b86ef9] px-4 pt-3 text-sm font-semibold text-white transition-colors group-hover:bg-[#a855f7]">
                Voir le profil <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

/* ---------- Version C — Minimaliste suisse ---------- */
function VersionC() {
  return (
    <SectionShell title="Nouveaux thérapeutes" subtitle="Ils viennent de rejoindre le réseau Holiswiss">
      <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {DEMO_THERAPISTS.map((t) => (
          <li key={t.id}>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9]"
            >
              <Avatar t={t} className="aspect-[16/10] w-full rounded-xl text-3xl" />
              <div className="mt-4 flex items-start gap-2">
                <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-white">{t.name}</h3>
                {t.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-[#f5c97a]" aria-label="Profil vérifié" />}
              </div>
              <p className="mt-1 text-sm text-[#e6dcf2]">{t.specialty}</p>
              <p className="mt-2 text-xs uppercase tracking-wide text-[#c0b0d8]">
                {t.city} — {t.canton} · {t.languages.join(" / ")}
              </p>
              <span className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-[#d4a5f9] transition-colors group-hover:text-white">
                Voir le profil <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

export const NEW_THERAPISTS_VARIANTS = [
  {
    id: "version-a",
    name: "Version A — Éditoriale premium",
    description: "Portrait 4/5, nom en overlay, une seule zone cliquable par carte.",
    Component: VersionA,
  },
  {
    id: "version-b",
    name: "Version B — Humaine et chaleureuse",
    description: "Avatar circulaire 96 px centré, badge doré, CTA plein largeur ≥ 44 px.",
    Component: VersionB,
  },
  {
    id: "version-c",
    name: "Version C — Minimaliste suisse",
    description: "Grille 8 pt stricte, image 16/10, contrastes renforcés, CTA texte + flèche.",
    Component: VersionC,
  },
] as const;