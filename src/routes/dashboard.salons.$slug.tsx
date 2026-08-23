import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Flag, Trash2, Pencil, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getCommunityRoom,
  postCommunityMessage,
  updateCommunityMessage,
  deleteCommunityMessage,
  acceptCharter,
} from "@/lib/community.functions";
import { CharterDialog } from "@/components/community/CharterDialog";

export const Route = createFileRoute("/dashboard/salons/$slug")({
  component: Page,
  head: ({ params }) => {
    const name = params.slug.replace(/-/g, " ");
    const title = `Salon ${name} | Holiswiss`;
    const description = `Échangez avec les thérapeutes vérifiés du salon ${name} sur Holiswiss, dans un cadre bienveillant et modéré.`;
    return {
      meta: [
        { title: title.slice(0, 60) },
        { name: "description", content: description.slice(0, 160) },
        { property: "og:title", content: title.slice(0, 60) },
        { property: "og:description", content: description.slice(0, 160) },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
});

function timeLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("fr-CH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Page() {
  const { slug } = useParams({ from: "/dashboard/salons/$slug" });
  const qc = useQueryClient();
  const fetchRoom = useServerFn(getCommunityRoom);
  const send = useServerFn(postCommunityMessage);
  const edit = useServerFn(updateCommunityMessage);
  const remove = useServerFn(deleteCommunityMessage);
  const accept = useServerFn(acceptCharter);

  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);
  const [charterOpen, setCharterOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ["community-room", slug],
    queryFn: () => fetchRoom({ data: { slug } }),
  });

  const familyId = (query.data as any)?.family?.id as string | undefined;

  useEffect(() => {
    if (!familyId) return;
    const channel = supabase
      .channel(`community-${familyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_messages", filter: `family_id=eq.${familyId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["community-room", slug] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyId, qc, slug]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [query.data]);

  const sendMutation = useMutation({
    mutationFn: (content: string) => send({ data: { familyId: familyId!, content } }),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["community-room", slug] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Envoi impossible"),
  });

  const editMutation = useMutation({
    mutationFn: (v: { id: string; content: string }) => edit({ data: v }),
    onSuccess: () => {
      setEditing(null);
      toast.success("Message modifié");
      qc.invalidateQueries({ queryKey: ["community-room", slug] });
    },
    onError: () => toast.error("Modification impossible"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Message supprimé");
      qc.invalidateQueries({ queryKey: ["community-room", slug] });
    },
    onError: () => toast.error("Suppression impossible"),
  });

  const acceptMutation = useMutation({
    mutationFn: () => accept({ data: { familyId: familyId! } }),
    onSuccess: () => {
      setCharterOpen(false);
      qc.invalidateQueries({ queryKey: ["community-room", slug] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Acceptation impossible"),
  });

  if (query.isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Chargement du salon…</div>;
  }
  if (query.isError || !query.data) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">Salon introuvable.</p>
        <Link to="/dashboard/salons" className="text-sm text-primary underline underline-offset-2">
          Retour aux salons
        </Link>
      </div>
    );
  }

  const room = query.data as any;
  const messages = [...(room.messages ?? [])].reverse();
  const canWrite = room.isVerified && room.hasAccepted && !room.isMuted;

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col px-4 pb-28 pt-4 sm:pb-6">
      <header className="mb-3 flex items-center gap-3">
        <Link
          to="/dashboard/salons"
          aria-label="Retour aux salons"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">{room.family.name}</h1>
          <p className="truncate text-xs text-muted-foreground">
            Espace entre pairs vérifiés · modéré selon la Charte de Bienveillance
          </p>
        </div>
      </header>

      {!room.isVerified && (
        <div role="status" className="mb-3 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
          <span>Ce salon est réservé aux thérapeutes vérifiés.</span>
        </div>
      )}

      {room.isMuted && (
        <div role="status" className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
          Votre accès à l'écriture est suspendu suite à un manquement à la charte.
        </div>
      )}

      <div
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-border bg-card/50 p-3"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aucun message pour l'instant. Lancez la conversation avec bienveillance.
          </p>
        ) : (
          messages.map((m: any) => (
            <article key={m.id} className="rounded-lg border border-border bg-card p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{m.author?.name}</span>
                <span className="text-xs text-muted-foreground">{timeLabel(m.created_at)}</span>
                {m.edited_at && <span className="text-xs text-muted-foreground">(modifié)</span>}
                {m.is_flagged && (m.isMine || room.isAdmin) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                    <Flag className="h-3 w-3" aria-hidden="true" /> Signalé
                  </span>
                )}
              </div>

              {editing?.id === m.id ? (
                <div className="space-y-2">
                  <label className="sr-only" htmlFor={`edit-${m.id}`}>
                    Modifier le message
                  </label>
                  <textarea
                    id={`edit-${m.id}`}
                    value={editing.content}
                    onChange={(e) => setEditing({ id: m.id, content: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-border bg-background p-2 text-base text-foreground"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => editMutation.mutate(editing)}
                      disabled={editMutation.isPending || !editing.content.trim()}
                      className="min-h-11 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                    >
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="min-h-11 rounded-lg border border-border px-3 text-sm"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{m.content}</p>
              )}

              {m.is_flagged && m.isMine && m.flagged_reason && (
                <p className="mt-2 text-xs text-destructive">Motif : {m.flagged_reason}</p>
              )}

              {(m.isMine || room.isAdmin) && editing?.id !== m.id && (
                <div className="mt-2 flex justify-end gap-1">
                  {m.isMine && (
                    <button
                      type="button"
                      aria-label="Modifier mon message"
                      onClick={() => setEditing({ id: m.id, content: m.content })}
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Supprimer le message"
                    onClick={() => {
                      if (window.confirm("Supprimer définitivement ce message ?")) deleteMutation.mutate(m.id);
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-destructive transition hover:bg-destructive/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </article>
          ))
        )}
      </div>

      {room.isVerified && !room.hasAccepted ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          <p className="flex-1 text-sm text-muted-foreground">
            Acceptez la Charte de Bienveillance pour participer à ce salon.
          </p>
          <button
            type="button"
            onClick={() => setCharterOpen(true)}
            className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Lire et accepter
          </button>
        </div>
      ) : (
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) sendMutation.mutate(draft.trim());
          }}
        >
          <div className="flex-1">
            <label htmlFor="salon-message" className="mb-1 block text-xs font-medium text-muted-foreground">
              Votre message
            </label>
            <textarea
              id="salon-message"
              value={draft}
              rows={2}
              disabled={!canWrite || sendMutation.isPending}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Partagez une ressource, une question, un encouragement…"
              className="w-full resize-none rounded-lg border border-border bg-background p-3 text-base text-foreground placeholder:text-muted-foreground disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={!canWrite || !draft.trim() || sendMutation.isPending}
            aria-label="Envoyer le message"
            className="mb-1 flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      )}

      <CharterDialog
        open={charterOpen}
        familyName={room.family.name}
        submitting={acceptMutation.isPending}
        onClose={() => setCharterOpen(false)}
        onAccept={() => acceptMutation.mutate()}
      />
    </div>
  );
}
