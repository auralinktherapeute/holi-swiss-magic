import { useEffect } from "react";

/**
 * Fait défiler jusqu'à l'ancre présente dans l'URL (#section) et la met
 * temporairement en surbrillance. Utilisé par les actions du score de
 * visibilité pour amener le thérapeute exactement au bon champ.
 *
 * @param ready passe à true quand le contenu de la page est monté (fin du chargement)
 */
export function useHashFocus(ready: boolean = true) {
  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    const jump = () => {
      const id = window.location.hash.replace("#", "");
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      el.classList.add("hash-target");
      window.setTimeout(() => el.classList.remove("hash-target"), 2600);

      // Focus le premier champ incomplet de la section (sinon le premier contrôle).
      const controls = Array.from(
        el.querySelectorAll<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const isEmpty = (n: HTMLElement) =>
        (n instanceof HTMLInputElement || n instanceof HTMLTextAreaElement) && n.value.trim() === "";
      const target = controls.find(isEmpty) ?? controls[0];
      if (target) window.setTimeout(() => target.focus({ preventScroll: true }), reduce ? 0 : 420);
    };
    const raf = window.requestAnimationFrame(() => window.setTimeout(jump, 120));
    window.addEventListener("hashchange", jump);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("hashchange", jump);
    };
  }, [ready]);
}
