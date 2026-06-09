import { createFileRoute, redirect } from "@tanstack/react-router";
import { DEFAULT_LANG, SUPPORTED_LANGS } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    let lang: string = DEFAULT_LANG;
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("holiswiss-lang");
        if (stored && (SUPPORTED_LANGS as readonly string[]).includes(stored)) lang = stored;
      } catch {}
    }
    throw redirect({ to: "/$lang", params: { lang } });
  },
});
