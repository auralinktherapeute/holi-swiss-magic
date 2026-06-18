import { useState, useEffect } from "react";
import { Star, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const sb = supabase as any;

type Existing = { id: string; rating: number; comment: string; status: string } | null;

export function ReviewForm({
  therapistId,
  onSubmitted,
}: {
  therapistId: string;
  onSubmitted?: () => void;
}) {
  const { t } = useTranslation();
  const [user, setUser] = useState<{ id: string; email?: string; user_metadata?: any } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [existing, setExisting] = useState<Existing>(null);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user as any);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser((session?.user as any) ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setExisting(null);
      return;
    }
    sb
      .from("reviews")
      .select("id,rating,comment,status")
      .eq("therapist_id", therapistId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setExisting(data);
          setRating(data.rating);
          setComment(data.comment);
        }
      });
  }, [user, therapistId]);

  const handleGoogle = async () => {
    await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.href });
  };

  const submit = async () => {
    if (!user) return;
    if (rating < 1 || rating > 5) {
      toast.error("Sélectionnez une note");
      return;
    }
    const trimmed = comment.trim();
    if (trimmed.length < 20 || trimmed.length > 500) {
      toast.error("Le commentaire doit faire entre 20 et 500 caractères");
      return;
    }
    setSubmitting(true);
    const name =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Anonyme";
    const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

    const payload: any = {
      therapist_id: therapistId,
      user_id: user.id,
      rating,
      comment: trimmed,
      author_name: name,
      author_avatar_url: avatar,
      status: "pending",
    };

    const res = existing
      ? await sb.from("reviews").update(payload).eq("id", existing.id)
      : await sb.from("reviews").insert(payload);

    setSubmitting(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Avis envoyé — en attente de modération");
    setEditing(false);
    onSubmitted?.();
    // refresh local existing
    if (user) {
      const { data } = await sb
        .from("reviews")
        .select("id,rating,comment,status")
        .eq("therapist_id", therapistId)
        .eq("user_id", user.id)
        .maybeSingle();
      setExisting(data as any);
    }
  };

  if (!authReady) return null;

  if (!user) {
    return (
      <div className="rounded-xl border border-[rgba(184,110,249,0.25)] bg-[rgba(184,110,249,0.06)] p-4 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-[rgba(255,255,255,0.75)]">
          Connectez-vous pour laisser un avis sur ce thérapeute.
        </p>
        <button
          onClick={handleGoogle}
          className="inline-flex items-center gap-2 rounded-full bg-white text-[#1a1035] px-4 py-2 text-sm font-semibold hover:bg-white/90 transition"
        >
          <LogIn className="h-4 w-4" /> Continuer avec Google
        </button>
      </div>
    );
  }

  if (existing && !editing) {
    return (
      <div className="rounded-xl border border-[rgba(184,110,249,0.25)] bg-[rgba(184,110,249,0.06)] p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-[rgba(255,255,255,0.75)]">
          <span className="font-semibold text-white">Votre avis</span>{" "}
          <span className="text-[rgba(255,255,255,0.5)]">
            ({existing.status === "approved" ? "publié" : existing.status === "rejected" ? "refusé" : "en attente"})
          </span>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="rounded-full border border-[#b86ef9] px-4 py-2 text-sm font-semibold text-[#b86ef9] hover:bg-[rgba(184,110,249,0.1)] transition"
        >
          Modifier mon avis
        </button>
      </div>
    );
  }

  const len = comment.trim().length;
  return (
    <div className="rounded-xl border border-[rgba(184,110,249,0.25)] bg-[rgba(184,110,249,0.06)] p-4 space-y-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-[rgba(255,255,255,0.5)] mb-1">Votre note</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} étoiles`}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={`h-7 w-7 ${
                  n <= (hover || rating)
                    ? "fill-amber-400 text-amber-400"
                    : "text-[rgba(255,255,255,0.25)]"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
      <div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 500))}
          rows={4}
          placeholder="Partagez votre expérience (20 à 500 caractères)…"
          className="w-full rounded-lg border border-[rgba(184,110,249,0.25)] bg-[#0f0a1e] px-3 py-2 text-sm text-white placeholder:text-[rgba(255,255,255,0.3)] focus:border-[#b86ef9] focus:outline-none"
        />
        <p className={`mt-1 text-xs ${len < 20 || len > 500 ? "text-amber-400" : "text-[rgba(255,255,255,0.4)]"}`}>
          {len}/500 — minimum 20 caractères
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={submitting || rating === 0 || len < 20}
          className="rounded-full bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] px-5 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition"
        >
          {submitting ? "Envoi…" : existing ? "Mettre à jour" : "Publier mon avis"}
        </button>
        {existing && (
          <button
            onClick={() => {
              setEditing(false);
              setRating(existing.rating);
              setComment(existing.comment);
            }}
            className="rounded-full border border-[rgba(255,255,255,0.2)] px-4 py-2 text-sm text-[rgba(255,255,255,0.7)] hover:bg-white/5 transition"
          >
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}