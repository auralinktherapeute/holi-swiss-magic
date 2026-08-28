import { useMemo, useState } from "react";
import { Check, Info, Plus, Minus } from "lucide-react";
import type { TrustBadge } from "@/lib/therapist-badges";

const PREVIEW_COUNT = 3;

/**
 * Diplômes & certifications : 3 éléments en aperçu, le reste replié derrière un
 * bouton « + ». Les vérifiés passent en premier — c'est l'information la plus
 * utile au visiteur, elle ne doit pas se retrouver cachée dans le repli.
 */
export function CertificationsShowcase({
  badges,
  notice,
  title,
  labels,
}: {
  badges: TrustBadge[];
  notice?: string | null;
  title: string;
  labels: { expand: string; collapse: string };
}) {
  const [open, setOpen] = useState(false);

  const ordered = useMemo(
    () => [...badges].sort((a, b) => Number(b.verified) - Number(a.verified)),
    [badges],
  );

  if (!ordered.length) return null;

  const visible = open ? ordered : ordered.slice(0, PREVIEW_COUNT);
  const hidden = ordered.length - PREVIEW_COUNT;

  return (
    <section className="rounded-[1.5rem] border border-[rgba(184,110,249,0.2)] bg-[#1a0a2e] p-6 md:p-8 shadow-2xl shadow-purple-900/20">
      <h2 className="mb-6 flex items-center gap-3 text-lg md:text-xl font-bold text-white">
        <span className="h-7 w-1.5 rounded-full bg-[#b86ef9]" aria-hidden />
        {title}
      </h2>

      <ul className="flex flex-wrap gap-3">
        {visible.map((b, i) => (
          <li
            key={b.key}
            title={b.description}
            style={{ transitionDelay: open && i >= PREVIEW_COUNT ? `${(i - PREVIEW_COUNT) * 35}ms` : undefined }}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 transition-all duration-300 motion-safe:animate-in motion-safe:fade-in ${
              b.verified
                ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50 hover:bg-emerald-500/10"
                : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            <span
              aria-hidden
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                b.verified
                  ? "bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                  : "bg-white/10 text-white/40"
              }`}
            >
              {b.verified ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Info className="h-3 w-3" />}
            </span>
            <span
              className={`text-sm font-medium ${b.verified ? "text-emerald-50/90" : "text-white/70"}`}
            >
              {b.label}
            </span>
          </li>
        ))}

        {hidden > 0 && (
          <li>
            <button
              type="button"
              aria-expanded={open}
              aria-label={open ? labels.collapse : `${labels.expand} (${hidden})`}
              onClick={() => setOpen((v) => !v)}
              className="group flex h-[44px] min-w-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#b86ef9]/30 bg-[#b86ef9]/10 px-3 text-[#b86ef9] transition-all duration-300 hover:bg-[#b86ef9] hover:text-white hover:shadow-[0_0_20px_rgba(184,110,249,0.3)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a0a2e]"
            >
              {open ? (
                <Minus className="h-5 w-5" aria-hidden />
              ) : (
                <Plus className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" aria-hidden />
              )}
              <span className="text-sm font-semibold">{open ? labels.collapse : `+${hidden}`}</span>
            </button>
          </li>
        )}
      </ul>

      {notice && (
        <div className="mt-8 border-t border-white/5 pt-6">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-white/40" aria-hidden />
            <p className="text-xs leading-relaxed text-white/60">{notice}</p>
          </div>
        </div>
      )}
    </section>
  );
}
