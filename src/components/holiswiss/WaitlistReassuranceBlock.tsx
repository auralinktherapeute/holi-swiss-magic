import { Sparkles } from "lucide-react";

function openWaitlist() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("open-waitlist"));
}

/**
 * Reassurance block for the homepage — luminous glass refinement direction.
 */
export function WaitlistReassuranceBlock() {
  return (
    <section
      aria-labelledby="waitlist-reassurance-title"
      className="mx-auto w-full max-w-2xl px-5 py-12 sm:py-16"
    >
      <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-b from-purple-900/25 to-indigo-950/50 p-8 sm:p-10 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        {/* Subtle background glows */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-purple-600/15 blur-[60px]" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-indigo-600/15 blur-[60px]" aria-hidden />

        <div className="relative flex flex-col items-center text-center">
          <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <Sparkles className="h-5 w-5 text-purple-300" aria-hidden />
          </div>

          <h2
            id="waitlist-reassurance-title"
            className="mb-4 font-serif italic text-2xl sm:text-3xl text-white"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Ouverture imminente
          </h2>

          <p className="mb-8 max-w-md text-sm sm:text-base leading-relaxed text-purple-100/75">
            Le site arrive très bientôt. En attendant, les inscriptions fonctionnent
            déjà et la liste d&apos;attente est ouverte pour accueillir les premiers
            praticiens.
          </p>

          <button
            type="button"
            onClick={openWaitlist}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl bg-white px-8 py-4 text-sm font-semibold text-[#0a0514] shadow-[0_0_24px_rgba(255,255,255,0.18)] transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
          >
            Je rejoins la liste d&apos;attente
          </button>

          <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-purple-300/60 font-medium">
            Accès prioritaire · Places limitées
          </p>
        </div>
      </div>
    </section>
  );
}