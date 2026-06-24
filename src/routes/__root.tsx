import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import "../lib/i18n";
import { Toaster } from "../components/ui/sonner";
import { LanguageSwitcherDevPicker } from "../components/holiswiss/LanguageSwitcher";
import { PublicNavDevPicker } from "../components/layout/PublicNav";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-xl text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-[#b86ef9]">
          Erreur 404
        </p>
        <h1 className="mt-3 text-5xl font-bold text-foreground sm:text-6xl">
          Page introuvable
        </h1>
        <p className="mt-4 text-sm text-muted-foreground sm:text-base">
          Cette page n'existe pas ou a été déplacée. Continuez votre exploration de
          Holiswiss avec l'une des suggestions ci-dessous.
        </p>

        <nav
          aria-label="Suggestions"
          className="mt-8 grid gap-3 text-left sm:grid-cols-2"
        >
          <Link
            to="/"
            className="rounded-xl border border-[rgba(184,110,249,0.25)] bg-[#3d1a5c]/40 px-4 py-3 transition-colors hover:border-[#b86ef9]"
          >
            <div className="text-sm font-semibold text-foreground">Accueil</div>
            <div className="text-xs text-muted-foreground">Trouver un thérapeute en Suisse</div>
          </Link>
          <a
            href="/fr/therapeutes"
            className="rounded-xl border border-[rgba(184,110,249,0.25)] bg-[#3d1a5c]/40 px-4 py-3 transition-colors hover:border-[#b86ef9]"
          >
            <div className="text-sm font-semibold text-foreground">Annuaire</div>
            <div className="text-xs text-muted-foreground">Tous les thérapeutes par canton</div>
          </a>
          <a
            href="/fr/blog"
            className="rounded-xl border border-[rgba(184,110,249,0.25)] bg-[#3d1a5c]/40 px-4 py-3 transition-colors hover:border-[#b86ef9]"
          >
            <div className="text-sm font-semibold text-foreground">Blog</div>
            <div className="text-xs text-muted-foreground">Conseils & dossiers thérapies</div>
          </a>
          <a
            href="/fr/evenements"
            className="rounded-xl border border-[rgba(184,110,249,0.25)] bg-[#3d1a5c]/40 px-4 py-3 transition-colors hover:border-[#b86ef9]"
          >
            <div className="text-sm font-semibold text-foreground">Événements</div>
            <div className="text-xs text-muted-foreground">Stages, ateliers et retraites</div>
          </a>
          <a
            href="/fr/tarifs"
            className="rounded-xl border border-[rgba(184,110,249,0.25)] bg-[#3d1a5c]/40 px-4 py-3 transition-colors hover:border-[#b86ef9]"
          >
            <div className="text-sm font-semibold text-foreground">Tarifs</div>
            <div className="text-xs text-muted-foreground">Plans pour les praticiens</div>
          </a>
          <a
            href="/fr/contact"
            className="rounded-xl border border-[rgba(184,110,249,0.25)] bg-[#3d1a5c]/40 px-4 py-3 transition-colors hover:border-[#b86ef9]"
          >
            <div className="text-sm font-semibold text-foreground">Contact</div>
            <div className="text-xs text-muted-foreground">Une question ? Écrivez-nous</div>
          </a>
        </nav>
      </div>
    </div>
  );
}

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
      { name: "description", content: "Annuaire suisse des thérapeutes et praticiens bien-être. 26 cantons · 4 langues. Profils vérifiés, avis authentiques, réservation en ligne." },
      { name: "author", content: "Holiswiss" },
      { property: "og:title", content: "Holiswiss — Trouvez le bon thérapeute, partout en Suisse" },
      { property: "og:description", content: "Annuaire suisse des thérapeutes et praticiens bien-être. 26 cantons · 4 langues. Profils vérifiés, avis authentiques, réservation en ligne." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Holiswiss" },
      { name: "twitter:title", content: "Holiswiss — Trouvez le bon thérapeute, partout en Suisse" },
      { name: "twitter:description", content: "Annuaire suisse des thérapeutes et praticiens bien-être. 26 cantons · 4 langues. Profils vérifiés, avis authentiques, réservation en ligne." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f65eee24-f112-4f11-aafe-91b49aa10354/id-preview-246cabfd--2c2ca56b-598e-4651-bc14-8ba533771ae9.lovable.app-1781045501960.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f65eee24-f112-4f11-aafe-91b49aa10354/id-preview-246cabfd--2c2ca56b-598e-4651-bc14-8ba533771ae9.lovable.app-1781045501960.png" },
      { name: "keywords", content: "thérapeute holistique Suisse, sophrologie, hypnose Suisse, naturopathie, médecine douce Suisse, bien-être, thérapeute certifié, réservation thérapeute" },
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
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Holiswiss",
          url: "https://holiswiss.ch",
          description:
            "Plateforme suisse de mise en relation avec des thérapeutes holistiques certifiés",
          potentialAction: {
            "@type": "SearchAction",
            target:
              "https://holiswiss.ch/fr/therapeutes?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
          publisher: {
            "@type": "Organization",
            name: "Holiswiss",
            url: "https://holiswiss.ch",
            logo: "https://holiswiss.ch/logo.png",
            address: {
              "@type": "PostalAddress",
              addressCountry: "CH",
            },
          },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
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

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster />
      <LanguageSwitcherDevPicker />
      <PublicNavDevPicker />
    </QueryClientProvider>
  );
}
