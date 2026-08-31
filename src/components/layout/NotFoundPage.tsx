import { Link } from "@tanstack/react-router";

/**
 * Écran 404 partagé.
 *
 * Utilisé par la route racine ET par la route `/$lang` : sans
 * `notFoundComponent` sur `/$lang`, toute URL inconnue sous une langue valide
 * (`/fr/page-inconnue`) retombait sur le `<p>Not Found</p>` générique de
 * TanStack Router.
 */
export function NotFoundPage() {
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
