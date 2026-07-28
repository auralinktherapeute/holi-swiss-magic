import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Star, Loader2, MessageSquare, Send } from "lucide-react";
import { listMyReviews, replyToReview } from "@/lib/therapist-profile-extra.functions";

export const Route = createFileRoute("/dashboard/avis")({ component: Page });

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  author_name: string | null;
  created_at: string;
  status: string;
  therapist_reply?: string | null;
  therapist_reply_at?: string | null;
  therapist_reply_status?: "pending" | "approved" | "rejected" | null;
};

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={i <= n ? "fill-amber-400 text-amber-400" : "text-white/20"} size={15} />
      ))}
    </span>
  );
}

function Page() {
  const fetchReviews = useServerFn(listMyReviews);
  const reply = useServerFn(replyToReview);
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  // La réponse aux avis n'est proposée que si la colonne existe en base.
  const [canReply, setCanReply] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetchReviews();
      setRows(res.rows as Review[]);
      setCanReply((res as any).canReply !== false);
    } catch (e: any) {
      toast.error(e?.message ?? "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [fetchReviews]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const send = async (id: string) => {
    const text = (drafts[id] ?? "").trim();
    setSaving(id);
    try {
      await reply({ data: { reviewId: id, text } });
      toast.success(text ? "Réponse publiée." : "Réponse supprimée.");
      setDrafts((d) => { const c = { ...d }; delete c[id]; return c; });
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Publication impossible");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6 text-white">
      <header className="mb-6 flex items-center gap-3">
        <MessageSquare className="text-[#5cc8fa]" />
        <div>
          <h1 className="text-2xl font-semibold">Mes avis</h1>
          <p className="text-sm text-white/50">Répondez à vos avis clients — votre réponse est visible publiquement sur votre fiche.</p>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-white/60"><Loader2 className="animate-spin" size={16} /> Chargement…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-white/40">
          Vous n'avez pas encore d'avis publié.
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const hasReply = !!(r.therapist_reply && r.therapist_reply.length);
            const draft = drafts[r.id] ?? r.therapist_reply ?? "";
            const st = r.therapist_reply_status ?? null;
            const badge = hasReply
              ? st === "approved"
                ? { label: "Publiée", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" }
                : st === "rejected"
                  ? { label: "Refusée par la modération", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" }
                  : { label: "En attente de validation", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" }
              : null;
            return (
              <li key={r.id} className="rounded-2xl border border-[rgba(168,85,247,.25)] bg-[#2d1b4e]/70 p-4">
                <div className="flex items-center justify-between">
                  <Stars n={r.rating} />
                  <span className="text-xs text-white/40">{new Date(r.created_at).toLocaleDateString("fr-CH")}</span>
                </div>
                {r.author_name && <p className="mt-2 font-semibold text-white">{r.author_name}</p>}
                {r.comment && <p className="mt-1 text-sm text-white/75">{r.comment}</p>}

                {canReply && (
                <div className="mt-3 rounded-xl bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-cyan-300">Votre réponse</label>
                    {badge && (
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-white/40">
                    Toute réponse est relue par la modération avant d'apparaître sur votre fiche publique.
                  </p>
                  <textarea
                    value={draft}
                    onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                    rows={2}
                    placeholder="Remerciez, précisez, restez professionnel…"
                    className="mt-2 w-full rounded-md border border-white/15 bg-[#1a0a2e] px-3 py-2 text-sm text-white placeholder:text-white/30"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => send(r.id)}
                      disabled={saving === r.id}
                      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {saving === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {hasReply ? "Mettre à jour" : "Soumettre ma réponse"}
                    </button>
                  </div>
                </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
