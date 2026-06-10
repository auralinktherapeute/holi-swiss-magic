import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { PublicNav } from "@/components/layout/PublicNav";
import { Footer } from "@/components/layout/Footer";
import { WaitingListPopup } from "@/components/WaitingListPopup";
import { AmbientPlayer } from "@/components/AmbientPlayer";
import i18n, { isLang, DEFAULT_LANG } from "@/lib/i18n";


export const Route = createFileRoute("/$lang")({
  beforeLoad: async ({ params }) => {
    const resolved = isLang(params.lang) ? params.lang : DEFAULT_LANG;
    if (i18n.language.split("-")[0] !== resolved) {
      await i18n.changeLanguage(resolved);
    }
  },
  component: LangLayout,
});

function LangLayout() {
  const { lang } = useParams({ from: "/$lang" });
  const { i18n } = useTranslation();
  const resolved = isLang(lang) ? lang : DEFAULT_LANG;

  useEffect(() => {
    if (i18n.language.split("-")[0] !== resolved) void i18n.changeLanguage(resolved);
    try { window.localStorage.setItem("holiswiss-lang", resolved); } catch {}
  }, [i18n, resolved]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <WaitingListPopup />
    </div>
  );
}