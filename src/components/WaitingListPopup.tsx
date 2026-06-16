import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Check, ArrowRight, ArrowLeft, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getWaitingListCount } from "@/lib/public.functions";
import { sendWaitlistEmails } from "@/lib/waitlist-emails.functions";

const SESSION_KEY = "holiswiss-waitlist-shown";
const TOTAL_SPOTS = 70;
const DELAY_MS = 12000;

const SPECIALTIES = [
  "Naturopathie", "Acupuncture", "Ostéopathie", "Kinésiologie",
  "Hypnothérapie", "Réflexologie", "Massage thérapeutique", "Reiki",
  "Sophrologie", "Coaching holistique", "Nutrition", "Ayurveda",
  "Médecine chinoise", "Aromathérapie", "Autre",
];

const CANTONS = [
  "AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU","NE",
  "NW","OW","SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH",
];

const phoneRegex = /^(\+41\s?|0)([1-9]\d(\s?\d{3}){2}|[1-9]\d{8})$/;

const step1Schema = z.object({
  first_name: z.string().trim().min(2, "Prénom requis (2 caractères min)").max(60),
  last_name: z.string().trim().min(2, "Nom requis (2 caractères min)").max(60),
  email: z.string().trim().toLowerCase().email("Email invalide").max(254),
  phone: z.string().trim().max(30).optional().refine(
    (v) => !v || phoneRegex.test(v.replace(/\s/g, "").replace(/^\+41/, "+41")) || phoneRegex.test(v),
    "Format suisse invalide (+41 ou 0XX XXX XX XX)"
  ),
  specialty: z.string().min(1, "Spécialité requise"),
  canton: z.string().min(1, "Canton requis"),
});

const step2Schema = z.object({
  message: z.string().max(500).optional(),
  accepted_terms: z.literal(true, { errorMap: () => ({ message: "Veuillez accepter la politique de confidentialité pour finaliser votre inscription." }) }),
});

type FormState = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  specialty: string;
  canton: string;
  message: string;
  accepted_terms: boolean;
};

const initialForm: FormState = {
  first_name: "", last_name: "", email: "", phone: "",
  specialty: "", canton: "", message: "", accepted_terms: false,
};

export function WaitingListPopup() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.split("-")[0] || "fr";
  const tp = (k: string, v?: Record<string, unknown>) => t(`waitlist.popup.${k}`, v ?? {}) as string;
  const fetchWaitingListCount = useServerFn(getWaitingListCount);
  const sendEmails = useServerFn(sendWaitlistEmails);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { if (sessionStorage.getItem(SESSION_KEY)) return; } catch {}
    const id = window.setTimeout(() => {
      setOpen(true);
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch {}
    }, DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { count } = await fetchWaitingListCount();
      if (!cancelled) setCount(count);
    })();
    return () => { cancelled = true; };
  }, [fetchWaitingListCount, open]);

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
    window.setTimeout(() => {
      setStep(1);
      setForm(initialForm);
      setErrors({});
      setSuccess(false);
      setSubmitError(null);
    }, 300);
  }

  function onBackdropClick(e: React.MouseEvent) {
    if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) close();
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  }

  function goStep2() {
    const parsed = step1Schema.safeParse({
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      phone: form.phone || undefined,
      specialty: form.specialty,
      canton: form.canton,
    });
    if (!parsed.success) {
      const errs: Partial<Record<keyof FormState, string>> = {};
      parsed.error.issues.forEach((i) => {
        const k = i.path[0] as keyof FormState;
        if (!errs[k]) errs[k] = tp(`errors_form.${k}`) || i.message;
      });
      setErrors(errs);
      return;
    }
    setErrors({});
    setStep(2);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const parsed = step2Schema.safeParse({
      message: form.message || undefined,
      accepted_terms: form.accepted_terms as true,
    });
    if (!parsed.success) {
      const errs: Partial<Record<keyof FormState, string>> = {};
      parsed.error.issues.forEach((i) => {
        const k = i.path[0] as keyof FormState;
        const key = k === "accepted_terms" ? "terms" : k;
        if (!errs[k]) errs[k] = tp(`errors_form.${key}`) || i.message;
      });
      setErrors(errs);
      return;
    }
    setLoading(true);
    const cleanEmail = form.email.trim().toLowerCase();
    const { data: inserted, error: insertError } = await supabase
      .from("waiting_list")
      .insert({
        email: cleanEmail,
        source: "popup",
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || null,
        specialty: form.specialty,
        canton: form.canton,
        message: form.message.trim() || null,
        accepted_terms: true,
      } as never)
      .select("id")
      .maybeSingle();
    setLoading(false);
    if (insertError) {
      if (insertError.code === "23505" || /duplicate|unique/i.test(insertError.message)) {
        setSubmitError(t("waitlist.already") || "Cet email est déjà inscrit.");
        return;
      }
      setSubmitError(t("waitlist.error") || "Une erreur est survenue. Veuillez réessayer.");
      return;
    }
    setSuccess(true);
    setCount((c) => c + 1);
    void sendEmails({
      data: {
        email: cleanEmail,
        id: (inserted as { id?: string } | null)?.id,
        source: "popup",
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || undefined,
        specialty: form.specialty,
        canton: form.canton,
        message: form.message.trim() || undefined,
      },
    }).catch((err) => console.error("[waitlist] email send failed", err));
  }

  const confettiPieces = useMemo(
    () => Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.3,
      duration: 1.4 + Math.random() * 0.8,
      color: i % 2 === 0 ? "#b86ef9" : "#5cc8fa",
      rotate: Math.random() * 360,
      size: 6 + Math.random() * 6,
    })),
    [success]
  );

  if (!open) return null;

  const isFull = count >= TOTAL_SPOTS;
  const pct = Math.min(100, Math.round((count / TOTAL_SPOTS) * 100));

  return (
    <div
      onMouseDown={onBackdropClick}
      className="fixed inset-0 z-[1000] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-title"
    >
      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative w-full max-w-[540px] overflow-hidden"
        style={{
          background: "rgba(15,10,30,0.97)",
          border: "1px solid rgba(184,110,249,0.25)",
          borderRadius: 24,
          boxShadow: "0 25px 80px rgba(0,0,0,0.6)",
          backdropFilter: "blur(20px)",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Fermer"
          className="absolute top-4 right-4 inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors z-10"
          style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.04)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.95)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="px-7 pt-8 pb-3 text-center">
          <div
            aria-hidden
            className="mx-auto mb-3 flex items-center justify-center"
            style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "rgba(184,110,249,0.12)",
              border: "1px solid rgba(184,110,249,0.35)",
            }}
          >
            <LotusIcon />
          </div>
          <h2 id="waitlist-title" className="font-bold text-white" style={{ fontSize: 22, lineHeight: 1.25 }}>
            Rejoignez Holiswiss en avant-première
          </h2>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, marginTop: 6 }}>
            Inscription 100% gratuite · Lancement imminent
          </p>
        </div>

        {!success && !isFull && (
          <div className="px-7 pt-2 pb-4">
            <StepIndicator step={step} />
          </div>
        )}

        <div className="px-7 pb-5">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span style={{ color: "#b86ef9", fontWeight: 600, fontSize: 13 }}>
                {count} / {TOTAL_SPOTS} thérapeutes inscrits
              </span>
              <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>{pct}%</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 999, height: 6, overflow: "hidden" }}>
              <div style={{
                width: `${pct}%`, height: "100%",
                background: "linear-gradient(90deg, #b86ef9, #5cc8fa)",
                borderRadius: 999, transition: "width 1s ease",
              }} />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="text-center py-2 relative"
              >
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  {confettiPieces.map((p) => (
                    <motion.span
                      key={p.id}
                      initial={{ y: -20, opacity: 1, rotate: 0 }}
                      animate={{ y: 320, opacity: 0, rotate: p.rotate }}
                      transition={{ duration: p.duration, delay: p.delay, ease: "easeOut" }}
                      style={{
                        position: "absolute",
                        left: `${p.left}%`,
                        top: 0,
                        width: p.size, height: p.size,
                        background: p.color,
                        borderRadius: 2,
                      }}
                    />
                  ))}
                </div>
                <motion.svg
                  viewBox="0 0 52 52" width="68" height="68" aria-hidden="true"
                  className="mx-auto mb-3"
                  initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 16 }}
                >
                  <circle cx="26" cy="26" r="24" fill="rgba(34,197,94,0.12)" stroke="#22c55e" strokeWidth="2" />
                  <path d="M14 27 l8 8 l16 -18" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </motion.svg>
                <h3 className="text-white font-bold" style={{ fontSize: 18 }}>
                  Bienvenue chez Holiswiss ! 🎉
                </h3>
                <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, marginTop: 8, lineHeight: 1.55 }}>
                  Votre inscription a bien été enregistrée, <strong style={{ color: "#fff" }}>{form.first_name}</strong> !<br />
                  Un email de confirmation vous a été envoyé à <strong style={{ color: "#fff" }}>{form.email}</strong>.
                </p>
                <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12.5, marginTop: 10 }}>
                  💡 Pensez à vérifier votre dossier <strong style={{ color: "rgba(255,255,255,0.8)" }}>Spams</strong>.
                </p>
                <div
                  className="mt-5 text-left"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(184,110,249,0.2)",
                    borderRadius: 14,
                    padding: "14px 16px",
                    fontSize: 13.5,
                    color: "rgba(255,255,255,0.85)",
                    lineHeight: 1.8,
                  }}
                >
                  <div>👤&nbsp; <strong>{form.first_name} {form.last_name}</strong></div>
                  <div>🏷️&nbsp; {form.specialty}</div>
                  <div>📍&nbsp; Canton {form.canton}</div>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="mt-5 inline-flex items-center justify-center rounded-full px-5 py-2.5 transition-colors"
                  style={{
                    color: "rgba(255,255,255,0.85)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "transparent", fontSize: 14,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  Fermer
                </button>
              </motion.div>
            ) : isFull ? (
              <p className="text-center py-4" style={{ color: "rgba(255,255,255,0.85)", fontSize: 15 }}>
                {t("waitlist.full") || "La liste d'attente est complète."}
              </p>
            ) : (
              <form onSubmit={onSubmit} noValidate>
                <AnimatePresence mode="wait">
                  {step === 1 ? (
                    <motion.div
                      key="s1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Prénom *" error={errors.first_name}>
                          <Input value={form.first_name} onChange={(v) => update("first_name", v)} placeholder="Marie" autoFocus />
                        </Field>
                        <Field label="Nom *" error={errors.last_name}>
                          <Input value={form.last_name} onChange={(v) => update("last_name", v)} placeholder="Dupont" />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Email *" error={errors.email}>
                          <Input type="email" value={form.email} onChange={(v) => update("email", v)} placeholder="marie@exemple.ch" />
                        </Field>
                        <Field label="Téléphone" error={errors.phone}>
                          <Input type="tel" value={form.phone} onChange={(v) => update("phone", v)} placeholder="+41 79 123 45 67" />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Spécialité *" error={errors.specialty}>
                          <Select value={form.specialty} onChange={(v) => update("specialty", v)} options={SPECIALTIES} placeholder="Choisir…" />
                        </Field>
                        <Field label="Canton *" error={errors.canton}>
                          <Select value={form.canton} onChange={(v) => update("canton", v)} options={CANTONS} placeholder="Choisir…" />
                        </Field>
                      </div>
                      <button
                        type="button"
                        onClick={goStep2}
                        className="w-full inline-flex items-center justify-center gap-2 text-white font-semibold transition-all"
                        style={{
                          background: "linear-gradient(135deg,#b86ef9,#5cc8fa)",
                          borderRadius: 12, padding: "14px 16px", fontSize: 15, marginTop: 6,
                        }}
                      >
                        Continuer <ArrowRight className="h-4 w-4" />
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="s2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3"
                    >
                      <Field
                        label="Votre message (optionnel)"
                        error={errors.message}
                        hint={`${form.message.length} / 500`}
                      >
                        <textarea
                          rows={4}
                          maxLength={500}
                          value={form.message}
                          onChange={(e) => update("message", e.target.value)}
                          placeholder="Décrivez brièvement votre approche thérapeutique, votre expérience..."
                          className="w-full text-white outline-none transition-colors resize-none"
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 10,
                            padding: "12px 16px",
                            fontSize: 14,
                            lineHeight: 1.5,
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = "#b86ef9";
                            e.currentTarget.style.boxShadow = "0 0 0 4px rgba(184,110,249,0.15)";
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        />
                      </Field>

                      <label className="flex gap-3 cursor-pointer select-none" style={{ alignItems: "flex-start" }}>
                        <CustomCheckbox
                          checked={form.accepted_terms}
                          onChange={(v) => update("accepted_terms", v)}
                        />
                        <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 1.55 }}>
                          J'ai pris connaissance de la{" "}
                          <a href="/fr/politique-confidentialite" target="_blank" rel="noreferrer"
                            style={{ color: "#5cc8fa", textDecoration: "underline" }}
                            onClick={(e) => e.stopPropagation()}>
                            politique de confidentialité
                          </a>{" "}
                          de Holiswiss.ch et j'accepte que mes données soient traitées conformément à la loi suisse sur la protection des données (LPD / nLPD). *
                        </span>
                      </label>
                      {errors.accepted_terms && (
                        <p role="alert" style={{ color: "#f87171", fontSize: 12, marginTop: -4 }}>
                          {errors.accepted_terms}
                        </p>
                      )}
                      <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, lineHeight: 1.5 }}>
                        Vos données sont hébergées en Suisse et ne sont jamais transmises à des tiers.
                        Vous pouvez demander leur suppression à tout moment via{" "}
                        <a href="mailto:contact@holiswiss.ch" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "underline" }}>
                          contact@holiswiss.ch
                        </a>.
                      </p>

                      {submitError && (
                        <p role="alert" style={{ color: "#f87171", fontSize: 13 }}>
                          {submitError}
                        </p>
                      )}

                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => { setStep(1); setSubmitError(null); }}
                          disabled={loading}
                          className="inline-flex items-center justify-center gap-2 transition-colors"
                          style={{
                            color: "rgba(255,255,255,0.75)",
                            background: "transparent",
                            border: "1px solid rgba(255,255,255,0.18)",
                            borderRadius: 12, padding: "13px 18px", fontSize: 14,
                          }}
                        >
                          <ArrowLeft className="h-4 w-4" /> Retour
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-1 inline-flex items-center justify-center gap-2 text-white font-semibold transition-all disabled:opacity-70"
                          style={{
                            background: "linear-gradient(135deg,#b86ef9,#5cc8fa)",
                            borderRadius: 12, padding: "14px 16px", fontSize: 15,
                          }}
                        >
                          {loading ? (
                            <>
                              <span
                                className="inline-block waitlist-spin"
                                style={{
                                  width: 16, height: 16,
                                  border: "2px solid rgba(255,255,255,0.4)",
                                  borderTopColor: "white",
                                  borderRadius: "50%",
                                }}
                              />
                              Inscription en cours...
                            </>
                          ) : (
                            "M'inscrire gratuitement"
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <style>{`
        @keyframes waitlist-spin-kf { to { transform: rotate(360deg); } }
        .waitlist-spin { animation: waitlist-spin-kf 0.8s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .waitlist-spin { animation: none; }
        }
      `}</style>
    </div>
  );
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center justify-center gap-3" aria-label={`Étape ${step} sur 2`}>
      <StepDot active={step >= 1} done={step > 1} num={1} label="Infos" />
      <div style={{ height: 2, width: 40, background: step > 1 ? "#b86ef9" : "rgba(255,255,255,0.15)", borderRadius: 2, transition: "background 0.3s" }} />
      <StepDot active={step >= 2} done={false} num={2} label="Message" />
    </div>
  );
}

function StepDot({ active, done, num, label }: { active: boolean; done: boolean; num: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center justify-center text-xs font-bold transition-all"
        style={{
          width: 26, height: 26, borderRadius: "50%",
          background: active ? "#b86ef9" : "rgba(255,255,255,0.06)",
          color: active ? "#fff" : "rgba(255,255,255,0.5)",
          border: active ? "none" : "1px solid rgba(255,255,255,0.12)",
        }}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : num}
      </div>
      <span style={{ fontSize: 12.5, color: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)", fontWeight: active ? 600 : 500 }}>
        {label}
      </span>
    </div>
  );
}

function Field({
  label, error, hint, children,
}: {
  label: string; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label style={{ color: "rgba(255,255,255,0.75)", fontSize: 12.5, fontWeight: 500 }}>{label}</label>
        {hint && <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11.5 }}>{hint}</span>}
      </div>
      {children}
      {error && (
        <p role="alert" style={{ color: "#f87171", fontSize: 12, marginTop: 4 }}>{error}</p>
      )}
    </div>
  );
}

function Input({
  value, onChange, placeholder, type = "text", autoFocus,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; autoFocus?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-white outline-none transition-all"
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10,
        padding: "11px 14px",
        fontSize: 14,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "#b86ef9";
        e.currentTarget.style.boxShadow = "0 0 0 4px rgba(184,110,249,0.15)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
        e.currentTarget.style.boxShadow = "none";
      }}
    />
  );
}

function Select({
  value, onChange, options, placeholder,
}: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none text-white outline-none transition-all cursor-pointer"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10,
          padding: "11px 36px 11px 14px",
          fontSize: 14,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "#b86ef9";
          e.currentTarget.style.boxShadow = "0 0 0 4px rgba(184,110,249,0.15)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        <option value="" disabled style={{ background: "#1a1035", color: "rgba(255,255,255,0.5)" }}>
          {placeholder || "—"}
        </option>
        {options.map((o) => (
          <option key={o} value={o} style={{ background: "#1a1035", color: "#fff" }}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
        style={{ color: "#b86ef9", width: 16, height: 16 }}
      />
    </div>
  );
}

function CustomCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-center shrink-0 transition-all"
      style={{
        width: 20, height: 20,
        borderRadius: 5,
        background: checked ? "#b86ef9" : "rgba(255,255,255,0.05)",
        border: `1px solid ${checked ? "#b86ef9" : "rgba(255,255,255,0.2)"}`,
        marginTop: 2,
      }}
    >
      {checked && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          style={{ display: "inline-flex" }}
        >
          <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
        </motion.span>
      )}
    </button>
  );
}

function LotusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b86ef9" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c-4 0-7-2.5-7-5 1.5 1 3.5 1.5 5 1.5" />
      <path d="M12 22c4 0 7-2.5 7-5-1.5 1-3.5 1.5-5 1.5" />
      <path d="M12 18.5c-3-1.5-5-4-5-7 0-2 1-4 2.5-5 .5 2 1.5 4 2.5 5" />
      <path d="M12 18.5c3-1.5 5-4 5-7 0-2-1-4-2.5-5-.5 2-1.5 4-2.5 5" />
      <path d="M12 18.5V8c0-2 0-4 0-6" />
    </svg>
  );
}

export default WaitingListPopup;
