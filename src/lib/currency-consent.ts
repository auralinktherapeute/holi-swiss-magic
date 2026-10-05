// Logique partagée (client + serveur) du changement de devise.
import fr from "@/i18n/fr.json";
import de from "@/i18n/de.json";
import it from "@/i18n/it.json";
import en from "@/i18n/en.json";

export const CURRENCIES = ["CHF", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];
export type CurrencySource = "client_override" | "practice_default" | "fallback";
export type ConsentLang = "fr" | "de" | "it" | "en";

/** Version du texte d'avertissement — à incrémenter à chaque modification des textes. */
export const CURRENCY_WARNING_VERSION = "2026-10-05.v1";

const DICT: Record<ConsentLang, any> = { fr, de, it, en };

export function normalizeLang(l: string | null | undefined): ConsentLang {
  const s = String(l ?? "fr").slice(0, 2).toLowerCase();
  return (["fr", "de", "it", "en"] as const).includes(s as ConsentLang) ? (s as ConsentLang) : "fr";
}

/** Priorité : devise du client → devise du cabinet → CHF. */
export function resolveEffectiveCurrency(
  clientCurrency: string | null | undefined,
  practiceCurrency: string | null | undefined,
): { currency: Currency; source: CurrencySource } {
  if (clientCurrency === "CHF" || clientCurrency === "EUR") return { currency: clientCurrency, source: "client_override" };
  if (practiceCurrency === "CHF" || practiceCurrency === "EUR") return { currency: practiceCurrency, source: "practice_default" };
  return { currency: "CHF", source: "fallback" };
}

/** Texte exact de l'avertissement tel qu'affiché (titre + corps + case). */
export function buildCurrencyWarning(kind: "practice" | "client", lang: string, clientName = ""): string {
  const c = DICT[normalizeLang(lang)].currency;
  const title = kind === "practice" ? c.practice_dialog_title : c.client_dialog_title;
  const body = (kind === "practice" ? c.practice_warning : c.client_warning).replace("{{clientName}}", clientName);
  const ack = kind === "practice" ? c.practice_ack : c.client_ack;
  return `${title}\n\n${body}\n\n☑ ${ack}`;
}

/** Montant toujours affiché avec le code ISO, jamais un symbole. */
export function formatAmount(n: number, currency: string) {
  return `${(Number(n) || 0).toFixed(2)} ${currency}`;
}

/** Soldes séparés par devise (jamais additionnés entre devises). */
export function balancesByCurrency(invoices: { currency?: string | null; solde: number }[]) {
  const m = new Map<string, number>();
  for (const i of invoices) {
    const c = i.currency || "CHF";
    m.set(c, Math.round(((m.get(c) ?? 0) + (Number(i.solde) || 0)) * 100) / 100);
  }
  return [...m.entries()].filter(([, v]) => v !== 0).map(([currency, amount]) => ({ currency, amount }));
}
