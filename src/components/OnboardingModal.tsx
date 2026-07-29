import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, ArrowRight, ArrowLeft, Check, CalendarDays, Star, PenLine, ShieldCheck, User2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { sendWaitlistEmails } from "@/lib/waitlist-emails.functions";
import lotusAsset from "@/assets/lotus-transparent.png.asset.json";
const lotusUrl = lotusAsset.url;

const SESSION_KEY = "holiswiss-onboarding-shown";
const PERSIST_KEY = "holiswiss-onboarding-converted-at";
const DELAY_MS = 8000;
const RESHOW_DAYS = 30;

type SlideDef = {
  id: string;
  kicker: string;
  title: string;
  bullets?: string[];
  highlight?: { icon: React.ComponentType<{ className?: string }>; label: string; sub: string }[];
};

const emailSchema = z.string().trim().toLowerCase().email();

export function OnboardingModal() {
  const { t, i18n } = useTranslation();
  const sendEmails = useServerFn(sendWaitlistEmails);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [email, setEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const tr = (fr: string, de: string) => (i18n.language?.startsWith("de") ? de : fr);

  const slides: SlideDef[] = useMemo(() => [
    {
      id: "welcome",
      kicker: tr("Étape 01 — Bienvenue", "Schritt 01 — Willkommen"),
      title: tr("L'excellence suisse au service de votre cabinet.", "Schweizer Exzellenz für Ihre Praxis."),
      bullets: [
        tr("Accédez à une patientèle premium recherchant l'expertise suisse.", "Erreichen Sie eine anspruchsvolle Klientel, die Schweizer Expertise sucht."),
        tr("Simplifiez votre gestion quotidienne avec nos outils intégrés.", "Vereinfachen Sie Ihren Alltag mit integrierten Werkzeugen."),
        tr("Rejoignez un réseau de praticiens certifiés et reconnus.", "Werden Sie Teil eines Netzwerks zertifizierter Fachpersonen."),
      ],
    },
    {
      id: "profile",
      kicker: tr("Étape 02 — Votre profil", "Schritt 02 — Ihr Profil"),
      title: tr("Une vitrine premium, prête en quelques minutes.", "Ein Premium-Auftritt, in wenigen Minuten bereit."),
      highlight: [
        { icon: User2, label: tr("Profil vérifié", "Verifiziertes Profil"), sub: tr("Photo, bio, spécialités, tarifs.", "Foto, Bio, Fachgebiete, Tarife.") },
        { icon: ShieldCheck, label: tr("Badges assurances", "Versicherungs-Badges"), sub: tr("ASCA, RME et reconnaissance suisse.", "ASCA, EMR und Schweizer Anerkennung.") },
      ],
    },
    {
      id: "agenda",
      kicker: tr("Étape 03 — Votre agenda", "Schritt 03 — Ihr Kalender"),
      title: tr("Prise de rendez-vous intégrée, 24 h / 24.", "Integrierte Terminbuchung, rund um die Uhr."),
      highlight: [
        { icon: CalendarDays, label: tr("Agenda synchronisé", "Synchronisierter Kalender"), sub: tr("Google, Outlook, iCal.", "Google, Outlook, iCal.") },
        { icon: Check, label: tr("Rappels automatiques", "Automatische Erinnerungen"), sub: tr("Moins d'oublis, plus de séances.", "Weniger Absagen, mehr Sitzungen.") },
      ],
    },
    {
      id: "voices",
      kicker: tr("Étape 04 — Voix d'experts", "Schritt 04 — Experten­stimmen"),
      title: tr("Publiez vos articles, gagnez en visibilité.", "Publizieren Sie Ihre Artikel, gewinnen Sie Sichtbarkeit."),
      highlight: [
        { icon: PenLine, label: tr("Articles d'auteur", "Autorenartikel"), sub: tr("Partagez votre approche.", "Teilen Sie Ihren Ansatz.") },
        { icon: Star, label: tr("Avis vérifiés", "Verifizierte Bewertungen"), sub: tr("La confiance de vos patients, visible.", "Vertrauen sichtbar gemacht.") },
      ],
    },
    {
      id: "signup",
      kicker: tr("Étape 05 — Rejoignez-nous", "Schritt 05 — Machen Sie mit"),
      title: tr("Réservez votre place fondatrice.", "Sichern Sie sich Ihren Gründerplatz."),
    },
  ], [i18n.language]);

  const total = slides.length;
  const current = slides[index];
  const isLast = index === total - 1;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      const ts = localStorage.getItem(PERSIST_KEY);
      if (ts) {
        const days = (Date.now() - Number(ts)) / (1000 * 60 * 60 * 24);
        if (days < RESHOW_DAYS) return;
      }
    } catch {}
    const id = window.setTimeout(() => {
      setOpen(true);
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch {}
    }, DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOpen = () => { setOpen(true); setIndex(0); };
    window.addEventListener("open-waitlist", onOpen);
    return () => window.removeEventListener("open-waitlist", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight" && !isLast) next();
      if (e.key === "ArrowLeft" && index > 0) prev();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, index, isLast]);

  function close() {
    setOpen(false);
    window.setTimeout(() => {
      setIndex(0); setEmail(""); setAccepted(false); setError(null); setSuccess(false);
    }, 300);
  }

  function next() { setIndex((i) => Math.min(total - 1, i + 1)); }
  function prev() { setIndex((i) => Math.max(0, i - 1)); }

  function onBackdropClick(e: React.MouseEvent) {
    if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) close();
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(tr("Email invalide.", "Ungültige E-Mail."));
      return;
    }
    if (!accepted) {
      setError(tr("Veuillez accepter la politique de confidentialité.", "Bitte akzeptieren Sie die Datenschutzerklärung."));
      return;
    }
    setLoading(true);
    const cleanEmail = parsed.data;
    const { error: insertError } = await supabase
      .from("waiting_list")
      .insert({
        email: cleanEmail,
        source: "onboarding_modal",
        accepted_terms: true,
      } as never);
    setLoading(false);
    if (insertError && !(insertError.code === "23505" || /duplicate|unique/i.test(insertError.message))) {
      setError(tr("Une erreur est survenue. Veuillez réessayer.", "Ein Fehler ist aufgetreten. Bitte erneut versuchen."));
      return;
    }
    try { localStorage.setItem(PERSIST_KEY, String(Date.now())); } catch {}
    setSuccess(true);
    void sendEmails({
      data: { email: cleanEmail, source: "onboarding_modal" },
    }).catch((err) => console.error("[onboarding] email send failed", err));
  }

  if (!open) return null;

  return (
    <div
      onMouseDown={onBackdropClick}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[420px] overflow-hidden rounded-3xl border border-white/5 bg-[#1a0a2e] shadow-2xl flex flex-col"
        style={{ maxHeight: "min(92vh, 720px)" }}
      >
        {/* Progress + close */}
        <div className="absolute top-0 left-0 w-full z-20 p-5 flex items-center justify-between gap-4">
          <div className="flex gap-1.5 w-full max-w-[220px]" aria-hidden>
            {slides.map((_, i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full transition-all duration-500"
                style={{ background: i <= index ? "#a855f7" : "rgba(255,255,255,0.10)" }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={tr("Fermer", "Schliessen")}
            className="text-white/40 hover:text-white transition-colors -mr-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Editorial top panel */}
        <div className="relative h-[220px] w-full overflow-hidden bg-gradient-to-br from-[#2e1065] to-[#1a0a2e] flex items-center justify-center shrink-0">
          {/* Radial purple glow */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: "radial-gradient(circle at 50% 55%, rgba(168,85,247,0.55) 0%, rgba(168,85,247,0.18) 30%, transparent 65%)" }}
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-40"
            style={{ background: "radial-gradient(circle at 50% 55%, rgba(92,200,250,0.25) 0%, transparent 55%)" }}
          />

          <motion.div
            key={current.id + "-lotus"}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative flex flex-col items-center"
          >
            <div className="w-20 h-20 mb-3 relative">
              <div
                aria-hidden
                className="absolute inset-[-30%] rounded-full blur-2xl"
                style={{ background: "radial-gradient(circle, rgba(168,85,247,0.6) 0%, transparent 70%)" }}
              />
              <img
                src={lotusUrl}
                alt=""
                className="relative w-full h-full object-contain drop-shadow-[0_0_20px_rgba(168,85,247,0.6)]"
              />
            </div>
            <span className="text-[10px] tracking-[0.3em] uppercase text-white/50 font-medium">Holiswiss</span>
          </motion.div>
        </div>

        {/* Content panel */}
        <div className="flex-1 p-7 flex flex-col overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
              className="flex flex-col flex-1"
            >
              <div className="mb-2 text-[#5cc8fa] font-semibold text-xs tracking-wider uppercase">
                {current.kicker}
              </div>
              <h2
                id="onboarding-title"
                className="text-[26px] leading-tight mb-5 italic text-white"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                {current.title}
              </h2>

              {!success && current.bullets && (
                <div className="space-y-4 mb-auto">
                  {current.bullets.map((b, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 mt-1 flex-shrink-0 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#a855f7] shadow-[0_0_8px_#a855f7]" />
                      </div>
                      <p className="text-sm text-white/75 leading-relaxed">{b}</p>
                    </div>
                  ))}
                </div>
              )}

              {!success && current.highlight && (
                <div className="space-y-3 mb-auto">
                  {current.highlight.map((h, i) => {
                    const Icon = h.icon;
                    return (
                      <div key={i} className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#a855f7]/15 text-[#c084fc]">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">{h.label}</div>
                          <div className="text-xs text-white/60 leading-relaxed">{h.sub}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {isLast && !success && (
                <form onSubmit={submitEmail} className="mb-auto space-y-3" noValidate>
                  <label className="block text-xs uppercase tracking-wider text-white/50 font-medium">
                    {tr("Votre email professionnel", "Ihre berufliche E-Mail")}
                  </label>
                  <input
                    type="email"
                    autoFocus
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
                    placeholder="prenom.nom@cabinet.ch"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#a855f7] focus:ring-2 focus:ring-[#a855f7]/30 transition"
                    aria-invalid={!!error}
                  />
                  <label className="flex items-start gap-2 text-xs text-white/60 leading-relaxed cursor-pointer">
                    <input
                      type="checkbox"
                      checked={accepted}
                      onChange={(e) => setAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 accent-[#a855f7]"
                    />
                    <span>
                      {tr(
                        "J'accepte la politique de confidentialité et de recevoir des informations Holiswiss.",
                        "Ich akzeptiere die Datenschutzerklärung und den Erhalt von Holiswiss-Informationen."
                      )}
                    </span>
                  </label>
                  {error && (
                    <p role="alert" className="text-xs text-red-300">{error}</p>
                  )}
                </form>
              )}

              {success && (
                <div className="mb-auto flex flex-col items-center text-center py-4">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-400/40">
                    <Check className="h-7 w-7 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {tr("Bienvenue parmi les fondateurs.", "Willkommen bei den Gründern.")}
                  </h3>
                  <p className="text-sm text-white/70 leading-relaxed max-w-[280px]">
                    {tr(
                      "Un email de confirmation vient de vous être envoyé. À très vite.",
                      "Eine Bestätigungs-E-Mail wurde soeben versendet. Bis bald."
                    )}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 flex flex-col gap-3">
                {!success && !isLast && (
                  <>
                    <button
                      type="button"
                      onClick={next}
                      className="w-full py-3.5 bg-white text-[#0a0514] font-semibold rounded-xl text-sm transition-transform active:scale-[0.98] hover:scale-[1.01] shadow-[0_10px_30px_rgba(168,85,247,0.25)] inline-flex items-center justify-center gap-2"
                    >
                      {tr("Suivant", "Weiter")} <ArrowRight className="w-4 h-4" />
                    </button>
                    <div className="flex items-center justify-between">
                      {index > 0 ? (
                        <button
                          type="button"
                          onClick={prev}
                          className="text-white/50 text-xs font-medium hover:text-white transition-colors inline-flex items-center gap-1"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" /> {tr("Précédent", "Zurück")}
                        </button>
                      ) : <span />}
                      <button
                        type="button"
                        onClick={() => setIndex(total - 1)}
                        className="text-white/40 text-xs font-medium hover:text-white transition-colors"
                      >
                        {tr("Passer l'introduction", "Einführung überspringen")}
                      </button>
                    </div>
                  </>
                )}
                {!success && isLast && (
                  <>
                    <button
                      type="submit"
                      onClick={submitEmail}
                      disabled={loading}
                      className="w-full py-3.5 bg-white text-[#0a0514] font-semibold rounded-xl text-sm transition-transform active:scale-[0.98] hover:scale-[1.01] shadow-[0_10px_30px_rgba(168,85,247,0.25)] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                    >
                      {loading ? tr("Envoi…", "Senden…") : tr("Rejoindre la liste", "Der Liste beitreten")}
                    </button>
                    <button
                      type="button"
                      onClick={close}
                      className="w-full py-2 text-white/40 text-xs font-medium hover:text-white transition-colors"
                    >
                      {tr("Découvrir sans compte", "Ohne Konto entdecken")}
                    </button>
                  </>
                )}
                {success && (
                  <button
                    type="button"
                    onClick={close}
                    className="w-full py-3.5 bg-white/10 text-white font-semibold rounded-xl text-sm hover:bg-white/15 transition-colors border border-white/10"
                  >
                    {tr("Fermer", "Schliessen")}
                  </button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

export default OnboardingModal;