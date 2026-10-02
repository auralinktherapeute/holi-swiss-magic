import { Info } from "lucide-react";

export function AutomationEmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground flex gap-3" role="status">
      <Info className="h-4 w-4 shrink-0 mt-0.5 text-cyan-300" aria-hidden />
      <p>{text}</p>
    </div>
  );
}
