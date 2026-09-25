import { cn } from "@/lib/utils";
import { formatUpdatedLabel, type PageModified } from "@/lib/page-dates";

/**
 * « Mis à jour le … » — rendu dans le HTML serveur.
 *
 * Reçoit une date DÉJÀ calculée par le loader (`pageModified` / `listModified`
 * sur les lignes réellement lues en production) et ne fait que la mettre en
 * forme, sans Intl ni horloge : texte identique au serveur et au navigateur.
 * Sans date, rien n'est rendu — jamais de date du jour en remplacement.
 */
export function LastUpdated({
  modified,
  lang,
  className,
  as: Tag = "p",
}: {
  modified: PageModified | null | undefined;
  lang: string;
  className?: string;
  as?: "p" | "span";
}) {
  const label = modified ? formatUpdatedLabel(modified.day, lang) : "";
  if (!modified || !label) return null;
  return (
    <Tag data-last-updated="" className={cn("text-xs text-white/50", className)}>
      <time dateTime={modified.day}>{label}</time>
    </Tag>
  );
}
