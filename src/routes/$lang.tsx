import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { PublicNav } from "@/components/layout/PublicNav";
import { Footer } from "@/components/layout/Footer";
import { isLang, DEFAULT_LANG } from "@/lib/i18n";

export const Route = createFileRoute("/$lang")({
  component: LangLayout,
});

function LangLayout() {
  const { lang } = useParams({ from: "/$lang" });
  const { i18n } = useTranslation();
  const resolved = isLang(lang) ? lang : DEFAULT_LANG;

  useEffect(() => {
    if (i18n.language.split("-")[0] !== resolved) {
      i18n.changeLanguage(resolved);
    }
  }, [resolved, i18n]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}