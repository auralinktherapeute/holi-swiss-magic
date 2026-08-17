import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { unsubscribeNewsletter } from "@/lib/newsletter-send.functions";

export const Route = createFileRoute("/desinscription/")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Désinscription — La Lettre Holiswiss" },
      {
        name: "description",
        content: "Gérez votre abonnement à La Lettre Holiswiss et désinscrivez-vous en un clic.",
      },
      { property: "og:title", content: "Désinscription — La Lettre Holiswiss" },
      {
        property: "og:description",
        content: "Désinscription de la newsletter thérapeutes Holiswiss.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Page() {
  const run = useServerFn(unsubscribeNewsletter);
  const [state, setState] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    if (!token) {
      setState("error");
      return;
    }
    run({ data: { token } })
      .then((r) => setState(r.ok ? "done" : "error"))
      .catch(() => setState("error"));
  }, [run]);

  return (
    <main className="min-h-dvh flex items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-2xl font-semibold text-foreground">La Lettre Holiswiss</h1>
        {state === "loading" && (
          <p className="mt-4 text-muted-foreground">Traitement de votre demande…</p>
        )}
        {state === "done" && (
          <p className="mt-4 text-muted-foreground">
            Vous êtes désinscrit·e. Vous ne recevrez plus La Lettre Holiswiss.
          </p>
        )}
        {state === "error" && (
          <p className="mt-4 text-destructive">
            Ce lien de désinscription est invalide ou expiré. Écrivez-nous à contact@holiswiss.ch.
          </p>
        )}
        <a href="/fr" className="mt-6 inline-block text-sm text-primary underline">
          Retour à Holiswiss
        </a>
      </div>
    </main>
  );
}
