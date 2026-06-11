import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, lazy, Suspense, useEffect } from "react";
import { motion } from "framer-motion";
import { holiswissPublic as supabase } from "@/integrations/supabase/holiswiss-public";
import {
  MapPin, Star, BadgeCheck, Globe, Heart, Share2, Navigation2,
  Clock, MessageSquare, Shield, ChevronUp, ExternalLink, Zap,
} from "lucide-react";
import { BookingWidget } from "@/components/booking/BookingWidget";

const TherapistMiniMap = lazy(() =>
  import("@/components/map/TherapistMap").then((m) => ({ default: m.TherapistMap }))
);

export const Route = createFileRoute("/$lang/therapeute/$slug")({ component: Page });

type ServiceEntry = { name: string; duration?: number; price?: number; format?: string; color?: string };
type AccreditationEntry = { org: string; number?: string };

const FADE_UP = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

function StarRow({ rating, size = 4 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-${size} w-${size} ${n <= rating ? "fill-amber-400 text-amber-400" : "text-[rgba(255,255,255,0.2)]"}`}
        />
      ))}
    </span>
  );
}

function Page() {
  const { slug, lang } = useParams({ from: "/$lang/therapeute/$slug" });
  const [phoneVisible, setPhoneVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const handler = () => setShowTop(window.scrollY > 400);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const { data: th, isLoading } = useQuery({
    queryKey: ["therapist", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapists")
        .select("*")
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle() as any;
      if (error) throw error;
      return data;
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ["reviews", th?.id],
    enabled: !!th?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("id,rating,comment,therapist_reply,replied_at,created_at")
        .eq("therapist_id", th!.id)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: th ? `${th.first_name} ${th.last_name}` : "", url });
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f0a1e] px-4 py-12">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-64 animate-pulse rounded-3xl bg-[#1a1035]" />
          <div className="grid grid-cols-[1fr_340px] gap-6">
            <div className="h-96 animate-pulse rounded-2xl bg-[#1a1035]" />
            <div className="h-96 animate-pulse rounded-2xl bg-[#1a1035]" />
          </div>
        </div>
      </div>
    );
  }

  if (!th) {
    return (
      <div className="min-h-screen bg-[#0f0a1e] flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-white mb-4">Profil introuvable</p>
          <Link to="/$lang/therapeutes" params={{ lang }} className="text-[#b86ef9] underline">
            ← Retour à l'annuaire
          </Link>
        </div>
      </div>
    );
  }

  const fullName = `${th.first_name} ${th.last_name}`.trim();
  const services: ServiceEntry[] = Array.isArray(th.services) ? th.services : [];
  const accreditations: AccreditationEntry[] = Array.isArray(th.accreditations) ? th.accreditations : [];
  const specialties: string[] = Array.isArray(th.specialties) ? th.specialties : [];
  const avg = reviews?.length
    ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  // Rating distribution
  const dist = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: reviews?.filter((r: any) => r.rating === n).length ?? 0,
  }));

  return (
    <div className="min-h-screen bg-[#0f0a1e] pb-20">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden">
        {th.cover_image_url ? (
          <>
            <img src={th.cover_image_url} alt="" className="h-64 w-full object-cover opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0f0a1e]/60 to-[#0f0a1e]" />
          </>
        ) : (
          <div
            className="h-64 w-full"
            style={{ background: "radial-gradient(ellipse at top, #3d1a5c 0%, #1a1035 50%, #0f0a1e 100%)" }}
          />
        )}

        <div className="absolute inset-x-0 bottom-0 px-4 pb-8 pt-4 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-col sm:flex-row gap-5 items-end sm:items-center">
              {/* Photo */}
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="relative shrink-0"
              >
                <div
                  className="h-28 w-28 rounded-full overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg,#b86ef9,#5cc8fa)",
                    padding: 3,
                    boxShadow: "0 0 30px rgba(184,110,249,0.5)",
                  }}
                >
                  <div className="h-full w-full rounded-full overflow-hidden bg-[#1a1035]">
                    {th.photo_url ? (
                      <img src={th.photo_url} alt={fullName} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-[#b86ef9]">
                        {fullName[0]}
                      </div>
                    )}
                  </div>
                </div>
                {th.is_premium && (
                  <span className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-sm shadow-lg" title="Premium">⚡</span>
                )}
                {!th.is_premium && th.verified && (
                  <span className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#b86ef9] shadow-lg" title="Pro vérifié">
                    <BadgeCheck className="h-4 w-4 text-white" />
                  </span>
                )}
              </motion.div>

              {/* Infos */}
              <motion.div
                variants={FADE_UP} initial="hidden" animate="show"
                transition={{ delay: 0.1, duration: 0.4 }}
                className="flex-1 min-w-0"
              >
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">{fullName}</h1>
                  {th.verified && (
                    <span className="flex items-center gap-1 rounded-full bg-[rgba(184,110,249,0.15)] border border-[rgba(184,110,249,0.3)] px-2.5 py-0.5 text-xs font-medium text-[#b86ef9]">
                      <BadgeCheck className="h-3 w-3" /> Vérifié
                    </span>
                  )}
                </div>

                {/* Titre + ville */}
                <p className="text-[#b86ef9] font-medium mb-2">
                  {th.title}{th.city ? ` · ${th.city}${th.canton ? ` (${th.canton})` : ""}` : ""}
                </p>

                {/* Méta row */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[rgba(255,255,255,0.5)]">
                  {avg && (
                    <span className="flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-white font-semibold">{avg}</span>
                      <span>({reviews?.length} avis)</span>
                    </span>
                  )}
                  {th.years_experience && (
                    <span className="flex items-center gap-1.5">
                      🏆 {th.years_experience} ans d'expérience
                    </span>
                  )}
                  {th.website && (
                    <a href={th.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-[#5cc8fa] transition">
                      <Globe className="h-3.5 w-3.5" /> Site web
                    </a>
                  )}
                  {th.price_min && (
                    <span className="flex items-center gap-1 text-[rgba(255,255,255,0.7)]">
                      💶 {th.price_min}{th.price_max ? `–${th.price_max}` : ""} {th.currency ?? "CHF"} / séance
                    </span>
                  )}
                </div>

                {/* Chips spécialités */}
                {specialties.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {specialties.map((s) => (
                      <span key={s} className="rounded-full bg-[rgba(184,110,249,0.1)] border border-[rgba(184,110,249,0.25)] px-3 py-1 text-xs text-[rgba(255,255,255,0.7)]">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>

              {/* Actions */}
              <motion.div
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="flex gap-2 shrink-0"
              >
                <button onClick={share} className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(184,110,249,0.3)] bg-[rgba(184,110,249,0.08)] text-[#b86ef9] hover:bg-[rgba(184,110,249,0.15)] transition" title={copied ? "Copié !" : "Partager"}>
                  {copied ? <span className="text-[10px] font-bold text-[#5cc8fa]">✓</span> : <Share2 className="h-4 w-4" />}
                </button>
                {th.city && (
                  <a
                    href={`https://www.google.com/maps/search/${encodeURIComponent(th.city + " " + (th.canton ?? "") + " Suisse")}`}
                    target="_blank" rel="noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(184,110,249,0.3)] bg-[rgba(184,110,249,0.08)] text-[#b86ef9] hover:bg-[rgba(184,110,249,0.15)] transition" title="Itinéraire"
                  >
                    <Navigation2 className="h-4 w-4" />
                  </a>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* ── LAYOUT PRINCIPAL ── */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 mt-6">
        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_340px] gap-6">

          {/* ── COLONNE GAUCHE ── */}
          <div className="space-y-6 min-w-0">

            {/* À propos */}
            {th.bio && (
              <motion.section variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="rounded-2xl border border-[rgba(184,110,249,0.18)] bg-[#1a0a2e] p-6"
              >
                <h2 className="mb-4 text-lg font-bold text-white">À propos</h2>
                <p className="whitespace-pre-line text-[rgba(255,255,255,0.72)] leading-relaxed text-sm">{th.bio}</p>
              </motion.section>
            )}

            {/* Services / tarifs */}
            {services.length > 0 && (
              <motion.section variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="rounded-2xl border border-[rgba(184,110,249,0.18)] bg-[#1a0a2e] p-6"
              >
                <h2 className="mb-4 text-lg font-bold text-white">Tarifs & services</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[rgba(184,110,249,0.15)]">
                        {["Service", "Durée", "Tarif", "Format"].map((h) => (
                          <th key={h} className="pb-3 text-left text-xs font-medium text-[rgba(255,255,255,0.4)] uppercase tracking-wide pr-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((s, i) => (
                        <tr key={i} className="border-b border-[rgba(184,110,249,0.08)] hover:bg-[rgba(184,110,249,0.04)] transition">
                          <td className="py-3 pr-4 font-medium text-white">{s.name}</td>
                          <td className="py-3 pr-4 text-[rgba(255,255,255,0.55)]">{s.duration ? `${s.duration} min` : "—"}</td>
                          <td className="py-3 pr-4 text-[#5cc8fa] font-semibold">{s.price ? `${s.price} CHF` : "—"}</td>
                          <td className="py-3 pr-4 text-[rgba(255,255,255,0.55)] capitalize">{s.format ?? "présentiel"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.section>
            )}

            {/* Accréditations */}
            {accreditations.length > 0 && (
              <motion.section variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="rounded-2xl border border-[rgba(184,110,249,0.18)] bg-[#1a0a2e] p-6"
              >
                <h2 className="mb-4 text-lg font-bold text-white">Diplômes & certifications</h2>
                <div className="flex flex-wrap gap-2">
                  {accreditations.map((a) => (
                    <span key={a.org} className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-300">
                      <BadgeCheck className="h-4 w-4" /> {a.org} {a.number ? `· ${a.number}` : ""}
                    </span>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Avis */}
            {(reviews?.length ?? 0) > 0 && (
              <motion.section variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="rounded-2xl border border-[rgba(184,110,249,0.18)] bg-[#1a0a2e] p-6"
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-white">Avis clients</h2>
                  {avg && (
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-bold text-white">{avg}</span>
                      <div>
                        <StarRow rating={Math.round(Number(avg))} size={4} />
                        <p className="text-xs text-[rgba(255,255,255,0.45)] mt-0.5">{reviews!.length} avis</p>
                      </div>
                    </div>
                  )}
                </div>
                {/* Distribution */}
                <div className="mb-5 space-y-1.5">
                  {dist.map(({ n, count }) => (
                    <div key={n} className="flex items-center gap-2 text-xs">
                      <span className="w-3 text-right text-[rgba(255,255,255,0.5)]">{n}</span>
                      <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />
                      <div className="flex-1 h-1.5 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] transition-all"
                          style={{ width: reviews!.length ? `${(count / reviews!.length) * 100}%` : "0%" }}
                        />
                      </div>
                      <span className="w-6 text-[rgba(255,255,255,0.4)]">{count}</span>
                    </div>
                  ))}
                </div>
                {/* Cards avis */}
                <div className="space-y-4">
                  {reviews!.map((r: any) => (
                    <div key={r.id} className="rounded-xl border border-[rgba(184,110,249,0.12)] bg-[rgba(184,110,249,0.04)] p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#b86ef9] to-[#5cc8fa] flex items-center justify-center text-xs font-bold text-white">
                            {String(r.patient_id ?? "?")[0].toUpperCase()}
                          </div>
                          <StarRow rating={r.rating} size={3} />
                        </div>
                        <span className="text-xs text-[rgba(255,255,255,0.35)]">
                          {new Date(r.created_at).toLocaleDateString("fr-CH", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      {r.comment && <p className="text-sm text-[rgba(255,255,255,0.72)] leading-relaxed">{r.comment}</p>}
                      {r.therapist_reply && (
                        <div className="mt-3 rounded-lg border-l-2 border-[#b86ef9] bg-[rgba(184,110,249,0.06)] px-4 py-3">
                          <p className="text-xs font-semibold text-[#b86ef9] mb-1">💬 Réponse du thérapeute</p>
                          <p className="text-sm italic text-[rgba(255,255,255,0.6)]">{r.therapist_reply}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Mini carte */}
            {th.latitude && th.longitude && (
              <motion.section variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="rounded-2xl border border-[rgba(184,110,249,0.18)] bg-[#1a0a2e] overflow-hidden"
              >
                <div className="p-4 border-b border-[rgba(184,110,249,0.12)]">
                  <h2 className="text-lg font-bold text-white">Localisation</h2>
                  <p className="text-sm text-[rgba(255,255,255,0.45)] mt-0.5">
                    <MapPin className="inline h-3.5 w-3.5 mr-1" />{th.city}{th.canton ? ` (${th.canton})` : ""}, Suisse
                  </p>
                </div>
                <div style={{ height: 220 }}>
                  <Suspense fallback={<div className="h-full bg-[#1a1035] animate-pulse" />}>
                    <TherapistMiniMap
                      therapists={[th]}
                      selectedId={th.id}
                      onSelect={() => {}}
                      lang={lang}
                    />
                  </Suspense>
                </div>
              </motion.section>
            )}
          </div>

          {/* ── SIDEBAR DROITE ── */}
          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">

            {/* Widget réservation */}
            <div className="rounded-2xl border border-[rgba(184,110,249,0.25)] bg-[rgba(13,7,30,0.85)] p-5 backdrop-blur">
              <BookingWidget therapistId={th.id} />
            </div>

            {/* Widget contact */}
            <div className="rounded-2xl border border-[rgba(184,110,249,0.18)] bg-[rgba(13,7,30,0.85)] p-5 backdrop-blur space-y-3">
              <h3 className="font-semibold text-white text-sm">Contact</h3>
              {th.phone && (
                <div>
                  <p className="text-xs text-[rgba(255,255,255,0.4)] mb-1 flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Numéro protégé
                  </p>
                  {phoneVisible ? (
                    <p className="text-sm font-semibold text-[#5cc8fa]">{th.phone}</p>
                  ) : (
                    <button
                      onClick={() => setPhoneVisible(true)}
                      className="text-sm font-semibold text-[#b86ef9] hover:text-white transition"
                    >
                      📞 Afficher le numéro
                    </button>
                  )}
                </div>
              )}
              {th.email && (
                <a href={`mailto:${th.email}`} className="flex items-center gap-2 text-sm text-[rgba(255,255,255,0.6)] hover:text-[#5cc8fa] transition">
                  ✉️ Envoyer un message
                </a>
              )}
            </div>

            {/* Widget localisation */}
            {(th.city || th.canton) && (
              <div className="rounded-2xl border border-[rgba(184,110,249,0.18)] bg-[rgba(13,7,30,0.85)] p-5 backdrop-blur">
                <p className="text-xs text-[rgba(255,255,255,0.4)] mb-1">Zone d'intervention</p>
                <p className="text-sm font-medium text-white flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-[#b86ef9]" />
                  {th.city}{th.canton ? ` · ${th.canton}` : ""}{th.postal_code ? `, ${th.postal_code}` : ""}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Disclaimer ── */}
      <p className="mx-auto mt-12 max-w-2xl px-4 text-center text-[13px] italic text-[rgba(255,255,255,0.3)] leading-relaxed">
        Cette prestation de bien-être ne remplace en aucun cas une consultation médicale.
        En cas de problème de santé, consultez un médecin.
      </p>

      {/* ── Scroll to top ── */}
      {showTop && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-[#b86ef9] text-white shadow-[0_4px_20px_rgba(184,110,249,0.4)] hover:bg-[#a055e8] transition"
        >
          <ChevronUp className="h-5 w-5" />
        </motion.button>
      )}
    </div>
  );
}
