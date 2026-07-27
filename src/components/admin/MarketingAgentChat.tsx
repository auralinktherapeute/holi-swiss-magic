import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send, Loader2, Plus, Trash2, Bookmark, MessageSquare } from "lucide-react";
import {
  askMarketingAgent,
  listAgentThreads,
  getAgentThread,
  deleteAgentThread,
  saveAnswerAsProposal,
} from "@/lib/marketing-agent.functions";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  skills_used: string[] | null;
  created_at: string;
};
type Thread = { id: string; title: string; updated_at: string };

/** Rendu markdown minimal, sans HTML injecté : titres, listes, gras, code. */
function Markdown({ text }: { text: string }) {
  const inline = (s: string, key: string) => {
    const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
    return parts.map((p, i) => {
      if (p.startsWith("**") && p.endsWith("**"))
        return <strong key={`${key}-${i}`} className="text-white">{p.slice(2, -2)}</strong>;
      if (p.startsWith("`") && p.endsWith("`"))
        return (
          <code key={`${key}-${i}`} className="rounded bg-black/40 px-1 py-0.5 text-[0.85em] text-[#5cc8fa]">
            {p.slice(1, -1)}
          </code>
        );
      return <span key={`${key}-${i}`}>{p}</span>;
    });
  };

  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (k: string) => {
    if (!list.length) return;
    blocks.push(
      <ul key={`ul-${k}`} className="my-2 list-disc space-y-1 pl-5 marker:text-[#b86ef9]">
        {list.map((li, i) => <li key={i}>{inline(li, `${k}-${i}`)}</li>)}
      </ul>,
    );
    list = [];
  };

  text.split("\n").forEach((raw, i) => {
    const line = raw.trimEnd();
    const k = String(i);
    if (/^\s*[-*]\s+/.test(line)) { list.push(line.replace(/^\s*[-*]\s+/, "")); return; }
    flush(k);
    if (!line.trim()) return;
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      blocks.push(
        <p key={k} className={lvl <= 2 ? "mt-4 mb-1 text-base font-bold text-white" : "mt-3 mb-1 text-sm font-semibold text-[#e9ddf7]"}>
          {inline(h[2], k)}
        </p>,
      );
      return;
    }
    blocks.push(<p key={k} className="my-1.5 leading-relaxed">{inline(line, k)}</p>);
  });
  flush("end");

  return <div className="text-sm text-[#d4c4e0]">{blocks}</div>;
}

const EXAMPLES = [
  "Propose-moi le post LinkedIn de demain",
  "Quels cantons prospecter en priorité ?",
  "Écris un email de prospection pour une naturopathe à Zurich",
  "Pourquoi on n'a pas de trafic allemand ?",
];

export function MarketingAgentChat() {
  const ask = useServerFn(askMarketingAgent);
  const fetchThreads = useServerFn(listAgentThreads);
  const fetchThread = useServerFn(getAgentThread);
  const removeThread = useServerFn(deleteAgentThread);
  const saveProposal = useServerFn(saveAnswerAsProposal);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const loadThreads = useCallback(async () => {
    try {
      const r = await fetchThreads();
      setThreads(r.threads);
    } catch { /* liste non critique */ }
  }, [fetchThreads]);

  useEffect(() => { void loadThreads(); }, [loadThreads]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  const openThread = async (id: string) => {
    setThreadId(id);
    try {
      const r = await fetchThread({ data: { threadId: id } });
      setMessages(r.messages as Msg[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible");
    }
  };

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    // Affichage optimiste de la question
    setMessages((m) => [
      ...m,
      { id: `tmp-${Date.now()}`, role: "user", content: q, skills_used: null, created_at: new Date().toISOString() },
    ]);
    try {
      const r = await ask({ data: { message: q, threadId } });
      if (!threadId) setThreadId(r.threadId);
      const fresh = await fetchThread({ data: { threadId: r.threadId } });
      setMessages(fresh.messages as Msg[]);
      void loadThreads();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "L'agent n'a pas répondu");
      setMessages((m) => m.filter((x) => !x.id.startsWith("tmp-")));
    } finally {
      setBusy(false);
    }
  };

  const toProposal = async (messageId: string) => {
    setSaving(messageId);
    try {
      await saveProposal({ data: { messageId } });
      toast.success("Proposition enregistrée — à valider dans l'onglet Propositions");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Conversion impossible");
    } finally {
      setSaving(null);
    }
  };

  const newThread = () => { setThreadId(null); setMessages([]); setInput(""); };

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      {/* Conversations */}
      <aside className="space-y-2">
        <button
          onClick={newThread}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] px-3 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> Nouvelle demande
        </button>
        <div className="max-h-[300px] space-y-1 overflow-y-auto lg:max-h-[520px]">
          {threads.map((t) => (
            <div
              key={t.id}
              className={`group flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs ${
                t.id === threadId
                  ? "border-[#b86ef9]/50 bg-[#b86ef9]/10 text-white"
                  : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20"
              }`}
            >
              <button onClick={() => openThread(t.id)} className="flex-1 truncate text-left" title={t.title}>
                {t.title}
              </button>
              <button
                onClick={async () => {
                  await removeThread({ data: { threadId: t.id } });
                  if (t.id === threadId) newThread();
                  void loadThreads();
                }}
                className="opacity-0 transition group-hover:opacity-100"
                aria-label="Supprimer la conversation"
              >
                <Trash2 className="h-3.5 w-3.5 text-white/40 hover:text-red-400" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Échange */}
      <div className="flex min-h-[420px] flex-col rounded-2xl border border-[rgba(184,110,249,.2)] bg-[#2d1248]/50">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 lg:max-h-[520px]">
          {messages.length === 0 && !busy && (
            <div className="py-8 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-[#b86ef9]/50" />
              <p className="mt-3 text-sm text-white/60">
                Demandez ce que vous voulez : publication, prospection, SEO, tarifs…
              </p>
              <p className="mt-1 text-xs text-white/35">
                L'agent choisit lui-même parmi 46 compétences, dont 12 écrites pour Holiswiss.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => void send(ex)}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:border-[#b86ef9]/50 hover:text-white"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#b86ef9]/20 px-3 py-2 text-sm text-white">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={m.id} className="max-w-[95%]">
                {m.skills_used?.length ? (
                  <div className="mb-1 flex flex-wrap gap-1">
                    {m.skills_used.map((s) => (
                      <span key={s} className="rounded-full border border-[#5cc8fa]/30 bg-[#5cc8fa]/10 px-2 py-0.5 text-[10px] text-[#5cc8fa]">
                        {s}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.03] px-3 py-2">
                  <Markdown text={m.content} />
                  <button
                    onClick={() => void toProposal(m.id)}
                    disabled={saving === m.id}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/70 hover:border-[#b86ef9]/50 hover:text-white disabled:opacity-50"
                  >
                    {saving === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bookmark className="h-3.5 w-3.5" />}
                    Enregistrer comme proposition
                  </button>
                </div>
              </div>
            ),
          )}

          {busy && (
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Loader2 className="h-4 w-4 animate-spin" /> L'agent réfléchit…
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
              }}
              rows={2}
              placeholder="Que voulez-vous demander à l'agent marketing ?"
              className="flex-1 resize-none rounded-xl border border-white/15 bg-[#1a0a2e] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#b86ef9]/50 focus:outline-none"
            />
            <button
              onClick={() => void send()}
              disabled={busy || !input.trim()}
              className="rounded-xl bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] p-2.5 text-white disabled:opacity-40"
              aria-label="Envoyer"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-white/30">
            Entrée pour envoyer · Maj+Entrée pour un retour à la ligne. L'agent ne publie jamais rien.
          </p>
        </div>
      </div>
    </div>
  );
}
