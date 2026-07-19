import { Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/holiswiss/Logo";

export function Footer() {
  const { t } = useTranslation();
  // Fallback to "fr" if not inside a /$lang route
  let lang = "fr";
  try {
    const p = useParams({ strict: false }) as Record<string, string>;
    if (p.lang) lang = p.lang;
  } catch {}

  return (
    <footer className="mt-24 border-t border-[rgba(184,110,249,0.15)] bg-[#2d1248]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <Logo size={32} />
            <p className="mt-3 text-sm text-[#d4c4e0]">{t("brand.tagline")}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">{t("nav.therapists")}</h4>
            <ul className="mt-3 space-y-2 text-sm text-[#d4c4e0]">
              <li>
                <Link to="/$lang/therapeutes" params={{ lang }} className="hover:text-[#b86ef9] transition-colors">
                  {t("directory.title")}
                </Link>
              </li>
              <li>
                <Link to="/$lang/evenements" params={{ lang }} className="hover:text-[#b86ef9] transition-colors">
                  {t("nav.events")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Holiswiss</h4>
            <ul className="mt-3 space-y-2 text-sm text-[#d4c4e0]">
              <li>
                <Link to="/$lang/tarifs" params={{ lang }} className="hover:text-[#b86ef9] transition-colors">
                  {t("nav.pricing")}
                </Link>
              </li>
              <li>
                <Link to="/$lang/faq" params={{ lang }} className="hover:text-[#b86ef9] transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link to="/$lang/contact" params={{ lang }} className="hover:text-[#b86ef9] transition-colors">
                  {t("nav.contact")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">{t("footer.legal")}</h4>
            <ul className="mt-3 space-y-2 text-sm text-[#d4c4e0]">
              <li>
                <Link to="/$lang/impressum" params={{ lang }} className="hover:text-[#b86ef9] transition-colors">
                  Impressum
                </Link>
              </li>
              <li>
                <Link to="/$lang/confidentialite" params={{ lang }} className="hover:text-[#b86ef9] transition-colors">
                  {t("footer.privacy")}
                </Link>
              </li>
              <li>
                <Link to="/$lang/conditions" params={{ lang }} className="hover:text-[#b86ef9] transition-colors">
                  {t("footer.terms")}
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-[rgba(184,110,249,0.15)] pt-6 text-center text-xs text-[#d4c4e0]">
          © {new Date().getFullYear()} Groupe Holi / Holiswiss · {t("footer.rights")}
        </div>
      </div>
    </footer>
  );
}