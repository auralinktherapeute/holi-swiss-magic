import { createFileRoute, Outlet, useParams, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { PublicNav } from "@/components/layout/PublicNav";
import { Footer } from "@/components/layout/Footer";
import { AmbientPlayer } from "@/components/AmbientPlayer";
import i18n, { isLang, DEFAULT_LANG } from "@/lib/i18n";
import { NotFoundPage } from "@/components/layout/NotFoundPage";


export const Route = createFileRoute("/$lang")({
  /**
   * `/$lang` est un paramètre dynamique : il capture N'IMPORTE QUEL premier
   * segment. Sans le garde ci-dessous, `/foo-bar-xyz`, `/ads.txt`, `/wp-admin`
   * ou `/llms-full.txt` tombaient sur `$lang.index` et renvoyaient **200 + la
   * page d'accueil** — un espace d'URL infini, indexable et auto-dupliqué
   * (soft-404). Les URLs plus profondes (`/fr/page-inconnue`) renvoyaient déjà
   * un vrai 404 : c'est bien ce segment unique qui manquait.
   *
   * `notFound()` doit être levé ici, dans `beforeLoad` — donc AVANT que la
   * réponse HTTP soit émise — pour que le statut soit réellement 404 et pas
   * seulement un écran « page introuvable » servi en 200 (même correctif que
   * `$lang.blog.categorie.$slug`).
   */
  beforeLoad: async ({ params }) => {
    if (!isLang(params.lang)) throw notFound();
    const resolved = isLang(params.lang) ? params.lang : DEFAULT_LANG;
    if (i18n.language.split("-")[0] !== resolved) {
      await i18n.changeLanguage(resolved);
    }
  },
  // Sans ce `notFoundComponent`, une URL inconnue sous une langue valide
  // (`/fr/page-inconnue`) affichait le `<p>Not Found</p>` générique de TanStack
  // Router — le statut HTTP était bien 404, mais la page était nue.
  notFoundComponent: NotFoundPage,
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
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      <PublicNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <AmbientPlayer />
    </div>
  );
}