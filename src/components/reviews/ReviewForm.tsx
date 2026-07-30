import { useState, useEffect, useRef } from "react";
import { Star, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserRole } from "@/lib/auth-utils";
import {
  clearHoliswissAuthSpace,
  clearLegacySupabaseSessions,
  clearStoredSupabaseSession,
  getHoliswissAuthSpace,
  setHoliswissAuthSpace,
  type HoliswissAuthSpace,
} from "@/integrations/supabase/auth-space";
import { toast } from "sonner";

const sb = supabase as any;
const REVIEW_AUTH_PARAM = "reviewAuth";

type Existing = { id: string; rating: number; comment: string; status: string } | null;

export function ReviewForm({
  therapistId,
  onSubmitted,
}: {
  therapistId: string;
  onSubmitted?: () => void;
}) {
  const [user, setUser] = useState<{ id: string; email?: string; user_metadata?: any } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [existing, setExisting] = useState<Existing>(null);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const draftKey = `holiswiss-review-draft-${therapistId}`;
  const autoSubmittedRef = useRef(false);

  const readPendingDraft = () => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      return raw ? JSON.parse(raw)?.pendingSubmit === true : false;
    } catch {
      return false;
    }
  };

  const clearReviewReturnMarker = () => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has(REVIEW_AUTH_PARAM)) return;
      url.searchParams.delete(REVIEW_AUTH_PARAM);
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    } catch {}
  };

  const activateReviewAuthSpaceIfNeeded = () => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      const isReviewReturn = url.searchParams.get(REVIEW_AUTH_PARAM) === "1";
      if (isReviewReturn || readPendingDraft()) {
        setHoliswissAuthSpace("login");
      }
    } catch {
      if (readPendingDraft()) setHoliswissAuthSpace("login");
    }
  };

  const signOutReviewVisitor = async (space: HoliswissAuthSpace) => {
    try {
      setHoliswissAuthSpace(space);
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // La déconnexion locale ne doit jamais annuler l'avis déjà enregistré.
    } finally {
      clearStoredSupabaseSession(space);
      clearStoredSupabaseSession("login");
      clearLegacySupabaseSessions();
      clearReviewReturnMarker();
      clearHoliswissAuthSpace();
      setUser(null);
    }
  };

  // Restaure un brouillon (note + texte) sauvegardé avant la redirection Google.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (typeof d.rating === "number") setRating(d.rating);
      if (typeof d.comment === "string") setComment(d.comment);
    } catch {}
  }, [draftKey]);

  useEffect(() => {
    let mounted = true;
    activateReviewAuthSpaceIfNeeded();
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
  }, [draftKey]);

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
    if (authenticating) return;
    setAuthenticating(true);
    // Sauvegarde le brouillon AVANT la redirection Google — sinon la cliente
    // revient sur la page avec le formulaire vide et pense que ça n'a pas marché.
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({ rating, comment, pendingSubmit: true, ts: Date.now() }),
      );
    } catch {}
    setHoliswissAuthSpace("login");
    clearStoredSupabaseSession("login");
    clearLegacySupabaseSessions();

    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.set(REVIEW_AUTH_PARAM, "1");
    returnUrl.hash = "";

    const { lovable } = await import("@/integrations/lovable");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: returnUrl.toString(),
      extraParams: { prompt: "select_account" },
    });
    if (result?.error) {
      setAuthenticating(false);
      toast.error("Connexion Google impossible. Réessayez depuis ce navigateur.");
    }
  };

  // Auto-soumission après retour de Google : si la cliente avait un brouillon
  // "pendingSubmit" et qu'elle est maintenant connectée, on publie tout de suite.
  useEffect(() => {
    if (!authReady || !user || autoSubmittedRef.current) return;
    let pending = false;
    pending = readPendingDraft();
    if (!pending) return;
    if (rating < 1 || comment.trim().length < 20) return;
    autoSubmittedRef.current = true;
    // Laisse React finir de peindre + le chargement d'`existing` avant de submit
    setTimeout(() => { void submit(); }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user, rating, comment]);

  const submit = async () => {
    if (!user) return;
    if (rating < 1 || rating > 5) {
      toast.error("Sélectionnez une note en cliquant sur les étoiles.");
      return;
    }
    const trimmed = comment.trim();
    if (trimmed.length < 20) {
      const missing = 20 - trimmed.length;
      toast.error(`Votre avis est trop court : il manque ${missing} caractère${missing > 1 ? "s" : ""} (20 minimum).`);
      return;
    }
    if (trimmed.length > 500) {
      toast.error("Votre avis ne doit pas dépasser 500 caractères.");
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

    const authSpaceAtSubmit = getHoliswissAuthSpace();

    let res = existing
      ? await sb.from("reviews").update(payload).eq("id", existing.id)
      : await sb.from("reviews").insert(payload);

    if (!existing && res.error) {
      const duplicate = res.error.code === "23505" || String(res.error.message ?? "").includes("duplicate key");
      if (duplicate) {
        res = await sb
          .from("reviews")
          .update(payload)
          .eq("therapist_id", therapistId)
          .eq("user_id", user.id);
      }
    }

    setSubmitting(false);
    if (res.error) {
      toast.error(`Impossible d'enregistrer votre avis : ${res.error.message}`);
      // Garde le brouillon pour que la cliente puisse réessayer
      return;
    }
    // Succès : purge le brouillon
    try { sessionStorage.removeItem(draftKey); } catch {}
    onSubmitted?.();

    // Modèle TripAdvisor : l'authentification Google sert UNIQUEMENT à signer
    // l'avis, pas à créer une session persistante. Un visiteur est donc
    // déconnecté immédiatement après avoir laissé son avis. On ne déconnecte
    // PAS un praticien/admin (vraie session de membre).
    let role: string | null = null;
    try {
      role = await getCurrentUserRole();
    } catch {
      role = null;
    }
    // On ne déconnecte QUE si le rôle est RÉSOLU comme non-membre (visiteur).
    // Si la vérification échoue (null), on NE déconnecte PAS : mieux vaut garder
    // la session que de déconnecter par erreur un praticien/admin.
    const isVisitor = role !== null && role !== "admin" && role !== "therapist";

    if (isVisitor) {
      toast.success("Merci ! Votre avis a bien été enregistré. Il sera publié après modération.");
      setEditing(false);
      setExisting(null);
      setRating(0);
      setComment("");
      await signOutReviewVisitor(authSpaceAtSubmit);
      return;
    }

    // Praticien/admin : la session de membre est conservée.
    clearReviewReturnMarker();
    toast.success("Avis enregistré.");
    setEditing(false);
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
        <div className="flex-1 min-w-[220px]">
          <p className="text-sm text-[rgba(255,255,255,0.85)]">
            {rating > 0 || comment.trim().length > 0
              ? "Votre brouillon est prêt. Signez-vous avec Google pour le publier — vous serez déconnecté(e) automatiquement après."
              : "Notez et rédigez votre avis ci-dessous, puis signez-le avec Google (déconnexion automatique après publication)."}
          </p>
          <p className="mt-1 text-xs text-[rgba(255,255,255,0.5)]">
            Google sert uniquement à vérifier votre identité. Aucun compte Holiswiss n'est créé.
          </p>
        </div>
        <button
          onClick={handleGoogle}
          disabled={authenticating}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white text-[#1a1035] px-4 py-2 text-sm font-semibold hover:bg-white/90 transition disabled:opacity-60 disabled:cursor-wait"
        >
          <LogIn className="h-4 w-4" /> {authenticating ? "Connexion…" : "Continuer avec Google"}
        </button>

        {/* Formulaire visible AVANT connexion pour que la cliente puisse préparer son avis */}
        <div className="w-full mt-2 space-y-3">
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
                  className="min-h-11 min-w-11 p-1 transition-transform hover:scale-110"
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
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            rows={4}
            placeholder="Partagez votre expérience (20 à 500 caractères)…"
            className="w-full rounded-lg border border-[rgba(184,110,249,0.25)] bg-[#0f0a1e] px-3 py-2 text-sm text-white placeholder:text-[rgba(255,255,255,0.3)] focus:border-[#b86ef9] focus:outline-none"
          />
          <p className="text-xs text-[rgba(255,255,255,0.4)]">
            {comment.trim().length}/500 {comment.trim().length < 20 ? `— encore ${20 - comment.trim().length} caractères pour publier` : ""}
          </p>
        </div>
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
              className="min-h-11 min-w-11 p-1 transition-transform hover:scale-110"
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
        <p className={`mt-1 text-xs ${len > 0 && len < 20 ? "text-amber-400" : "text-[rgba(255,255,255,0.4)]"}`}>
          {len < 20
            ? `${len}/500 — encore ${20 - len} caractère${20 - len > 1 ? "s" : ""} pour publier`
            : `${len}/500`}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={submitting}
          aria-disabled={rating === 0 || len < 20}
          className="rounded-full bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] px-5 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition aria-disabled:opacity-60"
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