import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subscribePublicNewsletter } from "@/lib/newsletter-public.functions";

type Source = "homepage_newsletter" | "public_footer" | "newsletter_resource_page";

const LOCALES = ["fr", "de", "it", "en"] as const;
type Locale = (typeof LOCALES)[number];

function useLang(): Locale {
  let lang = "fr";
  try {
    const p = useParams({ strict: false }) as Record<string, string>;
    if (p.lang) lang = p.lang;
  } catch {
    /* hors route /$lang */
  }
  return (LOCALES as readonly string[]).includes(lang) ? (lang as Locale) : "fr";
}

/** Formulaire d'inscription publique (aucun compte créé). */
function useSubscribeForm(source: Source) {
  const { t } = useTranslation();
  const locale = useLang();
  const subscribe = useServerFn(subscribePublicNewsletter);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      toast.error(t("newsletter_public.error"));
      return;
    }
    if (!consent) {
      toast.error(t("newsletter_public.consent_required"));
      return;
    }
    setLoading(true);
    try {
      await subscribe({ data: { email: value, consent: true, source, locale } });
      setDone(true);
      setEmail("");
      setConsent(false);
      toast.success(t("newsletter_public.success"));
    } catch {
      toast.error(t("newsletter_public.error"));
    } finally {
      setLoading(false);
    }
  };

  return { t, email, setEmail, consent, setConsent, loading, done, submit, locale };
}

function PrivacyLink({ lang }: { lang: Locale }) {
  const { t } = useTranslation();
  return (
    <a
      href={`/${lang}/confidentialite`}
      className="underline hover:text-[#d4a5f9]"
      target="_blank"
      rel="noreferrer"
    >
      {t("newsletter_public.privacy")}
    </a>
  );
}

/** Section pleine largeur pour la page d'accueil publique. */
export function NewsletterSection() {
  const { t, email, setEmail, consent, setConsent, loading, done, submit, locale } =
    useSubscribeForm("homepage_newsletter");
  const benefits = t("newsletter_public.benefits", { returnObjects: true }) as string[];

  return (
    <section aria-labelledby="newsletter-title" className="bg-[#2d1248]">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-10 rounded-3xl border border-[rgba(184,110,249,0.25)] bg-gradient-to-br from-[#3d1a5c] to-[#2d1248] p-6 sm:p-10 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#b86ef9]/15 px-3 py-1 text-xs font-semibold text-[#d4a5f9]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {t("newsletter_public.badge")}
            </span>
            <h2
              id="newsletter-title"
              className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl"
            >
              {t("newsletter_public.title")}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#d4c4e0]">
              {t("newsletter_public.text")}
            </p>
            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {benefits.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-[#d4c4e0]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7de3b8]" aria-hidden="true" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs italic text-[#a89bc4]">{t("newsletter_public.promo_note")}</p>
          </div>

          <div className="rounded-2xl border border-[rgba(184,110,249,0.25)] bg-[rgba(20,8,40,0.6)] p-5 sm:p-6">
            {done ? (
              <p className="flex items-start gap-2 text-sm text-[#7de3b8]">
                <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t("newsletter_public.success")}</span>
              </p>
            ) : (
              <form onSubmit={submit} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="nl-email" className="block text-sm font-medium text-white">
                    {t("newsletter_public.email_label")}
                  </label>
                  <Input
                    id="nl-email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={255}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("newsletter_public.email_placeholder")}
                    className="mt-2 min-h-[44px] border-[rgba(184,110,249,0.35)] bg-[rgba(20,8,40,0.7)] text-white placeholder:text-[#8f81ab]"
                  />
                </div>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 h-5 w-5 shrink-0 rounded border-[rgba(184,110,249,0.4)] bg-[rgba(20,8,40,0.5)] text-[#b86ef9] focus:ring-[#b86ef9]"
                  />
                  <span className="text-sm text-[#d4c4e0]">{t("newsletter_public.consent")}</span>
                </label>
                <Button
                  type="submit"
                  disabled={loading}
                  className="min-h-[44px] w-full gap-2 bg-[#b86ef9] text-white hover:bg-[#a855f7]"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  {t("newsletter_public.cta")}
                </Button>
                <p className="text-xs text-[#a89bc4]">
                  {t("newsletter_public.reassurance")} <PrivacyLink lang={locale} />.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Version compacte pour le pied de page public — même service d'inscription. */
export function NewsletterFooterCompact() {
  const { t, email, setEmail, consent, setConsent, loading, done, submit, locale } =
    useSubscribeForm("public_footer");

  return (
    <div>
      <h4 className="text-sm font-semibold text-white">{t("newsletter_public.footer_title")}</h4>
      <p className="mt-3 text-sm text-[#d4c4e0]">{t("newsletter_public.footer_text")}</p>
      {done ? (
        <p className="mt-3 text-sm text-[#7de3b8]">{t("newsletter_public.success")}</p>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-3" noValidate>
          <label htmlFor="nl-footer-email" className="sr-only">
            {t("newsletter_public.email_label")}
          </label>
          <Input
            id="nl-footer-email"
            type="email"
            autoComplete="email"
            required
            maxLength={255}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("newsletter_public.email_placeholder")}
            className="min-h-[44px] border-[rgba(184,110,249,0.35)] bg-[rgba(20,8,40,0.7)] text-white placeholder:text-[#8f81ab]"
          />
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-[rgba(184,110,249,0.4)] bg-[rgba(20,8,40,0.5)] text-[#b86ef9] focus:ring-[#b86ef9]"
            />
            <span className="text-xs text-[#d4c4e0]">{t("newsletter_public.consent")}</span>
          </label>
          <Button
            type="submit"
            disabled={loading}
            className="min-h-[44px] w-full bg-[#b86ef9] text-white hover:bg-[#a855f7]"
          >
            {t("newsletter_public.cta")}
          </Button>
          <p className="text-xs text-[#a89bc4]">
            <PrivacyLink lang={locale} />
          </p>
        </form>
      )}
    </div>
  );
}
