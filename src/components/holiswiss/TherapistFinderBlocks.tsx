import { useMemo, useState } from "react";
import { Link, useLoaderData, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Search, X, ArrowRight, Sparkles, HeartPulse } from "lucide-react";
import { listAllSpecialties } from "@/lib/specialties.functions";

/**
 * Deux univers de recherche côte à côte (empilés sur mobile).
 *
 * La catégorie vient de `specialties.categories` : une spécialité peut porter
 * les deux tags, donc un même thérapeute peut apparaître dans les deux blocs
 * sans duplication de fiche.
 */

type Copy = {
  heading: string;
  wellness: { title: string; subtitle: string; placeholder: string; cta: string };
  holistic: { title: string; subtitle: string; placeholder: string; cta: string };
  none: string;
  clear: string;
  more: (n: number) => string;
};

const COPY: Record<string, Copy> = {
  fr: {
    heading: "Trouver un thérapeute",
    wellness: {
      title: "Thérapeutes bien-être",
      subtitle: "Détente, soin du corps et accompagnement au quotidien : massage, coaching, naturopathie.",
      placeholder: "Rechercher une spécialité bien-être (ex : massage, coaching, naturopathie...)",
      cta: "Voir tous les thérapeutes bien-être",
    },
    holistic: {
      title: "Thérapeutes holistiques",
      subtitle: "Approche énergétique, spirituelle et globale : magnétisme, radiesthésie, EMDR.",
      placeholder: "Rechercher une spécialité holistique (ex : magnétisme, EMDR, radiesthésie...)",
      cta: "Voir tous les thérapeutes holistiques",
    },
    none: "Aucune spécialité trouvée",
    clear: "Effacer",
    more: (n) => `+ ${n} autres spécialités`,
  },
  de: {
    heading: "Therapeutin oder Therapeut finden",
    wellness: {
      title: "Wellness-Therapeuten",
      subtitle: "Entspannung, Körperpflege und Alltagsbegleitung: Massage, Coaching, Naturheilkunde.",
      placeholder: "Wellness-Fachrichtung suchen (z. B. Massage, Coaching, Naturheilkunde...)",
      cta: "Alle Wellness-Therapeuten ansehen",
    },
    holistic: {
      title: "Ganzheitliche Therapeuten",
      subtitle: "Energetischer, spiritueller und ganzheitlicher Ansatz: Magnetismus, Radiästhesie, EMDR.",
      placeholder: "Ganzheitliche Fachrichtung suchen (z. B. Magnetismus, EMDR, Radiästhesie...)",
      cta: "Alle ganzheitlichen Therapeuten ansehen",
    },
    none: "Keine Fachrichtung gefunden",
    clear: "Löschen",
    more: (n) => `+ ${n} weitere Fachrichtungen`,
  },
  it: {
    heading: "Trova un terapeuta",
    wellness: {
      title: "Terapeuti del benessere",
      subtitle: "Relax, cura del corpo e accompagnamento quotidiano: massaggio, coaching, naturopatia.",
      placeholder: "Cerca una specialità benessere (es. massaggio, coaching, naturopatia...)",
      cta: "Vedi tutti i terapeuti del benessere",
    },
    holistic: {
      title: "Terapeuti olistici",
      subtitle: "Approccio energetico, spirituale e globale: magnetismo, radiestesia, EMDR.",
      placeholder: "Cerca una specialità olistica (es. magnetismo, EMDR, radiestesia...)",
      cta: "Vedi tutti i terapeuti olistici",
    },
    none: "Nessuna specialità trovata",
    clear: "Cancella",
    more: (n) => `+ ${n} altre specialità`,
  },
  en: {
    heading: "Find a therapist",
    wellness: {
      title: "Wellness therapists",
      subtitle: "Relaxation, body care and everyday support: massage, coaching, naturopathy.",
      placeholder: "Search a wellness specialty (e.g. massage, coaching, naturopathy...)",
      cta: "See all wellness therapists",
    },
    holistic: {
      title: "Holistic therapists",
      subtitle: "Energetic, spiritual and whole-person approach: magnetism, dowsing, EMDR.",
      placeholder: "Search a holistic specialty (e.g. magnetism, EMDR, dowsing...)",
      cta: "See all holistic therapists",
    },
    none: "No specialty found",
    clear: "Clear",
    more: (n) => `+ ${n} more specialties`,
  },
};

function pick(row: any, lang: string): string {
  return row?.[`name_${lang}`] || row?.name_fr || "";
}
function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const CHIP_LIMIT = 10;

export function TherapistFinderBlocks() {
  const { i18n } = useTranslation();
  const { lang } = useParams({ from: "/$lang/" });
  const uiLang = (lang || i18n.language || "fr").slice(0, 2);
  const c = COPY[uiLang] ?? COPY.fr;

  const fetchAll = useServerFn(listAllSpecialties);
  const { data, isLoading } = useQuery({
    queryKey: ["specialty-all"],
    queryFn: () => fetchAll(),
    staleTime: 5 * 60 * 1000,
  });

  const specialties = (data?.specialties ?? []) as any[];

  // Sélection du jour rendue côté serveur (stable 24 h, identique pour tous).
  const daily = useLoaderData({ from: "/$lang/", structuralSharing: false as any }) as any;

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <h2 className="text-center text-2xl font-bold tracking-tight text-white">{c.heading}</h2>
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <FinderBlock
          category="bien-etre"
          copy={c}
          text={c.wellness}
          icon={HeartPulse}
          gradient="from-[#10b981] to-[#5cc8fa]"
          specialties={specialties}
          daily={daily?.blocks?.["bien-etre"]}
          isLoading={isLoading}
          uiLang={uiLang}
          lang={lang}
        />
        <FinderBlock
          category="holistique"
          copy={c}
          text={c.holistic}
          icon={Sparkles}
          gradient="from-[#7c3aed] to-[#b86ef9]"
          specialties={specialties}
          daily={daily?.blocks?.["holistique"]}
          isLoading={isLoading}
          uiLang={uiLang}
          lang={lang}
        />
      </div>
    </section>
  );
}

function FinderBlock({
  category, copy, text, icon: Icon, gradient, specialties, daily, isLoading, uiLang, lang,
}: {
  category: "bien-etre" | "holistique";
  copy: Copy;
  text: Copy["wellness"];
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  gradient: string;
  specialties: any[];
  daily?: { chips: any[]; total: number };
  isLoading: boolean;
  uiLang: string;
  lang: string;
}) {
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);

  const items = useMemo(() => {
    const inCategory = specialties.filter((s) =>
      Array.isArray(s.categories) ? s.categories.includes(category) : false,
    );
    const sorted = [...inCategory].sort((a, b) => pick(a, uiLang).localeCompare(pick(b, uiLang)));
    if (!q.trim()) return sorted;
    const nq = normalize(q.trim());
    return sorted.filter(
      (s) =>
        normalize(pick(s, uiLang)).includes(nq) ||
        normalize(pick(s, "fr")).includes(nq) ||
        String(s.slug ?? "").includes(nq),
    );
  }, [specialties, category, q, uiLang]);

  // Par défaut : les pastilles du jour calculées côté serveur (nombre fixe,
  // donc hauteur de bloc constante quel que soit le nombre de spécialités).
  const searching = Boolean(q.trim());
  const dailyChips = daily?.chips ?? [];
  const dailyTotal = daily?.total ?? items.length;
  const visible = searching || showAll ? items : dailyChips.length > 0 ? dailyChips : items.slice(0, CHIP_LIMIT);
  const hidden = searching || showAll ? items.length - visible.length : Math.max(0, dailyTotal - visible.length);
  const showing = searching || showAll || dailyChips.length > 0 ? visible : visible;

  return (
    <div className="flex flex-col rounded-2xl border border-[rgba(184,110,249,0.25)] bg-[#3d1a5c] p-6">
      <div className="flex items-start gap-3">
        <span
          className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} shadow-[0_8px_24px_rgba(0,0,0,0.35)]`}
        >
          <Icon className="h-6 w-6 text-white" strokeWidth={1.5} />
        </span>
        <div>
          <h3 className="text-lg font-semibold text-white">{text.title}</h3>
          <p className="mt-1 text-sm text-[#d4c4e0]">{text.subtitle}</p>
        </div>
      </div>

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          placeholder={text.placeholder}
          aria-label={text.placeholder}
          className="min-h-[48px] w-full rounded-2xl border border-[rgba(184,110,249,0.35)] bg-[rgba(184,110,249,0.08)] py-3 pl-12 pr-10 text-base text-white placeholder-white/55 outline-none transition focus:border-[#b86ef9] focus-visible:ring-2 focus-visible:ring-[#b86ef9]"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label={copy.clear}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[#b86ef9]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-5 min-h-[96px] flex-1">
        {isLoading && dailyChips.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-white/5" />
            ))}
          </div>
        ) : showing.length === 0 ? (
          <p className="py-6 text-sm text-white/60">{copy.none}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {showing.map((s: any) => (
              <li key={s.id}>
                <Link
                  to="/$lang/therapeutes"
                  params={{ lang }}
                  search={{ specialite: s.slug } as any}
                  className="inline-flex min-h-[36px] items-center rounded-full border border-[rgba(184,110,249,0.35)] bg-[rgba(184,110,249,0.1)] px-4 py-1.5 text-sm text-white transition hover:border-[#b86ef9] hover:bg-[rgba(184,110,249,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9]"
                >
                  {pick(s, uiLang)}
                </Link>
              </li>
            ))}
            {!searching && hidden > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="inline-flex min-h-[36px] items-center rounded-full px-3 py-1.5 text-sm font-medium text-[#5cc8fa] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9]"
                >
                  {copy.more(hidden)}
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      <Link
        to={category === "bien-etre" ? "/$lang/therapeutes/bien-etre" : "/$lang/therapeutes/holistique"}
        params={{ lang }}
        className="mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#b86ef9] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#b86ef9]/30 transition hover:bg-[#a855f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {text.cta}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}
