import { Link, useParams } from "@tanstack/react-router";
import { cantonName } from "@/lib/geo-listings";

const FOOTER_CANTONS = ["GE", "VD", "VS", "FR", "NE", "BE", "ZH", "TI"] as const;
const FOOTER_CITIES = [
  { slug: "geneve", name: "Genève" },
  { slug: "lausanne", name: "Lausanne" },
  { slug: "sion", name: "Sion" },
  { slug: "fribourg", name: "Fribourg" },
  { slug: "neuchatel", name: "Neuchâtel" },
  { slug: "zurich", name: "Zürich" },
  { slug: "lugano", name: "Lugano" },
] as const;
import { useTranslation } from "react-i18next";
import { Check, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/holiswiss/Logo";
import { PrivacyLink, useSubscribeForm } from "@/components/holiswiss/NewsletterSignup";

/** Variante 3 — footer en deux niveaux (bandeau newsletter + navigation). */
function FooterSubscribe() {
  const { t, email, setEmail, consent, setConsent, loading, done, submit, locale } =
    useSubscribeForm("public_footer");

  if (done) {
    return (
      <p className="flex items-start gap-2 text-sm text-[#7de3b8]">
        <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t("newsletter_public.success")}</span>
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="min-w-0 space-y-3">
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <label htmlFor="footer-newsletter-email" className="sr-only">
            {t("newsletter_public.email_label")}
          </label>
          <Input
            id="footer-newsletter-email"
            type="email"
            autoComplete="email"
            required
            maxLength={255}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("newsletter_public.email_placeholder")}
            className="min-h-[44px] w-full border-[rgba(184,110,249,0.35)] bg-[rgba(20,8,40,0.65)] text-white placeholder:text-[#8f81ab]"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="min-h-[44px] w-full gap-2 bg-gradient-to-r from-[#b86ef9] to-[#8b4ddb] font-semibold text-white shadow-lg shadow-[#b86ef9]/25 hover:brightness-110 sm:w-auto"
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span className="truncate">{t("newsletter_public.cta")}</span>
        </Button>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-[rgba(184,110,249,0.4)] bg-[rgba(20,8,40,0.5)] text-[#b86ef9] focus:ring-[#b86ef9]"
        />
        <span className="min-w-0 text-xs leading-relaxed text-[#c3b4dc]">
          {t("newsletter_public.consent")}
        </span>
      </label>

      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-[#a89bc4]">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0">
          {t("newsletter_public.reassurance")} <PrivacyLink lang={locale} />.
        </span>
      </p>
    </form>
  );
}

export function Footer() {
  const { t } = useTranslation();
  let lang = "fr";
  try {
    const p = useParams({ strict: false }) as Record<string, string>;
    if (p.lang) lang = p.lang;
  } catch {}

  const linkClass =
    "inline-flex min-h-[32px] items-center rounded transition-colors hover:text-[#d4a5f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9]";
  const headingClass =
    "text-xs font-semibold uppercase tracking-[0.14em] text-[#b9a7d6]";

  return (
    <footer className="mt-24 border-t border-[rgba(184,110,249,0.15)] bg-[#2d1248]">
      {/* Niveau 1 — bandeau newsletter */}
      <div className="border-b border-[rgba(255,255,255,0.08)] bg-[rgba(20,8,40,0.35)]">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-9 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-10">
          <div className="min-w-0">
            <h3 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              {t("newsletter_public.footer_title")}
            </h3>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[#c3b4dc]">
              {t("newsletter_public.footer_text")}
            </p>
          </div>
          <FooterSubscribe />
        </div>
      </div>

      {/* Niveau 2 — marque, navigation, mentions */}
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))]">
          <div className="min-w-0">
            <Logo size={28} />
            <p className="mt-3 max-w-xs text-sm text-[#c3b4dc]">{t("brand.tagline")}</p>
          </div>

          <div className="min-w-0">
            <h4 className={headingClass}>{t("nav.therapists")}</h4>
            <ul className="mt-3 space-y-2 text-sm text-[#d4c4e0]">
              <li>
                <Link to="/$lang/therapeutes" params={{ lang }} className={linkClass}>
                  {t("directory.title")}
                </Link>
              </li>
              <li>
                <Link to="/$lang/evenements" params={{ lang }} className={linkClass}>
                  {t("nav.events")}
                </Link>
              </li>
            </ul>
          </div>

          <div className="min-w-0">
            <h4 className={headingClass}>Holiswiss</h4>
            <ul className="mt-3 space-y-2 text-sm text-[#d4c4e0]">
              <li>
                <Link to="/$lang/tarifs" params={{ lang }} className={linkClass}>
                  {t("nav.pricing")}
                </Link>
              </li>
              <li>
                <Link to="/$lang/faq" params={{ lang }} className={linkClass}>
                  FAQ
                </Link>
              </li>
              <li>
                <Link to="/$lang/contact" params={{ lang }} className={linkClass}>
                  {t("nav.contact")}
                </Link>
              </li>
            </ul>
          </div>

          <div className="min-w-0">
            <h4 className={headingClass}>{t("footer.legal")}</h4>
            <ul className="mt-3 space-y-2 text-sm text-[#d4c4e0]">
              <li>
                <Link to="/$lang/impressum" params={{ lang }} className={linkClass}>
                  Impressum
                </Link>
              </li>
              <li>
                <Link to="/$lang/confidentialite" params={{ lang }} className={linkClass}>
                  {t("footer.privacy")}
                </Link>
              </li>
              <li>
                <Link to="/$lang/conditions" params={{ lang }} className={linkClass}>
                  {t("footer.terms")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Maillage interne géographique — cantons et villes principales */}
        <nav aria-label="Thérapeutes par région" className="mt-9 border-t border-[rgba(255,255,255,0.08)] pt-6">
          <h4 className={headingClass}>{t("footer.by_region", "Thérapeutes par région")}</h4>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#c3b4dc]">
            {FOOTER_CANTONS.map((code) => (
              <li key={code}>
                <Link
                  to="/$lang/therapeutes/canton/$canton"
                  params={{ lang, canton: code }}
                  className={linkClass}
                >
                  {cantonName(code, lang)}
                </Link>
              </li>
            ))}
            {FOOTER_CITIES.map((c) => (
              <li key={c.slug}>
                <Link
                  to="/$lang/therapeutes/ville/$citySlug"
                  params={{ lang, citySlug: c.slug }}
                  className={linkClass}
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>



        <div className="mt-9 border-t border-[rgba(255,255,255,0.08)] pt-5">
          <p className="text-xs text-[#a89bc4]">
            © {new Date().getFullYear()} Groupe Holi / Holiswiss · {t("footer.rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
