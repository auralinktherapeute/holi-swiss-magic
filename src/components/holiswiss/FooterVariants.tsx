import { useTranslation } from "react-i18next";
import { ArrowRight, Check, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/holiswiss/Logo";
import { PrivacyLink, useSubscribeForm } from "@/components/holiswiss/NewsletterSignup";

/**
 * 4 variantes VISUELLES du footer public + bloc « La Lettre Holiswiss ».
 * Aucune logique métier nouvelle : toutes réutilisent `useSubscribeForm`
 * (donc `subscribePublicNewsletter`), les mêmes traductions et les mêmes états.
 * Utilisées uniquement par /preview/footer tant qu'aucun choix n'est validé.
 */

type NavGroup = { title: string; links: { label: string; href: string }[] };

function useNavGroups(lang = "fr"): NavGroup[] {
  const { t } = useTranslation();
  return [
    {
      title: t("nav.therapists"),
      links: [
        { label: t("directory.title"), href: `/${lang}/therapeutes` },
        { label: t("nav.events"), href: `/${lang}/evenements` },
      ],
    },
    {
      title: "Holiswiss",
      links: [
        { label: t("nav.pricing"), href: `/${lang}/tarifs` },
        { label: "FAQ", href: `/${lang}/faq` },
        { label: t("nav.contact"), href: `/${lang}/contact` },
      ],
    },
    {
      title: t("footer.legal"),
      links: [
        { label: "Impressum", href: `/${lang}/impressum` },
        { label: t("footer.privacy"), href: `/${lang}/confidentialite` },
        { label: t("footer.terms"), href: `/${lang}/conditions` },
      ],
    },
  ];
}

function LinkList({ group, className = "" }: { group: NavGroup; className?: string }) {
  return (
    <div className={className}>
      <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#b9a7d6]">
        {group.title}
      </h4>
      <ul className="mt-3 space-y-2 text-sm text-[#d4c4e0]">
        {group.links.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              className="inline-flex min-h-[32px] items-center rounded transition-colors hover:text-[#d4a5f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9]"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Copyright() {
  const { t } = useTranslation();
  return (
    <p className="text-xs text-[#a89bc4]">
      © {new Date().getFullYear()} Groupe Holi / Holiswiss · {t("footer.rights")}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Formulaire partagé — 3 dispositions, une seule logique              */
/* ------------------------------------------------------------------ */

type FormLayout = "stacked" | "inline" | "compact";

function SubscribeForm({
  layout,
  buttonClassName = "",
  inputClassName = "",
}: {
  layout: FormLayout;
  buttonClassName?: string;
  inputClassName?: string;
}) {
  const { t, email, setEmail, consent, setConsent, loading, done, submit, locale } =
    useSubscribeForm("public_footer");
  const id = `nlv-${layout}`;

  if (done) {
    return (
      <p className="flex items-start gap-2 text-sm text-[#7de3b8]">
        <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t("newsletter_public.success")}</span>
      </p>
    );
  }

  const input = (
    <>
      <label htmlFor={id} className="sr-only">
        {t("newsletter_public.email_label")}
      </label>
      <Input
        id={id}
        type="email"
        autoComplete="email"
        required
        maxLength={255}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("newsletter_public.email_placeholder")}
        className={`min-h-[44px] w-full border-[rgba(184,110,249,0.35)] bg-[rgba(20,8,40,0.65)] text-white placeholder:text-[#8f81ab] ${inputClassName}`}
      />
    </>
  );

  const button = (
    <Button
      type="submit"
      disabled={loading}
      className={`min-h-[44px] gap-2 font-semibold text-white ${buttonClassName}`}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ) : (
        <Mail className="h-4 w-4" aria-hidden="true" />
      )}
      {t("newsletter_public.cta")}
    </Button>
  );

  const consentBox = (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={consent}
        onChange={(e) => setConsent(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-[rgba(184,110,249,0.4)] bg-[rgba(20,8,40,0.5)] text-[#b86ef9] focus:ring-[#b86ef9]"
      />
      <span className="text-xs leading-relaxed text-[#c3b4dc]">
        {t("newsletter_public.consent")}
      </span>
    </label>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      {layout === "inline" ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">{input}</div>
          {button}
        </div>
      ) : (
        <>
          <div className="min-w-0">{input}</div>
          <div className={layout === "compact" ? "" : "pt-0.5"}>{button}</div>
        </>
      )}
      {consentBox}
      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-[#a89bc4]">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          {t("newsletter_public.reassurance")} <PrivacyLink lang={locale} />.
        </span>
      </p>
    </form>
  );
}

const CTA_SOLID =
  "w-full bg-[#b86ef9] hover:bg-[#a855f7] sm:w-auto";
const CTA_GRADIENT =
  "w-full bg-gradient-to-r from-[#b86ef9] to-[#8b4ddb] shadow-lg shadow-[#b86ef9]/25 hover:brightness-110 sm:w-auto";

/* ------------------------------------------------------------------ */
/* VARIANTE 1 — Éditoriale premium                                     */
/* ------------------------------------------------------------------ */

export function FooterEditorial({ lang = "fr" }: { lang?: string }) {
  const { t } = useTranslation();
  const groups = useNavGroups(lang);
  return (
    <footer className="bg-[#2d1248]">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div className="max-w-md">
            <Logo size={30} />
            <p className="mt-4 text-sm leading-relaxed text-[#c3b4dc]">{t("brand.tagline")}</p>
            <h3 className="mt-10 font-serif text-2xl leading-snug tracking-tight text-white sm:text-[1.7rem]">
              {t("newsletter_public.footer_title")}
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#c3b4dc]">
              {t("newsletter_public.footer_text")}
            </p>
            <div className="mt-5 border-l border-[rgba(184,110,249,0.3)] pl-5">
              <SubscribeForm layout="stacked" buttonClassName={CTA_SOLID} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:pt-2">
            {groups.map((g) => (
              <LinkList key={g.title} group={g} />
            ))}
          </div>
        </div>
        <div className="mt-12 border-t border-[rgba(255,255,255,0.08)] pt-6">
          <Copyright />
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* VARIANTE 2 — Newsletter mise en avant                               */
/* ------------------------------------------------------------------ */

export function FooterNewsletterFocus({ lang = "fr" }: { lang?: string }) {
  const { t } = useTranslation();
  const groups = useNavGroups(lang);
  return (
    <footer className="bg-[#2d1248]">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <Logo size={30} />
            <p className="mt-3 max-w-xs text-sm text-[#c3b4dc]">{t("brand.tagline")}</p>
            <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3">
              {groups.map((g) => (
                <LinkList key={g.title} group={g} />
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[rgba(184,110,249,0.35)] bg-[rgba(61,26,92,0.75)] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.3)] sm:p-7">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#b86ef9]/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#d4a5f9]">
              <Mail className="h-3 w-3" aria-hidden="true" />
              {t("newsletter_public.badge")}
            </span>
            <h3 className="mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">
              {t("newsletter_public.footer_title")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#c3b4dc]">
              {t("newsletter_public.footer_text")}
            </p>
            <div className="mt-5">
              <SubscribeForm layout="inline" buttonClassName={CTA_GRADIENT} />
            </div>
          </div>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(255,255,255,0.08)] pt-6">
          <Copyright />
          <span className="inline-flex items-center gap-1.5 text-xs text-[#a89bc4]">
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /> holiswiss.ch
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* VARIANTE 3 — Footer en deux niveaux                                 */
/* ------------------------------------------------------------------ */

export function FooterTwoTier({ lang = "fr" }: { lang?: string }) {
  const { t } = useTranslation();
  const groups = useNavGroups(lang);
  return (
    <footer className="bg-[#2d1248]">
      <div className="border-b border-[rgba(255,255,255,0.08)] bg-[rgba(20,8,40,0.35)]">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-9 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              {t("newsletter_public.footer_title")}
            </h3>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[#c3b4dc]">
              {t("newsletter_public.footer_text")}
            </p>
          </div>
          <SubscribeForm layout="inline" buttonClassName={CTA_GRADIENT} />
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))]">
          <div>
            <Logo size={28} />
            <p className="mt-3 max-w-xs text-sm text-[#c3b4dc]">{t("brand.tagline")}</p>
          </div>
          {groups.map((g) => (
            <LinkList key={g.title} group={g} />
          ))}
        </div>
        <div className="mt-9 border-t border-[rgba(255,255,255,0.08)] pt-5">
          <Copyright />
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* VARIANTE 4 — Minimaliste suisse                                     */
/* ------------------------------------------------------------------ */

export function FooterSwissMinimal({ lang = "fr" }: { lang?: string }) {
  const { t } = useTranslation();
  const groups = useNavGroups(lang);
  return (
    <footer className="bg-[#2d1248]">
      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo size={26} />
          </div>
          {groups.map((g) => (
            <LinkList key={g.title} group={g} />
          ))}
        </div>
        <div className="mt-10 grid gap-6 border-t border-[rgba(255,255,255,0.1)] pt-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-white">
              {t("newsletter_public.footer_title")}
            </h3>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#b9a7d6]">
              {t("newsletter_public.footer_text")}
            </p>
          </div>
          <SubscribeForm
            layout="compact"
            buttonClassName="w-full border border-[rgba(184,110,249,0.55)] bg-transparent hover:bg-[#b86ef9]/15 sm:w-auto"
            inputClassName="rounded-none border-x-0 border-t-0 border-b bg-transparent px-0"
          />
        </div>
        <div className="mt-8 border-t border-[rgba(255,255,255,0.1)] pt-5">
          <Copyright />
        </div>
      </div>
    </footer>
  );
}

export const FOOTER_VARIANTS = [
  {
    id: "editorial",
    name: "Variante 1 — Éditoriale premium",
    description:
      "Footer sobre, grande hiérarchie typographique, newsletter en invitation éditoriale discrète.",
    Component: FooterEditorial,
  },
  {
    id: "focus",
    name: "Variante 2 — Newsletter mise en avant",
    description:
      "Bloc newsletter détaché en carte contrastée, CTA dégradé, colonnes de liens compactes.",
    Component: FooterNewsletterFocus,
  },
  {
    id: "two-tier",
    name: "Variante 3 — Footer en deux niveaux",
    description:
      "Bandeau newsletter horizontal pleine largeur, puis marque, navigation et mentions légales.",
    Component: FooterTwoTier,
  },
  {
    id: "swiss",
    name: "Variante 4 — Minimaliste suisse",
    description:
      "Grille stricte, séparateurs fins, champ souligné, aucun ornement — calme et précis.",
    Component: FooterSwissMinimal,
  },
] as const;
