import { createFileRoute, Outlet, useParams, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { PublicNav } from "@/components/layout/PublicNav";
import { Footer } from "@/components/layout/Footer";
import { OnboardingModal } from "@/components/OnboardingModal";
import { AmbientPlayer } from "@/components/AmbientPlayer";
import { WaitlistBanner } from "@/components/holiswiss/WaitlistBanner";
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
  // La fiche publique d'un thérapeute ne porte aucun message de liste d'attente :
  // elle commence directement par le profil.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Segments de la fiche : /{lang}/therapeute|therapeutes/{slug}
  // (on ignore un éventuel slash final et les pages listes/canton/ville).
  const segments = pathname.split("/").filter(Boolean);
  const isTherapistProfile =
    segments.length === 3 &&
    (segments[1] === "therapeute" || segments[1] === "therapeutes");

  useEffect(() => {
    if (i18n.language.split("-")[0] !== resolved) void i18n.changeLanguage(resolved);
    try { window.localStorage.setItem("holiswiss-lang", resolved); } catch {}
  }, [i18n, resolved]);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      <PublicNav />
      {!isTherapistProfile && <WaitlistBanner />}
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <OnboardingModal />
      <AmbientPlayer />
    </div>
  );
}