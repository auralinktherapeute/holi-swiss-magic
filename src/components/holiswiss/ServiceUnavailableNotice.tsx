import { useRouter } from "@tanstack/react-router";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Panne de lecture essentielle : on le dit clairement au visiteur, dans sa
 * langue, avec un bouton « réessayer » qui relance le chargement. Aucun contenu
 * n'est inventé, aucune liste vide n'est présentée comme un vrai résultat.
 */
const T = {
  fr: {
    title: "Service temporairement indisponible",
    body: "Cette page n'a pas pu être chargée pour une raison technique. Vos données ne sont pas en cause. Merci de réessayer dans un instant.",
    retry: "Réessayer",
    retrying: "Chargement…",
  },
  de: {
    title: "Dienst vorübergehend nicht verfügbar",
    body: "Diese Seite konnte aus technischen Gründen nicht geladen werden. Ihre Daten sind davon nicht betroffen. Bitte versuchen Sie es in einem Moment erneut.",
    retry: "Erneut versuchen",
    retrying: "Wird geladen…",
  },
  it: {
    title: "Servizio temporaneamente non disponibile",
    body: "Questa pagina non è stata caricata per un problema tecnico. I tuoi dati non sono coinvolti. Riprova tra un istante.",
    retry: "Riprova",
    retrying: "Caricamento…",
  },
  en: {
    title: "Service temporarily unavailable",
    body: "This page could not be loaded for a technical reason. Your data is not affected. Please try again in a moment.",
    retry: "Try again",
    retrying: "Loading…",
  },
} as const;

export function serviceUnavailableCopy(lang: string) {
  return (T as unknown as Record<string, (typeof T)["fr"]>)[(lang ?? "fr").slice(0, 2)] ?? T.fr;
}

export function ServiceUnavailableNotice({ lang }: { lang: string }) {
  const router = useRouter();
  const copy = serviceUnavailableCopy(lang);
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    try {
      await router.invalidate();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      <div
        role="alert"
        aria-live="polite"
        className="w-full rounded-2xl border border-[rgba(184,110,249,0.25)] bg-[#1a0a2e] p-6 sm:p-8"
      >
        <AlertTriangle className="mx-auto h-8 w-8 text-[#f0b429]" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold text-white">{copy.title}</h1>
        <p className="mx-auto mt-3 max-w-prose text-sm leading-relaxed text-white/75 sm:text-base">
          {copy.body}
        </p>
        <Button
          type="button"
          onClick={retry}
          disabled={retrying}
          className="mt-6 min-h-[44px] gap-2 bg-[#b86ef9] font-semibold text-[#1a0a2e] hover:bg-[#a855f7] hover:text-[#1a0a2e]"
        >
          <RefreshCw className={retrying ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden />
          {retrying ? copy.retrying : copy.retry}
        </Button>
      </div>
    </div>
  );
}
