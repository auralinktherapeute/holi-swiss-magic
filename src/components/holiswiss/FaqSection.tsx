import { useId } from "react";
import { ChevronDown } from "lucide-react";

export type FaqItem = { q: string; a: string };
export type FaqLang = "fr" | "de" | "it" | "en";

type Props = {
  items: FaqItem[];
  title?: string;
  subtitle?: string;
  /** Render JSON-LD FAQPage in the section. Defaults to true. */
  jsonLd?: boolean;
  className?: string;
};

/**
 * SSR-friendly FAQ section using native <details>/<summary> so questions and
 * answers are present in raw HTML for Google + AI crawlers. Includes
 * FAQPage JSON-LD inline for rich results.
 */
export function FaqSection({
  items,
  title = "Questions fréquentes",
  subtitle = "Tout ce que vous devez savoir sur Holiswiss et les thérapies complémentaires en Suisse",
  jsonLd = true,
  className,
}: Props) {
  const groupId = useId();
  if (!items || items.length === 0) return null;
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
  return (
    <section
      aria-labelledby={`${groupId}-title`}
      className={
        className ??
        "mx-auto w-full max-w-[800px] px-4 py-16 sm:px-6 lg:py-20"
      }
    >
      <header className="mb-8 text-center">
        <h2
          id={`${groupId}-title`}
          className="text-2xl font-bold tracking-tight text-white sm:text-3xl"
        >
          {title}
        </h2>
        {subtitle && (
          <p className="mt-3 text-sm text-[#d4c4e0] sm:text-base">{subtitle}</p>
        )}
      </header>

      <div className="space-y-3">
        {items.map((it, i) => (
          <details
            key={i}
            className="group rounded-2xl border border-[rgba(184,110,249,0.2)] bg-[#3d1a5c]/40 px-5 py-4 transition-colors open:border-[rgba(184,110,249,0.45)] open:bg-[#3d1a5c]/60"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2d1248] [&::-webkit-details-marker]:hidden">
              <span>{it.q}</span>
              <ChevronDown
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-[#b86ef9] transition-transform duration-300 ease-out group-open:rotate-180"
              />
            </summary>
            <div className="mt-3 text-sm leading-relaxed text-[#d4c4e0] sm:text-[15px]">
              {it.a}
            </div>
          </details>
        ))}
      </div>

      {jsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      )}
    </section>
  );
}
