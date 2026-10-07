import { createFileRoute, Link } from "@tanstack/react-router";
import { aboutHead, institutionalCopy, INSTITUTION } from "@/lib/institutional-content";

export const Route = createFileRoute("/$lang/a-propos/")({
  head: ({ params }) => aboutHead(params.lang),
  component: AboutPage,
});

function AboutPage() {
  const { lang } = Route.useParams();
  const c = institutionalCopy(lang);
  const linkClass = "inline-flex min-h-11 items-center text-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 text-foreground sm:px-6 sm:py-16">
      <header className="mb-10">
        <p className="mb-3 text-lg text-accent">{c.about}</p>
        <h1 className="text-4xl font-bold">Holiswiss</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{c.intro}</p>
      </header>
      <section className="border-t border-border py-8">
        <h2 className="mb-4 text-2xl font-semibold">{c.identityTitle}</h2>
        <p className="text-base leading-relaxed text-muted-foreground">{c.identity}</p>
        <address className="mt-5 text-base not-italic leading-relaxed text-muted-foreground">
          {INSTITUTION.address}<br />
          <a className={linkClass} href={`mailto:${INSTITUTION.email}`}>{INSTITUTION.email}</a><br />
          SIREN : {INSTITUTION.siren}
        </address>
      </section>
      <section className="border-t border-border py-8">
        <h2 className="mb-4 text-2xl font-semibold">{c.methodTitle}</h2>
        <p className="text-base leading-relaxed text-muted-foreground">{c.method}</p>
        <p className="mt-4 border-l-2 border-accent pl-4 text-base leading-relaxed text-muted-foreground">{c.limit}</p>
      </section>
      <section className="border-t border-border py-8">
        <h2 className="mb-4 text-2xl font-semibold">{c.responsibilityTitle}</h2>
        <p className="text-base leading-relaxed text-muted-foreground">{c.responsibility}</p>
      </section>
      <nav aria-label={c.about} className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6">
        <Link to="/$lang/contact" params={{ lang }} className={linkClass}>{c.contact}</Link>
        <Link to="/$lang/impressum" params={{ lang }} className={linkClass}>{c.legal}</Link>
        <Link to="/$lang/conditions" params={{ lang }} className={linkClass}>{c.terms}</Link>
        <Link to="/$lang/confidentialite" params={{ lang }} className={linkClass}>{c.privacy}</Link>
      </nav>
    </article>
  );
}