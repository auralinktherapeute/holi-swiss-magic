import { useTranslation } from "react-i18next";
import { Logo } from "@/components/holiswiss/Logo";

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="mt-24 border-t border-[rgba(167,139,250,0.15)] bg-[#0a0418]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <Logo size={32} />
            <p className="mt-3 text-sm text-muted-foreground">{t("brand.tagline")}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">{t("nav.therapists")}</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>{t("directory.title")}</li>
              <li>{t("nav.events")}</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Holiswiss</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>{t("nav.pricing")}</li>
              <li>{t("nav.contact")}</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">{t("footer.legal")}</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>{t("footer.privacy")}</li>
              <li>{t("footer.terms")}</li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-[rgba(167,139,250,0.15)] pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Holiswiss · {t("footer.rights")}
        </div>
      </div>
    </footer>
  );
}