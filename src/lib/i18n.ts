import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "@/i18n/fr.json";
import de from "@/i18n/de.json";
import it from "@/i18n/it.json";
import en from "@/i18n/en.json";

export const SUPPORTED_LANGS = ["fr", "de", "it", "en"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];
export const DEFAULT_LANG: Lang = "fr";

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources: {
        fr: { translation: fr },
        de: { translation: de },
        it: { translation: it },
        en: { translation: en },
      },
      lng: DEFAULT_LANG,
      fallbackLng: DEFAULT_LANG,
      supportedLngs: SUPPORTED_LANGS as unknown as string[],
      interpolation: { escapeValue: false },
      returnObjects: true,
      returnNull: false,
    });
}

export default i18n;

export function isLang(value: string | undefined): value is Lang {
  return !!value && (SUPPORTED_LANGS as readonly string[]).includes(value);
}