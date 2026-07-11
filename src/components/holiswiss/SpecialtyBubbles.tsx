import { useMemo, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import {
  Search, X, Brain, Leaf, Flower2, Footprints, Moon, HandHeart, HeartPulse,
  Sparkles, Sprout, Droplets, Wind, Sun, Apple, Palette, Music2, Eye,
  Hand, Waves, Mountain, Feather, Activity, Circle, Heart, Zap, Star,
  TreeDeciduous, Flame, Users, Compass,
} from "lucide-react";
import { listAllSpecialties } from "@/lib/specialties.functions";

function pick(row: any, lang: string): string {
  return row?.[`name_${lang}`] || row?.name_fr || "";
}

type IconCmp = React.ComponentType<{ className?: string; strokeWidth?: number }>;
const ICON_BY_SLUG: Record<string, IconCmp> = {
  sophrologie: Brain,
  hypnose: Moon,
  naturopathie: Leaf,
  meditation: Flower2,
  reflexologie: Footprints,
  acupuncture: Zap,
  ayurveda: Sprout,
  reiki: HandHeart,
  osteopathie: Activity,
  shiatsu: Hand,
  "fleurs-de-bach": Flower2,
  sommeil: Moon,
  lithotherapie: Star,
  sonotherapie: Music2,
  nutrition: Apple,
  respiration: Wind,
  breathwork: Wind,
  hydrotherapie: Droplets,
  heliotherapie: Sun,
  sylvotherapie: TreeDeciduous,
  emdr: Eye,
  energetique: Sparkles,
  magnetisme: Sparkles,
  "coherence-cardiaque": HeartPulse,
  massage: Hand,
  "massage-bien-etre": Hand,
  massotherapie: Hand,
  aromatherapie: Flame,
  "danse-therapie": Users,
  "art-therapie": Palette,
  eft: Feather,
  geobiologie: Compass,
  thalassotherapie: Waves,
  "marche-therapie": Mountain,
  yoga: Flower2,
  phytotherapie: Leaf,
  psychotherapie: Brain,
  "accompagnement-psy": Users,
  micronutrition: Apple,
  relaxation: Wind,
  "medecine-chinoise": Sparkles,
  radiesthesie: Compass,
  lahochi: Sparkles,
  kinesiologie: HeartPulse,
  "coaching-de-vie": Compass,
};

const GRADIENTS = [
  "from-[#7c3aed] to-[#b86ef9]",   // violet
  "from-[#a855f7] to-[#ec4899]",   // magenta/rose
  "from-[#10b981] to-[#5cc8fa]",   // green→teal
  "from-[#ef4444] to-[#f97316]",   // coral
  "from-[#5cc8fa] to-[#b86ef9]",   // cyan→violet
  "from-[#f472b6] to-[#a78bfa]",   // pink→lavender
];

const T: Record<string, {
  placeholder: string; clear: string; more: string; less: string; none: string; loading: string;
}> = {
  fr: { placeholder: "Rechercher une spécialité (ex : EMDR, Ayurveda, Sonothérapie…)", clear: "Effacer", more: "Afficher plus", less: "Afficher moins", none: "Aucune spécialité trouvée", loading: "Chargement…" },
  de: { placeholder: "Fachrichtung suchen (z. B. EMDR, Ayurveda, Klangtherapie…)", clear: "Löschen", more: "Mehr anzeigen", less: "Weniger anzeigen", none: "Keine Fachrichtung gefunden", loading: "Wird geladen…" },
  it: { placeholder: "Cerca una specialità (es. EMDR, Ayurveda, Sonoterapia…)", clear: "Cancella", more: "Mostra di più", less: "Mostra meno", none: "Nessuna specialità trovata", loading: "Caricamento…" },
  en: { placeholder: "Search a specialty (e.g. EMDR, Ayurveda, Sound therapy…)", clear: "Clear", more: "Show more", less: "Show less", none: "No specialty found", loading: "Loading…" },
};

const PAGE_SIZE = 30;

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function SpecialtyBubbles() {
  const { i18n } = useTranslation();
  const { lang } = useParams({ from: "/$lang/" });
  const uiLang = (lang || i18n.language || "fr").slice(0, 2);
  const t = T[uiLang] ?? T.fr;

  const fetchAll = useServerFn(listAllSpecialties);
  const { data, isLoading } = useQuery({
    queryKey: ["specialty-all"],
    queryFn: () => fetchAll(),
    staleTime: 5 * 60 * 1000,
  });

  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);

  const items = useMemo(() => {
    const specs = (data?.specialties ?? []) as any[];
    const sorted = [...specs].sort((a, b) => pick(a, uiLang).localeCompare(pick(b, uiLang)));
    if (!q.trim()) return sorted;
    const nq = normalize(q.trim());
    return sorted.filter((s) =>
      normalize(pick(s, uiLang)).includes(nq) ||
      normalize(pick(s, "fr")).includes(nq) ||
      s.slug.includes(nq),
    );
  }, [data, q, uiLang]);

  const visible = showAll || q.trim() ? items : items.slice(0, PAGE_SIZE);

  return (
    <section className="w-full">
      {/* Search */}
      <div className="relative mx-auto max-w-2xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          placeholder={t.placeholder}
          aria-label={t.placeholder}
          className="w-full rounded-2xl border border-[rgba(184,110,249,0.35)] bg-[rgba(184,110,249,0.08)] py-3 pl-12 pr-10 text-sm text-white placeholder-white/55 outline-none transition focus:border-[#b86ef9]"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label={t.clear}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Bubbles grid */}
      <div className="mt-10">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 md:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="h-20 w-20 animate-pulse rounded-full bg-white/5 sm:h-24 sm:w-24" />
                <div className="h-3 w-16 animate-pulse rounded bg-white/5" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-sm text-white/60">{t.none}</div>
        ) : (
          <ul className="grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 md:grid-cols-6">
            {visible.map((s: any, idx: number) => {
              const Icon = ICON_BY_SLUG[s.slug] ?? Sparkles;
              const grad = GRADIENTS[idx % GRADIENTS.length];
              const label = pick(s, uiLang);
              return (
                <li key={s.id} className="flex flex-col items-center">
                  <Link
                    to="/$lang/therapeutes"
                    params={{ lang }}
                    search={{ specialite: s.slug } as any}
                    aria-label={label}
                    className="group flex flex-col items-center gap-2 focus:outline-none"
                  >
                    <span
                      className={`relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ${grad} shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-transform duration-200 ease-out group-hover:scale-105 group-hover:shadow-[0_10px_36px_rgba(184,110,249,0.55)] group-focus-visible:ring-2 group-focus-visible:ring-white/80 sm:h-24 sm:w-24`}
                    >
                      <Icon className="h-8 w-8 text-white sm:h-9 sm:w-9" strokeWidth={1.5} />
                    </span>
                    <span className="text-center text-xs font-medium leading-tight text-white sm:text-sm">
                      {label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!q.trim() && items.length > PAGE_SIZE && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-sm font-medium text-[#5cc8fa] underline-offset-4 hover:underline"
          >
            {showAll ? t.less : `${t.more} (${items.length - PAGE_SIZE})`}
          </button>
        </div>
      )}
    </section>
  );
}