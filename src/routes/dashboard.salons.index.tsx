import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Users, ShieldCheck, MessageCircle, Lock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { listCommunityFamilies, acceptCharter } from "@/lib/community.functions";
import { CharterDialog } from "@/components/community/CharterDialog";

export const Route = createFileRoute("/dashboard/salons/")({
  component: Page,
  head: () => {
    const title = "Salons communautaires | Holiswiss";
    const description =
      "Échangez entre thérapeutes vérifiés dans les salons par famille de métiers, dans un cadre bienveillant et modéré.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
});

function relative(dateStr: string | null) {
  if (!dateStr) return "Aucun message";
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Actif à l'instant";
  if (h < 24) return `Actif il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `Actif il y a ${d} j`;
}

function Page() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchFamilies = useServerFn(listCommunityFamilies);
  const accept = useServerFn(acceptCharter);
  const [pending, setPending] = useState<{ id: string; name: string; slug: string } | null>(null);

  const query = useQuery({ queryKey: ["community-families"], queryFn: () => fetchFamilies({}) });

  const mutation = useMutation({
    mutationFn: (familyId: string) => accept({ data: { familyId } }),
    onSuccess: async (_res, familyId) => {
      await qc.invalidateQueries({ queryKey: ["community-families"] });
      const fam = query.data?.families.find((f: any) => f.id === familyId);
      toast.success("Charte acceptée — bienvenue dans le salon");
      setPending(null);
      if (fam?.slug) navigate({ to: "/dashboard/salons/$slug", params: { slug: fam.slug } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Acceptation impossible"),
  });

  const isVerified = query.data?.isVerified ?? false;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 pb-28 sm:py-8">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Salons communautaires</h1>
            <p className="text-sm text-muted-foreground">
              Un espace d'échange entre pairs, par famille de métiers, réservé aux thérapeutes vérifiés.
            </p>
          </div>
        </div>
      </header>

      {!query.isLoading && !isVerified && (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground"
        >
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
          <p>
            Les salons sont réservés aux profils vérifiés. Complétez votre profil et vos certifications, puis
            l'équipe Holiswiss validera votre compte.{" "}
            <Link to="/dashboard/profil" className="underline underline-offset-2">
              Compléter mon profil
            </Link>
          </p>
        </div>
      )}

      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-muted/40" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(query.data?.families ?? []).map((f: any) => (
            <article
              key={f.id}
              className="flex flex-col rounded-xl border border-border bg-card p-4 transition hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold text-foreground">{f.name}</h2>
                {f.accepted && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Membre
                  </span>
                )}
              </div>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{f.description}</p>
              <p className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" aria-hidden="true" /> {f.messageCount} message
                  {f.messageCount > 1 ? "s" : ""}
                </span>
                <span>{relative(f.lastMessageAt)}</span>
              </p>
              <div className="mt-4">
                {f.accepted ? (
                  <Link
                    to="/dashboard/salons/$slug"
                    params={{ slug: f.slug }}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Entrer dans le salon <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={!isVerified}
                    onClick={() => setPending({ id: f.id, name: f.name, slug: f.slug })}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Rejoindre ce salon
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <CharterDialog
        open={Boolean(pending)}
        familyName={pending?.name ?? ""}
        submitting={mutation.isPending}
        onClose={() => setPending(null)}
        onAccept={() => pending && mutation.mutate(pending.id)}
      />
    </div>
  );
}
