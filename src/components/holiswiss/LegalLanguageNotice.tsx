import { institutionalCopy } from "@/lib/institutional-content";

export function LegalLanguageNotice({ lang }: { lang: string }) {
  if (lang === "fr") return null;
  return <p className="mb-6 border-l-2 border-accent pl-4 text-base text-muted-foreground">{institutionalCopy(lang).legalNotice}</p>;
}