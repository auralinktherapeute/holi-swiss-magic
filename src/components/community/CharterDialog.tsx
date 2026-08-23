import { useEffect, useRef, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import {
  CHARTER_TITLE,
  CHARTER_INTRO,
  CHARTER_POINTS,
  CHARTER_FOOTER,
} from "@/lib/community-charter.shared";

type Props = {
  open: boolean;
  familyName: string;
  submitting?: boolean;
  onClose: () => void;
  onAccept: () => void;
};

export function CharterDialog({ open, familyName, submitting, onClose, onAccept }: Props) {
  const [checked, setChecked] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setChecked(false);
      closeRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="charter-title"
    >
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 id="charter-title" className="text-lg font-semibold text-foreground">
              {CHARTER_TITLE}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer la charte"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {familyName && (
          <p className="mb-3 text-sm text-muted-foreground">
            Salon : <span className="font-medium text-foreground">{familyName}</span>
          </p>
        )}

        <p className="text-sm font-medium text-foreground">{CHARTER_INTRO}</p>
        <ol className="mt-2 space-y-2 text-sm text-muted-foreground">
          {CHARTER_POINTS.map((p, i) => (
            <li key={p.title} className="flex gap-2">
              <span className="font-semibold text-primary">{i + 1}.</span>
              <span>
                <span className="font-medium text-foreground">{p.title}</span> — {p.body}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">{CHARTER_FOOTER}</p>

        <label className="mt-4 flex min-h-11 items-center gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="h-5 w-5 rounded border-border accent-[var(--primary,#7c3aed)]"
          />
          J'ai lu et j'accepte la Charte de Bienveillance
        </label>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!checked || submitting}
            onClick={onAccept}
            className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {submitting ? "Enregistrement…" : "Accepter et entrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
