import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subscribePublicNewsletter } from "@/lib/newsletter-public.functions";

export type Source = "homepage_newsletter" | "public_footer" | "newsletter_resource_page";

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
export function useSubscribeForm(source: Source) {
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

export function PrivacyLink({ lang }: { lang: Locale }) {
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
  const raw = t("newsletter_public.benefits", { returnObjects: true });
  const benefits = Array.isArray(raw) ? (raw as string[]) : [];

  return (
    <section aria-labelledby="newsletter-title" className="relative overflow-hidden bg-[#2d1248]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#b86ef9]/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-[#5cc8fa]/15 blur-3xl"
      />
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-10 rounded-3xl border border-[rgba(184,110,249,0.3)] bg-gradient-to-br from-[#3d1a5c] via-[#341552] to-[#2d1248] p-6 shadow-[0_0_60px_rgba(184,110,249,0.18)] sm:p-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#b86ef9]/40 bg-[#b86ef9]/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#d4a5f9]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {t("newsletter_public.badge")}
            </span>
            <h2
              id="newsletter-title"
              className="mt-4 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl"
            >
              {t("newsletter_public.title")}
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[#d4c4e0]">
              {t("newsletter_public.text")}
            </p>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {benefits.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2.5 rounded-xl border border-[rgba(184,110,249,0.18)] bg-[rgba(20,8,40,0.4)] px-3 py-2.5 text-sm text-[#d4c4e0]"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7de3b8]" aria-hidden="true" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs italic text-[#a89bc4]">{t("newsletter_public.promo_note")}</p>
          </div>

          <div className="rounded-2xl border border-[rgba(184,110,249,0.3)] bg-[rgba(20,8,40,0.7)] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur sm:p-7">
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
                  className="min-h-[48px] w-full gap-2 bg-gradient-to-r from-[#b86ef9] to-[#8b4ddb] text-base font-semibold text-white shadow-lg shadow-[#b86ef9]/30 transition-transform duration-200 hover:from-[#a855f7] hover:to-[#7c3aed] hover:brightness-110 motion-safe:hover:-translate-y-0.5"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  {t("newsletter_public.cta")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <p className="flex items-start gap-2 text-xs text-[#a89bc4]">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {t("newsletter_public.reassurance")} <PrivacyLink lang={locale} />.
                  </span>
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
