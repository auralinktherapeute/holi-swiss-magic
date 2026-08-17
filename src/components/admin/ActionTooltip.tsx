import type { ReactElement, ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Info-bulle accessible : s'affiche au survol ET au focus clavier (Radix).
 * Le texte est aussi exposé aux lecteurs d'écran via l'élément décrit.
 */
export function ActionTooltip({
  label,
  children,
  side = "top",
}: {
  label: ReactNode;
  children: ReactElement;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
