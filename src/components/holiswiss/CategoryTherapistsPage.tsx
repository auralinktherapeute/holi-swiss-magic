import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCategoryPage, pickI18n } from "@/lib/specialties.functions";
import { TherapistCardCompact } from "@/components/holiswiss/TherapistCardCompact";
import type { PublicTherapistCard } from "@/lib/geo-listings.functions";

export type FinderCategorySlug = "bien-etre" | "holistique";

export const CATEGORY_COPY: Record<
  FinderCategorySlug,
  Record<string, { h1: string; intro: string; title: string; description: string }>
> = {
  "bien-etre": {
    fr: {
      h1: "Thérapeutes bien-être en Suisse",
      intro: "Détente, soin du corps et accompagnement au quotidien : massage, coaching de vie, naturopathie, nutrition, méditation.",
      title: "Thérapeutes bien-être en Suisse | Holiswiss",
      description: "Trouvez un thérapeute bien-être en Suisse : massage, coaching de vie, naturopathie, nutrition, ostéopathie, méditation. Profils vérifiés, réservation en ligne.",
    },
    de: {
      h1: "Wellness-Therapeuten in der Schweiz",
      intro: "Entspannung, Körperpflege und Alltagsbegleitung: Massage, Life-Coaching, Naturheilkunde, Ernährung, Meditation.",
      title: "Wellness-Therapeuten in der Schweiz | Holiswiss",
      description: "Finden Sie Wellness-Fachpersonen in der Schweiz: Massage, Coaching, Naturheilkunde, Ernährung, Osteopathie, Meditation. Geprüfte Profile, Online-Buchung.",
    },
    it: {
      h1: "Terapeuti del benessere in Svizzera",
      intro: "Relax, cura del corpo e accompagnamento quotidiano: massaggio, coaching, naturopatia, nutrizione, meditazione.",
      title: "Terapeuti del benessere in Svizzera | Holiswiss",
      description: "Trova un terapeuta del benessere in Svizzera: massaggio, coaching, naturopatia, nutrizione, osteopatia, meditazione. Profili verificati, prenotazione online.",
    },
    en: {
      h1: "Wellness therapists in Switzerland",
      intro: "Relaxation, body care and everyday support: massage, life coaching, naturopathy, nutrition, meditation.",
      title: "Wellness therapists in Switzerland | Holiswiss",
      description: "Find a wellness therapist in Switzerland: massage, life coaching, naturopathy, nutrition, osteopathy, meditation. Verified profiles, online booking.",
    },
  },
  holistique: {
    fr: {
      h1: "Thérapeutes holistiques en Suisse",
      intro: "Approche énergétique, spirituelle et globale : magnétisme, radiesthésie, EMDR, hypnose, soins énergétiques, accompagnement du deuil.",
      title: "Thérapeutes holistiques en Suisse | Holiswiss",
      description: "Trouvez un thérapeute holistique en Suisse : magnétisme, radiesthésie, EMDR, hypnose, soins énergétiques, guérison spirituelle. Profils vérifiés, réservation en ligne.",
    },
    de: {
      h1: "Ganzheitliche Therapeuten in der Schweiz",
      intro: "Energetischer, spiritueller und ganzheitlicher Ansatz: Magnetismus, Radiästhesie, EMDR, Hypnose, Energiearbeit, Trauerbegleitung.",
      title: "Ganzheitliche Therapeuten in der Schweiz | Holiswiss",
      description: "Finden Sie ganzheitliche Fachpersonen in der Schweiz: Magnetismus, Radiästhesie, EMDR, Hypnose, Energiearbeit, geistiges Heilen. Geprüfte Profile, Online-Buchung.",
    },
    it: {
      h1: "Terapeuti olistici in Svizzera",
      intro: "Approccio energetico, spirituale e globale: magnetismo, radiestesia, EMDR, ipnosi, terapia energetica, accompagnamento al lutto.",
      title: "Terapeuti olistici in Svizzera | Holiswiss",
      description: "Trova un terapeuta olistico in Svizzera: magnetismo, radiestesia, EMDR, ipnosi, terapia energetica, guarigione spirituale. Profili verificati, prenotazione online.",
    },
    en: {
      h1: "Holistic therapists in Switzerland",
      intro: "Energetic, spiritual and whole-person approach: magnetism, dowsing, EMDR, hypnosis, energy therapy, grief support.",
      title: "Holistic therapists in Switzerland | Holiswiss",
      description: "Find a holistic therapist in Switzerland: magnetism, dowsing, EMDR, hypnosis, energy therapy, spiritual healing. Verified profiles, online booking.",
    },
  },
};

export function categoryCopy(category: FinderCategorySlug, lang: string) {
  const byLang = CATEGORY_COPY[category];
  return byLang[lang] ?? byLang.fr;
}

const LABELS: Record<string, { specialties: string; therapists: string; empty: string; back: string; loading: string }> = {
  fr: { specialties: "Spécialités de cet univers", therapists: "Thérapeutes", empty: "Aucun thérapeute dans cet univers pour le moment.", back: "Voir tout l'annuaire", loading: "Chargement…" },
  de: { specialties: "Fachrichtungen dieses Bereichs", therapists: "Therapeuten", empty: "Zurzeit keine Fachperson in diesem Bereich.", back: "Gesamtes Verzeichnis ansehen", loading: "Wird geladen…" },
  it: { specialties: "Specialità di questo universo", therapists: "Terapeuti", empty: "Nessun terapeuta in questo universo per ora.", back: "Vedi tutta la directory", loading: "Caricamento…" },
  en: { specialties: "Specialties in this universe", therapists: "Therapists", empty: "No therapist in this universe yet.", back: "Browse the full directory", loading: "Loading…" },
};

export function CategoryTherapistsPage({
  category, lang, initialData,
}: {
  category: FinderCategorySlug;
  lang: string;
  initialData?: any;
}) {
  const fetchPage = useServerFn(getCategoryPage);
  const { data, isLoading } = useQuery({
    queryKey: ["category-page", category],
    initialData,
    queryFn: () => fetchPage({ data: { category } }),
  });

  const copy = categoryCopy(category, lang);
  const l = LABELS[lang] ?? LABELS.fr;
  const specialties = (data?.specialties ?? []) as any[];
  const therapists = (data?.therapists ?? []) as PublicTherapistCard[];

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{copy.h1}</h1>
      <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#d4c4e0]">{copy.intro}</p>

      <h2 className="mt-12 text-lg font-semibold text-white">{l.specialties}</h2>
      <ul className="mt-4 flex flex-wrap gap-2">
        {specialties
          .slice()
          .sort((a, b) => pickI18n(a, lang).localeCompare(pickI18n(b, lang)))
          .map((s) => (
            <li key={s.id}>
              <Link
                to="/$lang/therapeutes"
                params={{ lang }}
                search={{ specialite: s.slug } as any}
                className="inline-flex min-h-[36px] items-center rounded-full border border-[rgba(184,110,249,0.35)] bg-[rgba(184,110,249,0.1)] px-4 py-1.5 text-sm text-white transition hover:border-[#b86ef9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9]"
              >
                {pickI18n(s, lang)}
              </Link>
            </li>
          ))}
      </ul>

      <h2 className="mt-12 text-lg font-semibold text-white">
        {l.therapists} ({therapists.length})
      </h2>
      {isLoading && therapists.length === 0 ? (
        <p className="mt-4 text-sm text-white/60">{l.loading}</p>
      ) : therapists.length === 0 ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-white/60">{l.empty}</p>
          <Link to="/$lang/therapeutes" params={{ lang }} className="text-sm text-[#5cc8fa] underline">
            {l.back}
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {therapists.map((t) => (
            <TherapistCardCompact key={t.id} t={t} lang={lang} />
          ))}
        </div>
      )}
    </div>
  );
}
