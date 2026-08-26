/**
 * Verrou de défilement partagé (compteur de références).
 *
 * Plusieurs modales peuvent être ouvertes/fermées en se chevauchant. Chacune
 * sauvegardant/restaurant `document.body.style.overflow` de son côté, la
 * dernière restaurait parfois la valeur "hidden" laissée par une autre :
 * la page restait bloquée définitivement. Ce compteur unique évite ce cas.
 */
let lockCount = 0;
let previousOverflow: string | null = null;

export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.body.style.overflow = previousOverflow ?? "";
      previousOverflow = null;
    }
  };
}

/** Filet de sécurité : libère le verrou quoi qu'il arrive. */
export function forceUnlockBodyScroll() {
  if (typeof document === "undefined") return;
  lockCount = 0;
  previousOverflow = null;
  document.body.style.overflow = "";
}
