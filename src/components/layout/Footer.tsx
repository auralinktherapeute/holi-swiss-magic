import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="mt-24 border-t border-border bg-surface-alt">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-1.5 text-lg font-bold">
              <span aria-hidden>🌿</span>
              <span className="text-primary">Holi</span>
              <span className="font-normal">swiss</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t("brand.tagline")}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold">{t("nav.therapists")}</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>{t("directory.title")}</li>
              <li>{t("nav.events")}</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Holiswiss</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>{t("nav.pricing")}</li>
              <li>{t("nav.contact")}</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">{t("footer.legal")}</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>{t("footer.privacy")}</li>
              <li>{t("footer.terms")}</li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Holiswiss · {t("footer.rights")}
        </div>
      </div>
    </footer>
  );
}