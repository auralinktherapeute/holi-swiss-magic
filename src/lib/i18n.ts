import i18n, { type Resource } from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "@/i18n/fr.json";
import de from "@/i18n/de.json";
import it from "@/i18n/it.json";
import en from "@/i18n/en.json";

export const SUPPORTED_LANGS = ["fr", "de", "it", "en"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];
export const DEFAULT_LANG: Lang = "fr";

export function isLang(value: string | undefined): value is Lang {
  return !!value && (SUPPORTED_LANGS as readonly string[]).includes(value);
}

/** Langue déduite du premier segment de l'URL — seule source de vérité au rendu serveur. */
export function detectLangFromPath(pathname: string | undefined | null): Lang {
  const seg = (pathname ?? "").split("/").filter(Boolean)[0];
  return isLang(seg) ? seg : DEFAULT_LANG;
}

export const resources = {
  fr: { translation: fr },
  de: { translation: de },
  it: { translation: it },
  en: { translation: en },
} as const;

const baseOptions = {
  resources: resources as unknown as Resource,
  fallbackLng: DEFAULT_LANG,
  supportedLngs: SUPPORTED_LANGS as unknown as string[],
  interpolation: { escapeValue: false },
  returnObjects: true,
  returnNull: false,
} as const;

/**
 * RENDU SERVEUR — une instance i18next PAR REQUÊTE.
 *
 * Le singleton exporté ci-dessous est un module partagé par toutes les requêtes
 * d'un même worker. Jusqu'au 15/09/2026, `/$lang` appelait
 * `i18n.changeLanguage()` dessus pendant `beforeLoad` : deux requêtes
 * simultanées (/fr et /it) se écrasaient mutuellement la langue entre le
 * `beforeLoad` et le rendu React. Résultat reproductible avec 8 GET parallèles :
 * `<html lang>` et les titres (calculés depuis les paramètres d'URL) restaient
 * corrects, mais le menu, les CTA et le pied de page — qui passent par
 * `useTranslation()` — sortaient dans la langue d'une autre requête, la même
 * pour toutes les réponses en vol.
 *
 * Fixer la langue « juste avant le rendu » ne corrige rien : le rendu React est
 * asynchrone et entrelacé (streaming), donc une autre requête peut toujours
 * s'intercaler. La seule correction sûre est une instance dédiée, fournie par
 * `I18nextProvider` au-dessus de tout l'arbre (voir `src/routes/__root.tsx`).
 */
export function createI18nForLang(lang: Lang) {
  const instance = i18n.createInstance();
  // Volontairement SANS `initReactI18next` : ce plugin enregistre l'instance
  // comme instance globale de react-i18next — exactement le partage qu'on veut
  // supprimer. Le contexte du provider suffit à `useTranslation()`.
  void instance.init({ ...baseOptions, lng: lang });
  return instance;
}

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      ...baseOptions,
      // Au chargement du module côté navigateur, la langue vient de l'URL : elle
      // doit correspondre exactement à celle utilisée au rendu serveur, sinon
      // l'hydratation diverge.
      lng:
        typeof window !== "undefined"
          ? detectLangFromPath(window.location.pathname)
          : DEFAULT_LANG,
      saveMissing: import.meta.env?.DEV ?? false,
      missingKeyHandler: (lngs, ns, key) => {
        if (typeof console !== "undefined" && (import.meta.env?.DEV ?? false)) {
          // eslint-disable-next-line no-console
          console.warn(`[i18n] missing key "${key}" for ${lngs.join(",")}`);
        }
      },
    });
}

export default i18n;
