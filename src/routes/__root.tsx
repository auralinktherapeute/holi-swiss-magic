import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useMemo, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";


import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import i18nClient, { createI18nForLang, detectLangFromPath } from "../lib/i18n";
import { Toaster } from "../components/ui/sonner";
import { LanguageSwitcherDevPicker } from "../components/holiswiss/LanguageSwitcher";
import { PublicNavDevPicker } from "../components/layout/PublicNav";
import { useSessionTracking } from "../hooks/use-session-tracking";
import { CrossTabAuthSync } from "@/components/auth/CrossTabAuthSync";
import { usePageViewTracking } from "../hooks/use-page-view-tracking";
import { NotFoundPage } from "../components/layout/NotFoundPage";

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Holiswiss — Trouvez le bon thérapeute, partout en Suisse" },
      { name: "description", content: "Annuaire suisse des thérapeutes et praticiens bien-être. Recherche dans les 26 cantons · 4 langues. Profils détaillés, avis authentiques, réservation en ligne." },
      { name: "author", content: "Holiswiss" },
      { property: "og:title", content: "Holiswiss — Trouvez le bon thérapeute, partout en Suisse" },
      { property: "og:description", content: "Annuaire suisse des thérapeutes et praticiens bien-être. Recherche dans les 26 cantons · 4 langues. Profils détaillés, avis authentiques, réservation en ligne." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Holiswiss" },
      // ⚠️ PAS de `twitter:title` / `twitter:description` ici.
      //
      // TanStack Router fusionne les `meta` par `name`/`property` : une valeur
      // posée à la racine survit sur TOUTE page qui ne la redéfinit pas. Les
      // pages de blog, Voix d'experts, Fil, spécialités et familles ne posent
      // que `og:title` / `og:description` — l'aperçu Twitter/X de leurs versions
      // DE, IT et EN servait donc le titre et la description FRANÇAIS de
      // l'accueil. Les plateformes retombent sur `og:*` en l'absence de
      // `twitter:*` : le comportement reste correct, et devient multilingue.
      //
      // Image de partage : actif STABLE servi par notre domaine
      // (`public/logo.png`, 500 × 500). Avant, c'était une capture d'écran de
      // l'environnement de prévisualisation Lovable, hébergée sur un domaine
      // r2.dev éphémère — une URL qui n'a aucune raison de rester valide.
      { property: "og:image", content: "https://holiswiss.ch/logo.png" },
      { property: "og:image:width", content: "500" },
      { property: "og:image:height", content: "500" },
      { property: "og:image:alt", content: "Logo Holiswiss" },
      { name: "twitter:image", content: "https://holiswiss.ch/logo.png" },
      { name: "keywords", content: "thérapeute holistique Suisse, sophrologie, hypnose Suisse, naturopathie, médecine douce Suisse, bien-être, réservation thérapeute" },
      { name: "robots", content: "index, follow" },
      { property: "og:locale", content: "fr_CH" },
      { property: "og:site_name", content: "Holiswiss" },
      { name: "google-site-verification", content: "d9t25eV3fX7zo8MSf8MpCrcbPMfyayZR68oY3i4yXeg" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Playfair+Display:ital,wght@1,400;1,500&display=swap" },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
    // Le JSON-LD Organization/WebSite (@graph) est émis par le layout `$lang`
    // (src/routes/$lang.tsx), pas ici : il dépend de la langue de l'URL, que
    // cette route racine ne connaît pas. Les pages hors `/$lang` (admin,
    // dashboard, liens à token) sont toutes `noindex` ou derrière
    // authentification — elles n'ont pas besoin de ce balisage.
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundPage,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const m = pathname.match(/^\/(fr|de|it|en)(?=\/|$)/);
  const lang = m?.[1] ?? "fr";
  return (
    <html lang={lang}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AnalyticsTracking() {
  // Analytics maison (utilisateurs connectés) — voir src/lib/analytics.functions.ts.
  // Composant séparé (plutôt que les hooks appelés directement dans
  // RootComponent) pour qu'une erreur de rendu ici ne puisse jamais faire
  // planter l'app : c'est un effet de bord, jamais un rendu visible.
  useSessionTracking();
  usePageViewTracking();
  return null;
}

/**
 * Instance i18next utilisée par tout l'arbre.
 * - Serveur : une instance DÉDIÉE à la requête, figée sur la langue de l'URL.
 *   Aucune requête concurrente ne peut plus changer la langue d'une autre.
 * - Navigateur : le singleton, pour que le changement de langue en navigation
 *   SPA (LanguageSwitcher, `/$lang`) continue de fonctionner à l'identique.
 */
function useRequestI18n() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lang = detectLangFromPath(pathname);
  return useMemo(
    () => (typeof window === "undefined" ? createI18nForLang(lang) : i18nClient),
    [lang],
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const i18nInstance = useRequestI18n();

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18nInstance}>
        <AnalyticsTracking />
        <CrossTabAuthSync />
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <Toaster />
        <LanguageSwitcherDevPicker />
        <PublicNavDevPicker />
      </I18nextProvider>
    </QueryClientProvider>
  );
}
