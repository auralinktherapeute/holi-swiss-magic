import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Instagram, Linkedin, Music2, Clock, CheckCircle2, Pencil, XCircle, Sparkles } from "lucide-react";
import { listMarketingProposals, setMarketingProposalStatus } from "@/lib/marketing.functions";

export const Route = createFileRoute("/admin/marketing")({
  component: MarketingPage,
});

type Proposal = {
  id: string;
  proposal_date: string;
  network: string;
  pillar: string | null;
  angle: string | null;
  format: string | null;
  caption: string;
  hashtags: string | null;
  visual_brief: string | null;
  visual_prompt: string | null;
  suggested_time: string | null;
  lang: string;
  status: string;
  correction_note: string | null;
  created_at: string;
};

const NETWORK_META: Record<string, { label: string; icon: typeof Instagram }> = {
  instagram: { label: "Instagram", icon: Instagram },
  linkedin: { label: "LinkedIn", icon: Linkedin },
  tiktok: { label: "TikTok", icon: Music2 },
};
const PILLAR_LABEL: Record<string, string> = {
  preuve_sociale: "Preuve sociale",
  educatif: "Éducatif",
  demo_outil: "Démo d'outil",
  marque: "Marque",
};
const STATUS_META: Record<string, { label: string; cls: string }> = {
  en_attente_validation: { label: "En attente de validation", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  valide: { label: "Validé", cls: "bg-[#22d3ee]/15 text-[#22d3ee] border-[#22d3ee]/30" },
  correction_demandee: { label: "Correction demandée", cls: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  refuse: { label: "Refusé", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  publie: { label: "Publié", cls: "bg-green-500/15 text-green-300 border-green-500/30" },
};

function MarketingPage() {
  const fetchProposals = useServerFn(listMarketingProposals);
  const setStatus = useServerFn(setMarketingProposalStatus);
  const qc = useQueryClient();
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["marketing-proposals"],
    queryFn: () => fetchProposals(),
  });
  const rows = (data?.rows ?? []) as Proposal[];

  const act = async (id: string, status: "valide" | "correction_demandee" | "refuse", n?: string) => {
    try {
      await setStatus({ data: { id, status, note: n } });
      toast.success(
        status === "valide" ? "Proposition validée ✓" : status === "refuse" ? "Proposition refusée" : "Correction demandée",
      );
      setCorrecting(null);
      setNote("");
      qc.invalidateQueries({ queryKey: ["marketing-proposals"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white sm:text-3xl">
          <Sparkles className="h-6 w-6 text-[#b86ef9]" /> Marketing — Réseaux sociaux
        </h1>
        <p className="mt-2 text-sm text-[#d4c4e0]">
          Propositions de publications produites par l'équipe d'agents pour recruter des thérapeutes suisses.
          <strong className="text-white"> Rien n'est publié sans votre validation.</strong>
        </p>
      </header>

      {isLoading && <div className="py-16 text-center text-white/50">Chargement…</div>}
      {!isLoading && rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-white/60">
          Aucune proposition pour le moment. Lancez la commande <code className="text-[#b86ef9]">/marketing-daily</code> pour en générer une.
        </div>
      )}

      <div className="space-y-5">
        {rows.map((p) => {
          const net = NETWORK_META[p.network] ?? { label: p.network, icon: Sparkles };
          const NetIcon = net.icon;
          const st = STATUS_META[p.status] ?? { label: p.status, cls: "bg-white/10 text-white/70 border-white/20" };
          const pending = p.status === "en_attente_validation" || p.status === "correction_demandee";
          return (
            <article key={p.id} className="rounded-2xl border border-[rgba(184,110,249,0.25)] bg-[#1a0a2e] p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <NetIcon className="h-4 w-4 text-[#b86ef9]" />
                  <span className="font-semibold text-white">{net.label}</span>
                  {p.format && <span className="text-white/50">· {p.format}</span>}
                  {p.pillar && (
                    <span className="rounded-full bg-[rgba(184,110,249,0.15)] px-2 py-0.5 text-xs text-[#d4a8ff]">
                      {PILLAR_LABEL[p.pillar] ?? p.pillar}
                    </span>
                  )}
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${st.cls}`}>{st.label}</span>
              </div>

              {p.angle && <p className="mb-3 text-sm italic text-white/70">🧭 {p.angle}</p>}

              <div className="rounded-xl border border-white/10 bg-[#0f0a1e] p-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">{p.caption}</p>
                {p.hashtags && <p className="mt-3 text-xs text-[#5cc8fa]">{p.hashtags}</p>}
              </div>

              {p.visual_brief && (
                <div className="mt-3 rounded-xl border border-white/10 bg-[#0f0a1e] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/50">🎨 Brief visuel</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{p.visual_brief}</p>
                  {p.visual_prompt && <p className="mt-2 text-xs text-white/40">Prompt : {p.visual_prompt}</p>}
                </div>
              )}

              <div className="mt-3 flex items-center gap-3 text-xs text-white/45">
                {p.suggested_time && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Suggéré : {p.suggested_time}
                  </span>
                )}
                <span>· {p.lang.toUpperCase()}</span>
              </div>

              {p.correction_note && (
                <p className="mt-3 rounded-lg border border-purple-500/30 bg-purple-500/10 p-2 text-xs text-purple-200">
                  Correction demandée : {p.correction_note}
                </p>
              )}

              {pending && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  {correcting === p.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        placeholder="Que faut-il changer ? (ex. « trop commercial, refais l'accroche »)"
                        className="w-full rounded-lg border border-[rgba(184,110,249,0.3)] bg-[#0f0a1e] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#b86ef9] focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => act(p.id, "correction_demandee", note)}
                          disabled={note.trim().length < 3}
                          className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                        >
                          Envoyer la correction
                        </button>
                        <button onClick={() => { setCorrecting(null); setNote(""); }} className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/70">
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => act(p.id, "valide")}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#b86ef9] to-[#22d3ee] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Valider (OK)
                      </button>
                      <button
                        onClick={() => setCorrecting(p.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#b86ef9] px-4 py-2 text-sm font-semibold text-[#b86ef9] hover:bg-[rgba(184,110,249,0.1)]"
                      >
                        <Pencil className="h-4 w-4" /> Demander une correction
                      </button>
                      <button
                        onClick={() => act(p.id, "refuse")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/40 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10"
                      >
                        <XCircle className="h-4 w-4" /> Refuser
                      </button>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
