import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Rss, MessageSquare, ListChecks, CheckCircle2, XCircle, Pencil, Loader2 } from "lucide-react";
import { listFilProposals } from "@/lib/copywriter-agent.functions";
import { setArticleStatus, updateArticle } from "@/lib/articles.functions";
import { listCertificationOrganizations } from "@/lib/org-certifications.functions";
import { CopywriterAgentChat } from "@/components/admin/CopywriterAgentChat";
import { ArticleContent } from "@/components/articles/ArticleContent";
import { FIL_CATEGORIES } from "@/data/fil-holiswiss";

export const Route = createFileRoute("/admin/copywriter")({
  component: CopywriterPage,
});

type Proposal = {
  id: string;
  slug: string;
  slug_de: string | null;
  status: "pending_validation" | "rejected";
  lang: "fr" | "de" | "it" | "en";
  category: string;
  title_fr: string;
  title_de: string | null;
  title_it: string | null;
  title_en: string | null;
  excerpt_fr: string | null;
  excerpt_de: string | null;
  excerpt_it: string | null;
  excerpt_en: string | null;
  body_fr: string;
  body_de: string | null;
  body_it: string | null;
  body_en: string | null;
  meta_title_fr: string | null;
  meta_description_fr: string | null;
  secondary_tags: string[] | null;
  is_featured: boolean | null;
  cover_image_url: string | null;
  image_alt_text: string | null;
  cover_image_credit_name: string | null;
  cover_image_credit_url: string | null;
  rejection_reason: string | null;
  created_at: string;
};

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  FIL_CATEGORIES.map((c) => [c.slug, c.label.fr]),
);

function CopywriterPage() {
  const fetchProposals = useServerFn(listFilProposals);
  const setStatus = useServerFn(setArticleStatus);
  const saveEdits = useServerFn(updateArticle);
  const fetchOrganizations = useServerFn(listCertificationOrganizations);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"agent" | "proposals">("agent");

  const { data, isLoading } = useQuery({
    queryKey: ["fil-proposals"],
    queryFn: () => fetchProposals(),
  });
  const rows = (data?.articles ?? []) as Proposal[];
  const pending = rows.filter((p) => p.status === "pending_validation").length;

  const { data: orgsData } = useQuery({
    queryKey: ["cert-organizations-for-logos"],
    queryFn: () => fetchOrganizations(),
  });
  const logoOrgs = (orgsData ?? []).filter((o) => o.is_active && o.logo_url) as Array<{
    id: string;
    display_name: string;
    logo_url: string;
  }>;

  const act = async (id: string, status: "validated" | "rejected", reason?: string) => {
    try {
      await setStatus({ data: { id, status, reason } });
      toast.success(status === "validated" ? "Article validé — publié sur Le fil ✓" : "Proposition refusée");
      qc.invalidateQueries({ queryKey: ["fil-proposals"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  const saveEdit = async (p: Proposal, edited: { title_fr: string; excerpt_fr: string; body_fr: string }) => {
    await saveEdits({
      data: {
        id: p.id,
        title_fr: edited.title_fr,
        title_de: p.title_de ?? "",
        title_it: p.title_it ?? "",
        title_en: p.title_en ?? "",
        excerpt_fr: edited.excerpt_fr,
        excerpt_de: p.excerpt_de ?? "",
        excerpt_it: p.excerpt_it ?? "",
        excerpt_en: p.excerpt_en ?? "",
        body_fr: edited.body_fr,
        body_de: p.body_de ?? "",
        body_it: p.body_it ?? "",
        body_en: p.body_en ?? "",
        slug: p.slug,
        slug_de: p.slug_de ?? "",
        cover_image_url: p.cover_image_url ?? "",
        image_alt_text: p.image_alt_text ?? "",
        category: p.category,
        lang: p.lang,
        status: p.status,
        meta_title_fr: p.meta_title_fr ?? "",
        meta_description_fr: p.meta_description_fr ?? "",
        secondary_tags: p.secondary_tags ?? [],
        is_featured: p.is_featured ?? false,
      },
    });
    qc.invalidateQueries({ queryKey: ["fil-proposals"] });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white sm:text-3xl">
          <Rss className="h-6 w-6 text-[#b86ef9]" /> Copywriter — Le fil
        </h1>
        <p className="mt-2 text-sm text-[#d4c4e0]">
          Décrivez un sujet, l'agent rédige un article complet pour « Le fil Holiswiss » et propose une photo.
          <strong className="text-white"> Rien n'est publié sans votre validation.</strong>
        </p>
      </header>

      <div className="mb-6 flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        <button
          onClick={() => setTab("agent")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
            tab === "agent" ? "bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] text-white" : "text-white/60 hover:text-white"
          }`}
        >
          <MessageSquare className="h-4 w-4" /> Demander à l'agent
        </button>
        <button
          onClick={() => setTab("proposals")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
            tab === "proposals" ? "bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] text-white" : "text-white/60 hover:text-white"
          }`}
        >
          <ListChecks className="h-4 w-4" /> Propositions
          {pending > 0 && (
            <span className="rounded-full bg-amber-500/20 px-1.5 text-[11px] text-amber-300">{pending}</span>
          )}
        </button>
      </div>

      {tab === "agent" && <CopywriterAgentChat />}

      {tab === "proposals" && (
        <>
          {isLoading && <div className="py-16 text-center text-white/50">Chargement…</div>}
          {!isLoading && rows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-white/60">
              Aucune proposition pour le moment. Demandez-en une à l'agent dans l'onglet précédent.
            </div>
          )}
          <div className="space-y-5">
            {rows.map((p) => (
              <ProposalCard key={p.id} p={p} onAct={act} onSaveEdit={saveEdit} logoOrgs={logoOrgs} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ProposalCard({
  p,
  onAct,
  onSaveEdit,
  logoOrgs,
}: {
  p: Proposal;
  onAct: (id: string, status: "validated" | "rejected", reason?: string) => void;
  onSaveEdit: (p: Proposal, edited: { title_fr: string; excerpt_fr: string; body_fr: string }) => Promise<void>;
  logoOrgs: Array<{ id: string; display_name: string; logo_url: string }>;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(p.title_fr);
  const [excerpt, setExcerpt] = useState(p.excerpt_fr ?? "");
  const [body, setBody] = useState(p.body_fr);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const insertLogo = (org: { display_name: string; logo_url: string }) => {
    const el = bodyRef.current;
    const snippet = `![Logo ${org.display_name}](${org.logo_url})`;
    if (!el) { setBody((b) => `${b}\n\n${snippet}\n\n`); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    // Lignes vides autour : le logo doit rester seul sur sa ligne pour être
    // reconnu comme bloc image, jamais mélangé au texte qui l'entoure.
    const before = body.slice(0, start);
    const after = body.slice(end);
    const needsNlBefore = before.length > 0 && !before.endsWith("\n\n");
    const needsNlAfter = after.length > 0 && !after.startsWith("\n\n");
    const insert = `${needsNlBefore ? "\n\n" : ""}${snippet}${needsNlAfter ? "\n\n" : ""}`;
    const next = before + insert + after;
    setBody(next);
    const caret = (before + insert).length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  const startEditing = () => {
    setTitle(p.title_fr);
    setExcerpt(p.excerpt_fr ?? "");
    setBody(p.body_fr);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSaveEdit(p, { title_fr: title.trim(), excerpt_fr: excerpt.trim(), body_fr: body.trim() });
      toast.success("Modifications enregistrées");
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="rounded-2xl border border-[rgba(184,110,249,0.25)] bg-[#1a0a2e] p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-white/80">
          <span className="rounded-full bg-[rgba(184,110,249,0.15)] px-2 py-0.5 text-xs text-[#d4a8ff]">
            {CATEGORY_LABEL[p.category] ?? p.category}
          </span>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
            p.status === "rejected"
              ? "border-red-500/30 bg-red-500/15 text-red-300"
              : "border-amber-500/30 bg-amber-500/15 text-amber-300"
          }`}
        >
          {p.status === "rejected" ? "Refusé" : "En attente de validation"}
        </span>
      </div>

      {editing ? (
        <div className="space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre"
            className="w-full rounded-lg border border-[rgba(184,110,249,0.3)] bg-[#0f0a1e] px-3 py-2 text-lg font-semibold text-white placeholder:text-white/30 focus:border-[#b86ef9] focus:outline-none"
          />
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
            placeholder="Extrait / chapô"
            className="w-full rounded-lg border border-[rgba(184,110,249,0.3)] bg-[#0f0a1e] px-3 py-2 text-sm text-white/90 placeholder:text-white/30 focus:border-[#b86ef9] focus:outline-none"
          />
          {logoOrgs.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1.5">
              <span className="text-xs text-white/50">Insérer un logo à la position du curseur :</span>
              {logoOrgs.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => insertLogo(org)}
                  title={`Insérer le logo ${org.display_name}`}
                  className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/70 hover:border-[#b86ef9]/50 hover:text-white"
                >
                  <img src={org.logo_url} alt="" className="h-4 w-4 rounded bg-white/90 object-contain" />
                  {org.display_name}
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder="Corps de l'article (markdown)"
            className="w-full rounded-lg border border-[rgba(184,110,249,0.3)] bg-[#0f0a1e] px-3 py-2 font-mono text-sm text-white/90 placeholder:text-white/30 focus:border-[#b86ef9] focus:outline-none"
          />
        </div>
      ) : (
        <>
          <h3 className="text-lg font-semibold text-white">{p.title_fr}</h3>
          {p.excerpt_fr && <p className="mt-1 text-sm text-white/70">{p.excerpt_fr}</p>}
          {p.body_fr && (
            <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#0f0a1e] p-3">
              <ArticleContent source={p.body_fr} className="text-sm text-white/80 [&_h2]:text-base [&_h3]:text-sm" />
            </div>
          )}
        </>
      )}

      {p.cover_image_url && (
        <div className="mt-3">
          <img src={p.cover_image_url} alt={p.image_alt_text ?? ""} className="h-40 w-full rounded-xl object-cover" />
          {p.cover_image_credit_name && (
            <p className="mt-1 text-[11px] text-white/40">
              Photo par{" "}
              {p.cover_image_credit_url ? (
                <a href={p.cover_image_credit_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-white/60">
                  {p.cover_image_credit_name}
                </a>
              ) : (
                p.cover_image_credit_name
              )}{" "}
              sur Unsplash
            </p>
          )}
        </div>
      )}

      {p.rejection_reason && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
          Motif du refus : {p.rejection_reason}
        </p>
      )}

      <div className="mt-4 border-t border-white/10 pt-4">
        {editing ? (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void save()}
              disabled={saving || !title.trim() || !body.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#b86ef9] to-[#22d3ee] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Enregistrer les modifications
            </button>
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/70 disabled:opacity-40"
            >
              Annuler
            </button>
          </div>
        ) : rejecting ? (
          <div className="space-y-2">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Pourquoi refuser cette proposition ?"
              className="w-full rounded-lg border border-[rgba(184,110,249,0.3)] bg-[#0f0a1e] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#b86ef9] focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { onAct(p.id, "rejected", reason); setRejecting(false); setReason(""); }}
                disabled={reason.trim().length < 3}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                Confirmer le refus
              </button>
              <button onClick={() => { setRejecting(false); setReason(""); }} className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/70">
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onAct(p.id, "validated")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#b86ef9] to-[#22d3ee] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              <CheckCircle2 className="h-4 w-4" /> Valider et publier
            </button>
            <button
              onClick={startEditing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/5"
            >
              <Pencil className="h-4 w-4" /> Modifier
            </button>
            <button
              onClick={() => setRejecting(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/40 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10"
            >
              <XCircle className="h-4 w-4" /> Refuser
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
