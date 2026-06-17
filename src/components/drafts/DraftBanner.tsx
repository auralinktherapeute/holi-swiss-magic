import { Button } from "@/components/ui/button";
import { FileClock, X } from "lucide-react";

type Props = {
  savedAt?: Date | null;
  onRestore: () => void;
  onDismiss: () => void;
};

function formatTime(d: Date) {
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

export function DraftBanner({ savedAt, onRestore, onDismiss }: Props) {
  return (
    <div
      role="status"
      className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
    >
      <div className="flex min-w-0 items-center gap-3">
        <FileClock className="h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="min-w-0 truncate">
          Vous avez un brouillon non terminé{savedAt ? ` (sauvegardé le ${formatTime(savedAt)})` : ""}. Reprendre&nbsp;?
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onRestore}>
          Reprendre
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Ignorer le brouillon"
          onClick={onDismiss}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function DraftSavedIndicator({ status, savedAt }: { status: "idle" | "saving" | "saved" | "error"; savedAt?: Date | null }) {
  if (status === "idle" && !savedAt) return null;
  let label = "";
  if (status === "saving") label = "Sauvegarde…";
  else if (status === "error") label = "Échec de la sauvegarde du brouillon";
  else if (savedAt) label = `Brouillon sauvegardé à ${savedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
  return (
    <span className={`text-xs ${status === "error" ? "text-red-300" : "text-[#a89bc4]"}`} aria-live="polite">
      {label}
    </span>
  );
}