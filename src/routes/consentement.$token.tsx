import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { acceptConsentByToken, getConsentByToken } from "@/lib/client-fiche.functions";

export const Route = createFileRoute("/consentement/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Votre consentement — Holiswiss" },
      { name: "description", content: "Confirmez votre accord pour la conservation de vos données par votre thérapeute." },
      { property: "og:title", content: "Votre consentement — Holiswiss" },
      { property: "og:description", content: "Confirmez votre accord pour la conservation de vos données." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ConsentPage,
});

function ConsentPage() {
  const { token } = Route.useParams();
  const getFn = useServerFn(getConsentByToken);
  const acceptFn = useServerFn(acceptConsentByToken);
  const [done, setDone] = useState(false);
  const valid = /^[a-f0-9]{64}$/.test(token);
  const q = useQuery({ queryKey: ["consent", token], queryFn: () => getFn({ data: { token } }), enabled: valid });
  const accept = useMutation({
    mutationFn: () => acceptFn({ data: { token } }),
    onSuccess: (r) => { if (r.ok) setDone(true); },
  });

  return (
    <main className="min-h-dvh flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardContent className="p-6 space-y-4 text-center">
          <ShieldCheck className="h-10 w-10 mx-auto text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-bold">Votre consentement</h1>
          {done ? (
            <p>Merci, votre accord a bien été enregistré. Vous pouvez fermer cette page.</p>
          ) : !valid || q.data?.status === "invalid" ? (
            <p className="text-muted-foreground">Ce lien n'est plus valable ou a déjà été utilisé.</p>
          ) : q.isLoading ? (
            <p className="text-muted-foreground">Chargement…</p>
          ) : q.data?.status === "pending" ? (
            <>
              <p>
                Bonjour {q.data.firstName}, <strong>{q.data.therapist || "votre thérapeute"}</strong> souhaite
                conserver vos coordonnées et l'historique de vos séances pour assurer votre suivi,
                conformément à la loi suisse sur la protection des données (nLPD).
              </p>
              <p className="text-sm text-muted-foreground">Vous pouvez retirer cet accord à tout moment en contactant votre thérapeute.</p>
              <Button className="min-h-11" disabled={accept.isPending} onClick={() => accept.mutate()}>
                {accept.isPending ? "Enregistrement…" : "Je donne mon accord"}
              </Button>
              {accept.isError && <p role="alert" className="text-sm text-destructive">Une erreur est survenue. Réessayez.</p>}
            </>
          ) : (
            <p className="text-destructive">Impossible de charger la demande. Réessayez plus tard.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
