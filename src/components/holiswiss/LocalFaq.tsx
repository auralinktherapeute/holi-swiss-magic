import type { LocalFaqSection } from "@/lib/local-faq";

/**
 * FAQ locale des pages ville / canton / spécialité (voir `src/lib/local-faq.ts`).
 *
 * Toujours dépliée (pas de <details>) : les réponses sont visibles telles
 * qu'elles figurent dans le JSON-LD FAQPage émis par le `head` de la route,
 * à partir du MÊME objet calculé dans le loader. Aucun appel de traduction
 * ici — rien qui puisse différer entre le rendu serveur et l'hydratation.
 */
export function LocalFaq({ faq, className }: { faq: LocalFaqSection | null | undefined; className?: string }) {
  if (!faq || faq.items.length === 0) return null;
  return (
    <section
      aria-labelledby="local-faq-title"
      className={className ?? "mt-12 rounded-2xl border border-[rgba(184,110,249,0.18)] bg-[#1a0a2e] p-6"}
    >
      <h2 id="local-faq-title" className="mb-1 text-lg font-semibold text-white">
        {faq.title}
      </h2>
      <p className="mb-5 text-sm text-[rgba(255,255,255,0.55)]">{faq.subtitle}</p>
      <dl className="divide-y divide-[rgba(168,85,247,0.18)] border-y border-[rgba(168,85,247,0.18)]">
        {faq.items.map((f, i) => (
          <div key={i} className="grid gap-1.5 py-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-6">
            <dt className="flex items-start gap-3 text-[0.95rem] font-semibold text-white">
              <span
                aria-hidden="true"
                className="mt-[0.45rem] h-1.5 w-1.5 flex-none rounded-full bg-gradient-to-br from-[#a855f7] to-[#22d3ee]"
              />
              <span>{f.question}</span>
            </dt>
            <dd className="pl-[1.125rem] text-sm leading-relaxed text-[#d4c4e0] sm:pl-0">{f.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
