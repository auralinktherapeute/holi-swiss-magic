import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send, Loader2, Plus, Trash2, Bookmark, MessageSquare, Image, ExternalLink, Check } from "lucide-react";
import {
  askCopywriterAgent,
  listCopywriterThreads,
  getCopywriterThread,
  deleteCopywriterThread,
  suggestCoverPhotos,
  saveAnswerAsArticleDraft,
} from "@/lib/copywriter-agent.functions";
import { trackUnsplashDownload } from "@/lib/unsplash.functions";

type Msg = { id: string; role: "user" | "assistant"; content: string; created_at: string };
type Thread = { id: string; title: string; updated_at: string };
type Photo = {
  id: string;
  urls: { small: string; regular: string };
  alt_description: string;
  user: { name: string; links: { html: string } };
  links: { download_location: string };
};

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
  "Nouveau partenariat avec l'association ASCA Genève",
  "On passe à 300 thérapeutes inscrits sur Holiswiss",
  "Portrait d'une naturopathe membre depuis le lancement",
  "Conseils pour bien remplir sa fiche praticien",
];

/** État de la sélection de photo de couverture pour un message donné. */
type PhotoState = {
  query: string;
  photos: Photo[];
  selected: Photo | null;
  altText: string;
};

export function CopywriterAgentChat() {
  const ask = useServerFn(askCopywriterAgent);
  const fetchThreads = useServerFn(listCopywriterThreads);
  const fetchThread = useServerFn(getCopywriterThread);
  const removeThread = useServerFn(deleteCopywriterThread);
  const suggestPhotos = useServerFn(suggestCoverPhotos);
  const saveDraft = useServerFn(saveAnswerAsArticleDraft);
  const trackDownload = useServerFn(trackUnsplashDownload);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState<string | null>(null);
  const [photoStates, setPhotoStates] = useState<Record<string, PhotoState>>({});
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
    setPhotoStates({});
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
      { id: `tmp-${Date.now()}`, role: "user", content: q, created_at: new Date().toISOString() },
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

  const askForPhotos = async (messageId: string) => {
    setLoadingPhotos(messageId);
    try {
      const r = await suggestPhotos({ data: { messageId } });
      setPhotoStates((s) => ({
        ...s,
        [messageId]: { query: r.query, photos: r.photos as Photo[], selected: null, altText: "" },
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Recherche de photos impossible");
    } finally {
      setLoadingPhotos(null);
    }
  };

  const pickPhoto = (messageId: string, photo: Photo) => {
    setPhotoStates((s) => ({ ...s, [messageId]: { ...s[messageId], selected: photo } }));
    if (photo.links?.download_location) {
      trackDownload({ data: { downloadLocation: photo.links.download_location } }).catch(() => {});
    }
  };

  const setAltText = (messageId: string, altText: string) => {
    setPhotoStates((s) => ({ ...s, [messageId]: { ...s[messageId], altText } }));
  };

  const toDraft = async (messageId: string) => {
    const ps = photoStates[messageId];
    if (!ps?.selected || !ps.altText.trim()) return;
    setSaving(messageId);
    try {
      await saveDraft({
        data: {
          messageId,
          coverImageUrl: ps.selected.urls.regular,
          coverImageCreditName: ps.selected.user.name,
          coverImageCreditUrl: ps.selected.user.links.html,
          imageAltText: ps.altText.trim(),
        },
      });
      toast.success("Brouillon enregistré — à valider dans l'onglet Propositions");
      setPhotoStates((s) => {
        const next = { ...s };
        delete next[messageId];
        return next;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setSaving(null);
    }
  };

  const newThread = () => { setThreadId(null); setMessages([]); setInput(""); setPhotoStates({}); };

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
        <div className="flex-1 space-y-4 overflow-y-auto p-4 lg:max-h-[620px]">
          {messages.length === 0 && !busy && (
            <div className="py-8 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-[#b86ef9]/50" />
              <p className="mt-3 text-sm text-white/60">
                Décrivez le sujet, l'agent rédige un article complet pour « Le fil Holiswiss ».
              </p>
              <p className="mt-1 text-xs text-white/35">
                Rien n'est publié sans votre validation — l'agent ne choisit jamais la photo tout seul.
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
                <div className="rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.03] px-3 py-2">
                  <Markdown text={m.content} />

                  {!photoStates[m.id] && (
                    <button
                      onClick={() => void askForPhotos(m.id)}
                      disabled={loadingPhotos === m.id}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/70 hover:border-[#b86ef9]/50 hover:text-white disabled:opacity-50"
                    >
                      {loadingPhotos === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Image className="h-3.5 w-3.5" />}
                      Proposer une photo de couverture
                    </button>
                  )}

                  {photoStates[m.id] && (
                    <div className="mt-3 rounded-xl border border-white/10 bg-[#1a0a2e] p-3">
                      <p className="mb-2 text-xs text-white/50">
                        Suggestions Unsplash pour « {photoStates[m.id].query} » — choisissez-en une :
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {photoStates[m.id].photos.map((p) => {
                          const isSelected = photoStates[m.id].selected?.id === p.id;
                          return (
                            <button
                              key={p.id}
                              onClick={() => pickPhoto(m.id, p)}
                              className={`group relative overflow-hidden rounded-lg border-2 ${
                                isSelected ? "border-[#b86ef9]" : "border-transparent hover:border-white/30"
                              }`}
                            >
                              <img src={p.urls.small} alt={p.alt_description || ""} className="h-20 w-full object-cover" />
                              {isSelected && (
                                <span className="absolute right-1 top-1 rounded-full bg-[#b86ef9] p-0.5">
                                  <Check className="h-3 w-3 text-white" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {photoStates[m.id].selected && (
                        <div className="mt-2 space-y-2">
                          <a
                            href={photoStates[m.id].selected!.user.links.html}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-white/60"
                          >
                            Photo par {photoStates[m.id].selected!.user.name} sur Unsplash
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <input
                            value={photoStates[m.id].altText}
                            onChange={(e) => setAltText(m.id, e.target.value)}
                            placeholder="Texte alternatif de l'image (accessibilité, requis)"
                            className="w-full rounded-lg border border-white/15 bg-[#0f0a1e] px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-[#b86ef9]/50 focus:outline-none"
                          />
                          <button
                            onClick={() => void toDraft(m.id)}
                            disabled={saving === m.id || !photoStates[m.id].altText.trim()}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                          >
                            {saving === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bookmark className="h-3.5 w-3.5" />}
                            Enregistrer comme brouillon d'actualité
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ),
          )}

          {busy && (
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Loader2 className="h-4 w-4 animate-spin" /> L'agent rédige…
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
              placeholder="Quel sujet pour Le fil Holiswiss ?"
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
