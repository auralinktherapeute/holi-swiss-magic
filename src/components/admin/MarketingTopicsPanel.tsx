import { useState } from "react";
import { toast } from "sonner";
import { Instagram, Linkedin, Music2, Sparkles, Trash2 } from "lucide-react";

/**
 * Panneau « Sujets » de /admin/marketing.
 *
 * Volontairement SANS accès aux données : la soumission et l'abandon sont
 * injectés par la page appelante. C'est ce qui permet de l'inspecter dans
 * `/preview/marketing-topics` sans session admin — la route de preview lui
 * passe des données de démonstration et des gestionnaires inertes.
 */

export type MarketingTopic = {
  id: string;
  subject: string;
  target_date: string;
  network: string | null;
  format: string | null;
  note: string | null;
  status: string;
  reject_reason: string | null;
  created_at: string;
};

const NETWORK_LABEL: Record<string, { label: string; icon: typeof Instagram }> = {
  instagram: { label: "Instagram", icon: Instagram },
  linkedin: { label: "LinkedIn", icon: Linkedin },
  tiktok: { label: "TikTok", icon: Music2 },
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  en_attente: { label: "En file", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  traite: { label: "Traité", cls: "bg-[#22d3ee]/15 text-[#22d3ee] border-[#22d3ee]/30" },
  abandonne: { label: "Abandonné", cls: "bg-white/10 text-white/50 border-white/20" },
};

export type SubmitTopicInput = {
  subject: string;
  network?: string;
  format?: string;
  target_date?: string;
};

export function MarketingTopicsPanel({
  topics,
  onSubmit,
  onAbandon,
}: {
  topics: MarketingTopic[];
  onSubmit: (input: SubmitTopicInput) => Promise<{ target_date: string }>;
  onAbandon: (id: string) => Promise<void>;
}) {
  const [subject, setSubject] = useState("");
  const [network, setNetwork] = useState("");
  const [format, setFormat] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (subject.trim().length < 10) {
      toast.error("Décrivez le sujet en une phrase au moins.");
      return;
    }
    setBusy(true);
    try {
      const res = await onSubmit({
        subject: subject.trim(),
        network: network || undefined,
        format: format || undefined,
        target_date: date || undefined,
      });
      toast.success(`Sujet en file pour le ${new Date(res.target_date).toLocaleDateString("fr-CH")}`);
      setSubject("");
      setNetwork("");
      setFormat("");
      setDate("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const drop = async (id: string) => {
    try {
      await onAbandon(id);
      toast.success("Sujet abandonné");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  const selectCls =
    "rounded-lg border border-white/15 bg-[#1a0a2e] px-3 py-2 text-sm text-white outline-none focus:border-[#b86ef9]";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[rgba(184,110,249,0.25)] bg-[#1a0a2e] p-5">
        <h2 className="text-base font-semibold text-white">Soumettre un sujet</h2>
        <p className="mt-1 text-sm text-[#d4c4e0]">
          Il sera produit <strong className="text-white">en supplément</strong> de la publication
          programmée du jour, jamais à sa place. Même filtre qualité que les autres : si l'angle
          n'atteint pas le seuil, l'agent proposera un angle de repli sur le même sujet.
        </p>

        <label htmlFor="topic-subject" className="sr-only">
          Sujet à soumettre
        </label>
        <textarea
          id="topic-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          rows={3}
          placeholder="Ex. : les 4 questions à poser avant une première séance"
          className="mt-4 w-full resize-y rounded-lg border border-white/15 bg-[#2d1b4e]/40 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-[#b86ef9]"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            className={selectCls}
            aria-label="Réseau"
          >
            <option value="">Réseau — au choix de l'agent</option>
            <option value="instagram">Instagram</option>
            <option value="linkedin">LinkedIn</option>
            <option value="tiktok">TikTok</option>
          </select>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className={selectCls}
            aria-label="Format"
          >
            <option value="">Format — au choix de l'agent</option>
            <option value="carrousel">Carrousel</option>
            <option value="reel">Reel</option>
            <option value="post">Post</option>
            <option value="story">Story</option>
          </select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={selectCls}
            aria-label="Date cible (par défaut demain)"
          />
          <button
            onClick={send}
            disabled={busy}
            className="ml-auto rounded-lg bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Envoi…" : "Mettre en file"}
          </button>
        </div>
        <p className="mt-2 text-xs text-white/40">
          Sans date, le sujet est daté de demain. Rien n'est rédigé maintenant : la production a lieu
          au prochain cycle quotidien.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-white">File des sujets</h2>
        {topics.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/60">
            Aucun sujet soumis. Le cycle quotidien produira uniquement la publication programmée.
          </div>
        ) : (
          <ul className="space-y-3">
            {topics.map((t) => {
              const st = STATUS_META[t.status] ?? {
                label: t.status,
                cls: "bg-white/10 text-white/70 border-white/20",
              };
              const net = t.network ? NETWORK_LABEL[t.network] : undefined;
              const NetIcon = net?.icon ?? Sparkles;
              return (
                <li key={t.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white">{t.subject}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-white/45">
                        {t.network && <NetIcon className="h-3 w-3" />}
                        <span>Pour le {new Date(t.target_date).toLocaleDateString("fr-CH")}</span>
                        {net && <span>· {net.label}</span>}
                        {t.format && <span>· {t.format}</span>}
                      </p>
                      {t.reject_reason && (
                        <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                          <strong>Angle de repli proposé :</strong> {t.reject_reason}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] ${st.cls}`}>
                        {st.label}
                      </span>
                      {t.status === "en_attente" && (
                        <button
                          onClick={() => drop(t.id)}
                          title="Abandonner ce sujet"
                          aria-label={`Abandonner le sujet : ${t.subject}`}
                          className="rounded-lg border border-white/15 p-1.5 text-white/50 transition hover:border-red-500/40 hover:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
