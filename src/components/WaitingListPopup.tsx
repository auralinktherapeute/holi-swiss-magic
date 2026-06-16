import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getWaitingListCount } from "@/lib/public.functions";
import { sendWaitlistEmails } from "@/lib/waitlist-emails.functions";

const SESSION_KEY = "holiswiss-waitlist-shown";
const TOTAL_SPOTS = 70;
const DELAY_MS = 12000;

export function WaitingListPopup() {
  const { t } = useTranslation();
  const fetchWaitingListCount = useServerFn(getWaitingListCount);
  const sendEmails = useServerFn(sendWaitlistEmails);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Auto-open after delay, once per session
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {}
    const id = window.setTimeout(() => {
      setOpen(true);
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch {}
    }, DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  // Load count when opened
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { count } = await fetchWaitingListCount();
      if (!cancelled) setCount(count);
    })();
    return () => { cancelled = true; };
  }, [fetchWaitingListCount, open]);

  // Esc + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  function onBackdropClick(e: React.MouseEvent) {
    if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) close();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError(t("waitlist.error"));
      return;
    }
    setLoading(true);
    const { data: inserted, error: insertError } = await supabase
      .from("waiting_list")
      .insert({ email: clean, source: "popup" } as never)
      .select("id")
      .maybeSingle();
    setLoading(false);
    if (insertError) {
      // unique violation
      if (insertError.code === "23505" || /duplicate|unique/i.test(insertError.message)) {
        setError(t("waitlist.already"));
        return;
      }
      setError(t("waitlist.error"));
      return;
    }
    setSuccess(true);
    setCount((c) => c + 1);
    // Fire-and-forget email notifications (don't block UI on failure)
    void sendEmails({
      data: {
        email: clean,
        id: (inserted as { id?: string } | null)?.id,
        source: "popup",
      },
    }).catch((err) => console.error("[waitlist] email send failed", err));
  }

  if (!open) return null;

  const isFull = count >= TOTAL_SPOTS;
  const remaining = Math.max(0, TOTAL_SPOTS - count);
  const pct = Math.min(100, Math.round((count / TOTAL_SPOTS) * 100));
  const showUrgency = count > 50 && !isFull;

  return (
    <div
      onMouseDown={onBackdropClick}
      className="fixed inset-0 z-[1000] flex items-center justify-center px-4 animate-in fade-in duration-300"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-title"
    >
      <div
        ref={dialogRef}
        className="relative w-[90%] max-w-[480px] animate-in zoom-in-95 fade-in duration-300"
        style={{
          background: "#0f0a1e",
          border: "1px solid rgba(184,110,249,0.3)",
          borderRadius: 20,
          padding: 40,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(184,110,249,0.1)",
        }}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute top-4 right-4 inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors"
          style={{ color: "rgba(255,255,255,0.4)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.85)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center">
          <span
            className="inline-block waitlist-pulse"
            style={{
              background: "rgba(184,110,249,0.15)",
              border: "1px solid rgba(184,110,249,0.4)",
              borderRadius: 999,
              padding: "4px 14px",
              color: "#b86ef9",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {t("waitlist.badge")}
          </span>
          <h2
            id="waitlist-title"
            className="font-bold text-white"
            style={{ fontSize: 24, marginTop: 16, lineHeight: 1.25 }}
          >
            {t("waitlist.title")}
          </h2>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, lineHeight: 1.6, marginTop: 12 }}>
            {t("waitlist.subtitle")}
          </p>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span style={{ color: "#b86ef9", fontWeight: 700, fontSize: 18 }}>
              {t("waitlist.places", { count })}
            </span>
            {showUrgency && (
              <span style={{ color: "#f59e0b", fontWeight: 600, fontSize: 13 }}>
                {t("waitlist.urgency", { count: remaining })}
              </span>
            )}
          </div>
          <div
            className="overflow-hidden"
            style={{ background: "rgba(255,255,255,0.08)", borderRadius: 999, height: 8 }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                background: "linear-gradient(90deg, #b86ef9, #5cc8fa)",
                borderRadius: 999,
                transition: "width 1s ease",
              }}
            />
          </div>
        </div>

        <div className="mt-6">
          {success ? (
            <div className="text-center py-2">
              <svg
                viewBox="0 0 52 52"
                className="mx-auto mb-3"
                width="64"
                height="64"
                aria-hidden="true"
              >
                <circle cx="26" cy="26" r="24" fill="none" stroke="#22c55e" strokeWidth="2" className="waitlist-check-circle" />
                <path d="M14 27 l8 8 l16 -18" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="waitlist-check-path" />
              </svg>
              <p style={{ color: "#b86ef9", fontWeight: 600 }}>
                {t("waitlist.success", { email })}
              </p>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, marginTop: 8 }}>
                {t("waitlist.reserved")}
              </p>
            </div>
          ) : isFull ? (
            <p className="text-center" style={{ color: "rgba(255,255,255,0.85)", fontSize: 15 }}>
              {t("waitlist.full")}
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("waitlist.placeholder")}
                aria-label={t("waitlist.placeholder")}
                disabled={loading}
                className="w-full text-white outline-none transition-colors"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontSize: 16,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#b86ef9")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
              />
              {error && (
                <p role="alert" style={{ color: "#f87171", fontSize: 13 }}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-semibold transition-all disabled:opacity-70"
                style={{
                  background: "linear-gradient(135deg, #b86ef9, #5cc8fa)",
                  borderRadius: 10,
                  padding: 14,
                  marginTop: 8,
                  fontSize: 15,
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.opacity = "0.9";
                    e.currentTarget.style.transform = "scale(1.01)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2 justify-center">
                    <span
                      className="inline-block waitlist-spin"
                      style={{
                        width: 16,
                        height: 16,
                        border: "2px solid rgba(255,255,255,0.4)",
                        borderTopColor: "white",
                        borderRadius: "50%",
                      }}
                    />
                    {t("waitlist.loading")}
                  </span>
                ) : (
                  t("waitlist.cta")
                )}
              </button>
            </form>
          )}
        </div>

        <p
          className="text-center"
          style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 20 }}
        >
          {t("waitlist.privacy")}
        </p>
      </div>

      <style>{`
        @keyframes waitlist-pulse-kf {
          0%, 100% { box-shadow: 0 0 0 0 rgba(184,110,249,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(184,110,249,0); }
        }
        .waitlist-pulse { animation: waitlist-pulse-kf 2s infinite; }
        @keyframes waitlist-spin-kf { to { transform: rotate(360deg); } }
        .waitlist-spin { animation: waitlist-spin-kf 0.8s linear infinite; }
        .waitlist-check-circle {
          stroke-dasharray: 151;
          stroke-dashoffset: 151;
          animation: waitlist-draw 0.5s ease-out forwards;
        }
        .waitlist-check-path {
          stroke-dasharray: 50;
          stroke-dashoffset: 50;
          animation: waitlist-draw 0.4s 0.4s ease-out forwards;
        }
        @keyframes waitlist-draw { to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .waitlist-pulse, .waitlist-spin { animation: none; }
        }
      `}</style>
    </div>
  );
}

export default WaitingListPopup;