import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { exporterSlides, slug } from "@/lib/carousel-export";
import lotusAsset from "@/assets/lotus-transparent.png.asset.json";

/**
 * Rendu visuel d'un carrousel Instagram, au format réel 4:5.
 *
 * Applique le système d'apposition du logo défini dans
 * `.agents/product-marketing.md` § 7 : marque de pied sur toutes les slides,
 * filigrane à 7 % sur les slides de corps (positions alternées), signature
 * pleine opacité sur la slide de CTA.
 */

export type SlideKind = "hook" | "body" | "accent" | "save" | "rupture" | "cta";

export type Slide = {
  kind: SlideKind;
  /** Sur-titre en capitales (ex. « La condition que presque personne ne connaît »). */
  label?: string;
  /** Ligne principale, en sérif. */
  title?: string;
  /** Corps de texte secondaire. */
  body?: string;
  /** Liste à puces (slides « à sauvegarder »). */
  items?: string[];
  /** Ligne d'avertissement, en corail. */
  warn?: string;
};

export type CarouselLang = "fr" | "de" | "it" | "en";

export type Carousel = {
  id: string;
  pilier: string;
  titre: string;
  score: number;
  /** Date de production/validation (AAAA-MM-JJ) — sert à l'archivage après 7 jours. */
  date?: string;
  /** Langue dans laquelle le carrousel a été rédigé à l'origine. */
  langueOrigine: CarouselLang;
  lectureTherapeute: string;
  lecturePatient: string;
  slides: Record<CarouselLang, Slide[]>;
  hashtags: Partial<Record<CarouselLang, string>>;
  /** Caption d'accompagnement — sert au rendu « Post », où elle porte tout le message. */
  caption?: Partial<Record<CarouselLang, string>>;
};

/** Deux façons de publier le même contenu. */
export type Vue = "carrousel" | "post";

const LANGS: { code: CarouselLang; label: string }[] = [
  { code: "fr", label: "🇫🇷 FR" },
  { code: "de", label: "🇩🇪 DE" },
  { code: "it", label: "🇮🇹 IT" },
  { code: "en", label: "🇬🇧 EN" },
];

/** Le filigrane alterne pour éviter l'effet de gabarit répété au défilement. */
const WATERMARK_POS = [
  { right: -155, bottom: -130 },
  { left: -170, bottom: -125 },
  { right: -178, top: -115 },
];

/** Slides où le vide EST le propos — ne pas y ajouter de filigrane. */
const NO_WATERMARK: SlideKind[] = ["hook", "save", "rupture", "cta"];

const GROUNDS: Record<SlideKind, string> = {
  hook: "radial-gradient(ellipse at 50% 0%, #4a2b74 0%, #1a0a2e 68%)",
  body: "radial-gradient(ellipse at 20% 0%, #3d2460 0%, #1a0a2e 62%)",
  accent: "radial-gradient(ellipse at 80% 10%, #4a2b74 0%, #1a0a2e 60%)",
  save: "radial-gradient(ellipse at 50% 100%, #33205a 0%, #160823 65%)",
  rupture: "#120620",
  cta: "radial-gradient(ellipse at 50% 45%, #2d1b4e 0%, #150722 70%)",
};

const SERIF = 'Playfair Display, "Iowan Old Style", Palatino, Georgia, serif';

export function CarouselViewer({ carousel }: { carousel: Carousel }) {
  const [lang, setLang] = useState<CarouselLang>(carousel.langueOrigine);
  const [vue, setVue] = useState<Vue>("carrousel");
  const [exporte, setExporte] = useState(false);

  const telecharger = async () => {
    setExporte(true);
    try {
      const base = `holiswiss-${slug(carousel.titre)}-${lang}`;
      await exporterSlides(slides, lotusAsset.url, base, vue === "post");
    } finally {
      setExporte(false);
    }
  };
  const slides = carousel.slides[lang] ?? carousel.slides[carousel.langueOrigine];
  const total = slides.length;
  let bodyIndex = -1;

  return (
    <article className="rounded-2xl border border-[rgba(184,110,249,0.25)] bg-[#1a0a2e] p-5">
      <header className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#b86ef9]">
          {carousel.pilier}
        </span>
        <h3 className="text-lg font-semibold text-white" style={{ fontFamily: SERIF }}>
          {carousel.titre}
        </h3>
        <span className="ml-auto text-xs tabular-nums text-white/45">
          {carousel.score}/100 · {total} slides
        </span>
        <button
          onClick={telecharger}
          disabled={exporte}
          title={
            vue === "post"
              ? "Télécharger l'image du post en 1080 × 1350"
              : `Télécharger les ${total} slides en 1080 × 1350`
          }
          className="flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1 text-xs font-semibold text-white/70 transition hover:border-[#b86ef9]/50 hover:text-white disabled:opacity-50"
        >
          {exporte ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {exporte ? "Export…" : vue === "post" ? "PNG" : `PNG ×${total}`}
        </button>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <div className="mr-2 flex rounded-lg border border-white/15 p-0.5" role="group" aria-label="Format d'affichage">
          {(["carrousel", "post"] as Vue[]).map((v) => (
            <button
              key={v}
              onClick={() => setVue(v)}
              aria-pressed={vue === v}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition ${
                vue === v ? "bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] text-white" : "text-white/55 hover:text-white"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        {LANGS.map((l) => {
          const dispo = !!carousel.slides[l.code]?.length;
          const actif = lang === l.code;
          return (
            <button
              key={l.code}
              onClick={() => dispo && setLang(l.code)}
              disabled={!dispo}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                actif
                  ? "bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] text-white"
                  : dispo
                    ? "border border-white/15 text-white/60 hover:text-white"
                    : "border border-white/10 text-white/25"
              }`}
              title={
                l.code === carousel.langueOrigine ? "Langue de rédaction d'origine" : undefined
              }
            >
              {l.label}
              {l.code === carousel.langueOrigine && " ·"}
            </button>
          );
        })}
      </div>

      {vue === "post" && <PostView carousel={carousel} lang={lang} slides={slides} />}

      {vue === "carrousel" && (
      <div
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3"
        role="group"
        aria-label={`Slides du carrousel ${carousel.titre}`}
        tabIndex={0}
      >
        {slides.map((s, i) => {
          const filigrane = !NO_WATERMARK.includes(s.kind);
          if (filigrane) bodyIndex += 1;
          const pos = WATERMARK_POS[bodyIndex % WATERMARK_POS.length];
          return (
            <div
              key={i}
              className="relative flex shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl border p-5"
              style={{
                width: 244,
                height: 305, // 4:5
                background: GROUNDS[s.kind],
                borderColor:
                  s.kind === "accent"
                    ? "rgba(34,211,238,.34)"
                    : s.kind === "save"
                      ? "rgba(240,128,106,.3)"
                      : s.kind === "rupture"
                        ? "rgba(255,255,255,.1)"
                        : "rgba(168,85,247,.22)",
              }}
            >
              <span
                aria-hidden="true"
                className="absolute left-0 right-0 top-0 h-0.5"
                style={{ background: "linear-gradient(90deg,#a855f7,#22d3ee)" }}
              />

              {filigrane && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute"
                  style={{
                    ...pos,
                    width: 156,
                    height: 156,
                    opacity: 0.07,
                    backgroundImage: `url(${lotusAsset.url})`,
                    backgroundSize: "contain",
                    backgroundRepeat: "no-repeat",
                  }}
                />
              )}

              <div
                className={`relative z-10 flex flex-col gap-2 ${
                  s.kind === "hook" || s.kind === "rupture" || s.kind === "cta"
                    ? "my-auto items-center text-center"
                    : ""
                }`}
              >
                {s.kind === "cta" && (
                  <span
                    role="img"
                    aria-label="Holiswiss"
                    className="mb-1 block"
                    style={{
                      width: 48,
                      height: 48,
                      backgroundImage: `url(${lotusAsset.url})`,
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                    }}
                  />
                )}
                {s.label && (
                  <p
                    className="m-0 text-[9px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: s.kind === "rupture" ? "#f0806a" : "#22d3ee" }}
                  >
                    {s.label}
                  </p>
                )}
                {s.title && (
                  <p
                    className="m-0 text-white"
                    style={{
                      fontFamily: SERIF,
                      fontSize: s.kind === "hook" ? 21 : 16,
                      lineHeight: 1.24,
                    }}
                  >
                    {s.title}
                  </p>
                )}
                {s.body && (
                  <p
                    className="m-0 leading-relaxed"
                    style={{
                      fontSize: 11.5,
                      color: s.kind === "cta" ? "#22d3ee" : "rgba(255,255,255,.72)",
                    }}
                  >
                    {s.body}
                  </p>
                )}
                {s.warn && (
                  <p className="m-0 text-[11px] font-medium leading-snug" style={{ color: "#f0806a" }}>
                    {s.warn}
                  </p>
                )}
                {s.items && (
                  <ul className="m-0 flex list-disc flex-col gap-1 pl-3.5">
                    {s.items.map((it, k) => (
                      <li
                        key={k}
                        className="leading-snug"
                        style={{ fontSize: 10.5, color: "rgba(255,255,255,.86)" }}
                      >
                        {it}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="relative z-10 flex items-center justify-between pt-2">
                {s.kind === "cta" ? (
                  <span className="text-[8px] tracking-[0.1em] text-white/45">holiswiss.ch</span>
                ) : (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 16,
                      height: 16,
                      opacity: 0.85,
                      backgroundImage: `url(${lotusAsset.url})`,
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                    }}
                  />
                )}
                <span className="text-[8px] tabular-nums tracking-wide text-white/30">
                  {i + 1}/{total}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      )}

      <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
        <div>
          <dt className="inline font-semibold text-[#22d3ee]">Lecture thérapeute — </dt>
          <dd className="inline text-white/60">{carousel.lectureTherapeute}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-[#22d3ee]">Lecture patient — </dt>
          <dd className="inline text-white/60">{carousel.lecturePatient}</dd>
        </div>
      </dl>

      {vue === "carrousel" && carousel.hashtags[lang] && (
        <p className="mt-3 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/45">
          {carousel.hashtags[lang]}
        </p>
      )}
    </article>
  );
}

/**
 * Rendu « Post » — une seule image 4:5 accompagnée de sa caption, tel que
 * l'utilisateur le verra dans son fil. Le visuel reprend la slide d'accroche :
 * c'est elle qui doit porter le message quand il n'y a pas de défilement.
 */
function PostView({
  carousel,
  lang,
  slides,
}: {
  carousel: Carousel;
  lang: CarouselLang;
  slides: Slide[];
}) {
  const visuel = slides.find((s) => s.kind === "hook") ?? slides[0];
  const caption = carousel.caption?.[lang];
  const hashtags = carousel.hashtags[lang];

  return (
    <div className="flex flex-col gap-4 pb-3 sm:flex-row sm:items-start">
      <div
        className="relative flex shrink-0 flex-col justify-between overflow-hidden rounded-xl border p-5"
        style={{
          width: 244,
          height: 305,
          background: GROUNDS.hook,
          borderColor: "rgba(168,85,247,.22)",
        }}
      >
        <span
          aria-hidden="true"
          className="absolute left-0 right-0 top-0 h-0.5"
          style={{ background: "linear-gradient(90deg,#a855f7,#22d3ee)" }}
        />
        <div className="relative z-10 my-auto flex flex-col items-center gap-2 text-center">
          {visuel.label && (
            <p className="m-0 text-[9px] font-bold uppercase tracking-[0.14em] text-[#22d3ee]">
              {visuel.label}
            </p>
          )}
          {visuel.title && (
            <p className="m-0 text-white" style={{ fontFamily: SERIF, fontSize: 21, lineHeight: 1.24 }}>
              {visuel.title}
            </p>
          )}
          {visuel.body && (
            <p className="m-0 leading-relaxed" style={{ fontSize: 11.5, color: "rgba(255,255,255,.72)" }}>
              {visuel.body}
            </p>
          )}
        </div>
        <div className="relative z-10 flex items-center justify-between pt-2">
          <span
            aria-hidden="true"
            style={{
              width: 16,
              height: 16,
              opacity: 0.85,
              backgroundImage: `url(${lotusAsset.url})`,
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
            }}
          />
          <span className="text-[8px] tracking-[0.1em] text-white/45">holiswiss.ch</span>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        {caption ? (
          <p className="whitespace-pre-line text-[13px] leading-relaxed text-white/80">{caption}</p>
        ) : (
          <p className="rounded-lg border border-dashed border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Pas de caption rédigée pour cette langue. En vue « Post », c'est elle qui porte le
            message — le visuel seul ne suffit pas.
          </p>
        )}
        {hashtags && (
          <p className="mt-3 text-[11px] leading-relaxed text-white/40">{hashtags}</p>
        )}
      </div>
    </div>
  );
}
