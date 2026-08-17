import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Monitor,
  Smartphone,
  ExternalLink,
  Archive,
  CheckCircle2,
  Send,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  NewsletterConnection,
  NewsletterLinkCheck,
  type ConnectionKey,
} from "@/components/admin/NewsletterConnection";
import { NewsletterStatusLegend } from "@/components/admin/NewsletterStatusLegend";
import {
  getNewsletterIssue,
  updateNewsletterIssue,
  updateNewsletterContent,
  setNewsletterIssueStatus,
  setNewsletterResourcePublished,
  listNewsletterRevisions,
} from "@/lib/newsletter.functions";
import { renderNewsletterEmail, renderNewsletterText } from "@/lib/newsletter-email.shared";
import {
  NewsletterSendPreview,
  type SendPreviewTab,
} from "@/components/admin/NewsletterSendPreview";
import { NEWSLETTER_TEMPLATES } from "@/lib/newsletter-templates.shared";
import {
  getNewsletterSendPreview,
  sendNewsletterTestEmail,
  sendNewsletterIssue,
  listNewsletterSends,
} from "@/lib/newsletter-send.functions";
import {
  NEWSLETTER_SEGMENTS,
  SEND_STATUS_LABELS,
  type NewsletterSegmentKey,
  type NewsletterSendRow,
  type SendStatus,
} from "@/lib/newsletter-send.shared";
import {
  NEWSLETTER_STATUS_LABELS,
  NEWSLETTER_LANGS,
  NEWSLETTER_LANG_LABELS,
  NEWSLETTER_PILLARS,
  NEWSLETTER_AUDIENCES,
  NEWSLETTER_TONES,
  NEWSLETTER_QC_ITEMS,
  slugify,
  type NewsletterIssue,
  type NewsletterStatus,
  type NewsletterRevision,
} from "@/lib/newsletter.shared";

export const Route = createFileRoute("/admin/newsletter/$id")({ component: Page });

const STATUS_COLORS: Record<NewsletterStatus, string> = {
  idee: "bg-white/10 text-white/70",
  brief_cree: "bg-[#38bdf8]/15 text-[#38bdf8]",
  brouillon: "bg-[#5cc8fa]/15 text-[#5cc8fa]",
  en_revision: "bg-[#fbbf24]/15 text-[#fbbf24]",
  approuvee: "bg-[#4ade80]/15 text-[#4ade80]",
  programmee: "bg-[#b86ef9]/15 text-[#b86ef9]",
  envoi_en_cours: "bg-[#fb923c]/15 text-[#fb923c]",
  envoyee: "bg-white/15 text-white",
  echec: "bg-[#f87171]/15 text-[#f87171]",
  archivee: "bg-white/5 text-white/40",
};

const inputCls =
  "bg-white/5 border-white/10 text-white placeholder:text-white/35 focus-visible:ring-[#b86ef9]";
const selectCls =
  "h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#b86ef9]";
const tabCls = "data-[state=active]:bg-[#b86ef9] data-[state=active]:text-white text-white/70";

type TextKey =
  | "title"
  | "problem"
  | "objective"
  | "audience"
  | "pillar"
  | "tone"
  | "feature_highlight"
  | "cta"
  | "lang"
  | "target_date"
  | "internal_notes"
  | "email_subject"
  | "email_preheader"
  | "email_intro"
  | "email_body"
  | "email_button_label"
  | "email_button_url"
  | "email_footer"
  | "resource_title"
  | "resource_intro"
  | "resource_body"
  | "resource_sections"
  | "resource_example"
  | "resource_checklist"
  | "resource_takeaway"
  | "resource_cta"
  | "slug"
  | "seo_title"
  | "meta_description"
  | "share_image_url"
  | "canonical_url"
  | "feature_key"
  | "target_route"
  | "action_label"
  | "action_difficulty"
  | "action_minutes"
  | "linked_article_id"
  | "linked_article_kind"
  | "linked_resource_slug"
  | "segment_key"
  | "connection_priority"
  | "connection_notes";

type Form = Record<TextKey, string> & { qc: Record<string, boolean> };

function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

function Field(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  const { id, label, value, onChange, rows, placeholder, type, hint } = props;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-white/85">
        {label}
      </Label>
      {rows ? (
        <Textarea
          id={id}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      ) : (
        <Input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      )}
      {hint && <p className="text-xs text-white/45">{hint}</p>}
    </div>
  );
}

function Page() {
  const { id } = useParams({ from: "/admin/newsletter/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const load = useServerFn(getNewsletterIssue);
  const saveBrief = useServerFn(updateNewsletterIssue);
  const saveContent = useServerFn(updateNewsletterContent);
  const setStatus = useServerFn(setNewsletterIssueStatus);
  const setPublished = useServerFn(setNewsletterResourcePublished);
  const loadHistory = useServerFn(listNewsletterRevisions);
  const loadSendPreview = useServerFn(getNewsletterSendPreview);
  const sendTestFn = useServerFn(sendNewsletterTestEmail);
  const sendIssueFn = useServerFn(sendNewsletterIssue);
  const loadSends = useServerFn(listNewsletterSends);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-newsletter-issue", id],
    queryFn: () => load({ data: { id } }),
  });
  const history = useQuery({
    queryKey: ["admin-newsletter-revisions", id],
    queryFn: () => loadHistory({ data: { id } }),
  });

  const issue = data?.issue as NewsletterIssue | undefined;
  const [form, setForm] = useState<Form | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [segment, setSegment] = useState<NewsletterSegmentKey>("tous");
  const [testEmail, setTestEmail] = useState("");
  const [confirmTestOpen, setConfirmTestOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Aperçu obligatoire : mémorise la version exacte du contenu email validée à l'écran.
  const [previewOpen, setPreviewOpen] = useState(false);
  const [tab, setTab] = useState<string>("brief");
  const [checkedVersion, setCheckedVersion] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<null | "idee" | "archivee">(null);

  const sendPreview = useQuery({
    queryKey: ["admin-newsletter-send-preview", id, segment],
    queryFn: () => loadSendPreview({ data: { id, segment } }),
  });
  const sends = useQuery({
    queryKey: ["admin-newsletter-sends", id],
    queryFn: () => loadSends({ data: { id } }),
  });

  useEffect(() => {
    if (!issue) return;
    setForm({
      title: str(issue.title),
      problem: str(issue.problem),
      objective: str(issue.objective),
      audience: str(issue.audience),
      pillar: str(issue.pillar),
      tone: str(issue.tone),
      feature_highlight: str(issue.feature_highlight),
      cta: str(issue.cta),
      lang: str(issue.lang) || "fr",
      target_date: str(issue.target_date),
      internal_notes: str(issue.internal_notes),
      email_subject: str(issue.email_subject),
      email_preheader: str(issue.email_preheader),
      email_intro: str(issue.email_intro),
      email_body: str(issue.email_body),
      email_button_label: str(issue.email_button_label),
      email_button_url: str(issue.email_button_url),
      email_footer: str(issue.email_footer),
      resource_title: str(issue.resource_title),
      resource_intro: str(issue.resource_intro),
      resource_body: str(issue.resource_body),
      resource_sections: str(issue.resource_sections),
      resource_example: str(issue.resource_example),
      resource_checklist: str(issue.resource_checklist),
      resource_takeaway: str(issue.resource_takeaway),
      resource_cta: str(issue.resource_cta),
      slug: str(issue.slug),
      seo_title: str(issue.seo_title),
      meta_description: str(issue.meta_description),
      share_image_url: str(issue.share_image_url),
      canonical_url: str(issue.canonical_url),
      feature_key: str(issue.feature_key),
      target_route: str(issue.target_route),
      action_label: str(issue.action_label),
      action_difficulty: str(issue.action_difficulty),
      action_minutes: str(issue.action_minutes),
      linked_article_id: str(issue.linked_article_id),
      linked_article_kind: str(issue.linked_article_kind),
      linked_resource_slug: str(issue.linked_resource_slug),
      segment_key: str(issue.segment_key),
      connection_priority: str(issue.connection_priority),
      connection_notes: str(issue.connection_notes),
      qc: (issue.qc_checklist ?? {}) as Record<string, boolean>,
    });
    if (issue.segment_key) setSegment(issue.segment_key as NewsletterSegmentKey);
  }, [issue]);

  const set = (key: TextKey, value: string) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const setQc = (key: string, value: boolean) =>
    setForm((f) => (f ? { ...f, qc: { ...f.qc, [key]: value } } : f));

  const locked =
    issue?.status === "envoyee" ||
    issue?.status === "envoi_en_cours" ||
    issue?.status === "echec" ||
    issue?.status === "archivee";

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      await saveBrief({
        data: {
          id,
          title: form.title,
          problem: form.problem,
          objective: form.objective,
          audience: form.audience,
          pillar: form.pillar,
          tone: form.tone,
          feature_highlight: form.feature_highlight,
          cta: form.cta,
          lang: form.lang as (typeof NEWSLETTER_LANGS)[number],
          target_date: form.target_date,
          internal_notes: form.internal_notes,
          feature_key: form.feature_key,
          target_route: form.target_route,
          action_label: form.action_label,
          action_difficulty: form.action_difficulty,
          action_minutes: form.action_minutes ? Number(form.action_minutes) : "",
          linked_article_id: form.linked_article_id,
          linked_article_kind: form.linked_article_kind,
          linked_resource_slug: form.linked_resource_slug,
          segment_key: form.segment_key,
          connection_priority: form.connection_priority,
          connection_notes: form.connection_notes,
          status: (issue?.status ?? "brouillon") as NewsletterStatus,
        },
      });
      await saveContent({
        data: {
          id,
          email_subject: form.email_subject,
          email_preheader: form.email_preheader,
          email_intro: form.email_intro,
          email_body: form.email_body,
          email_button_label: form.email_button_label,
          email_button_url: form.email_button_url,
          email_footer: form.email_footer,
          resource_title: form.resource_title,
          resource_intro: form.resource_intro,
          resource_body: form.resource_body,
          resource_sections: form.resource_sections,
          resource_example: form.resource_example,
          resource_checklist: form.resource_checklist,
          resource_takeaway: form.resource_takeaway,
          resource_cta: form.resource_cta,
          slug: form.slug,
          seo_title: form.seo_title,
          meta_description: form.meta_description,
          share_image_url: form.share_image_url,
          canonical_url: form.canonical_url,
          qc_checklist: form.qc,
        },
      });
    },
    onSuccess: () => {
      toast.success("Modifications enregistrées.");
      qc.invalidateQueries({ queryKey: ["admin-newsletter-issue", id] });
      qc.invalidateQueries({ queryKey: ["admin-newsletter-revisions", id] });
      qc.invalidateQueries({ queryKey: ["admin-newsletter-issues"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible."),
  });

  const changeStatus = useMutation({
    mutationFn: (status: NewsletterStatus) => setStatus({ data: { id, status } }),
    onSuccess: () => {
      toast.success("Statut mis à jour.");
      qc.invalidateQueries({ queryKey: ["admin-newsletter-issue", id] });
      qc.invalidateQueries({ queryKey: ["admin-newsletter-revisions", id] });
      qc.invalidateQueries({ queryKey: ["admin-newsletter-issues"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Changement de statut impossible."),
  });

  const publish = useMutation({
    mutationFn: (published: boolean) => setPublished({ data: { id, published } }),
    onSuccess: () => {
      toast.success("Publication mise à jour.");
      qc.invalidateQueries({ queryKey: ["admin-newsletter-issue", id] });
      qc.invalidateQueries({ queryKey: ["admin-newsletter-revisions", id] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Publication impossible."),
  });

  const previewHtml = useMemo(() => {
    if (!form) return "";
    return renderNewsletterEmail({
      subject: form.email_subject || form.title,
      preheader: form.email_preheader,
      intro: form.email_intro,
      body: form.email_body,
      buttonLabel: form.email_button_label,
      buttonUrl: form.email_button_url,
      footer: form.email_footer,
      unsubscribeUrl: "https://holiswiss.ch/desinscription",
    }).html;
  }, [form]);

  const previewText = useMemo(() => {
    if (!form) return "";
    return renderNewsletterText({
      subject: form.email_subject || form.title,
      preheader: form.email_preheader,
      intro: form.email_intro,
      body: form.email_body,
      buttonLabel: form.email_button_label,
      buttonUrl: form.email_button_url,
      footer: form.email_footer,
      unsubscribeUrl: "https://holiswiss.ch/desinscription",
    });
  }, [form]);

  // Empreinte du contenu email : toute modification invalide l'aperçu déjà vérifié.
  const emailVersion = useMemo(() => previewHtml, [previewHtml]);
  const previewChecked = checkedVersion !== null && checkedVersion === emailVersion;

  const testTarget = testEmail.trim();
  const testEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(testTarget);

  const sendTest = useMutation({
    mutationFn: () => sendTestFn({ data: { id, to: testTarget } }),
    onSuccess: (r) => {
      toast.success(`Email de test envoyé à ${r.to}.`);
      qc.invalidateQueries({ queryKey: ["admin-newsletter-sends", id] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Envoi de test impossible."),
  });

  const sendReal = useMutation({
    mutationFn: () => sendIssueFn({ data: { id, segment, confirm: true } }),
    onSuccess: (r) => {
      setConfirmOpen(false);
      if (r.status === "sent") toast.success(`Newsletter envoyée à ${r.sentCount} destinataires.`);
      else if (r.status === "partially_failed")
        toast.warning(`Envoi partiel : ${r.sentCount}/${r.total} réussis.`);
      else toast.error("L'envoi a échoué. Consultez le journal.");
      qc.invalidateQueries({ queryKey: ["admin-newsletter-issue", id] });
      qc.invalidateQueries({ queryKey: ["admin-newsletter-sends", id] });
      qc.invalidateQueries({ queryKey: ["admin-newsletter-send-preview", id] });
      qc.invalidateQueries({ queryKey: ["admin-newsletter-revisions", id] });
      qc.invalidateQueries({ queryKey: ["admin-newsletter-issues"] });
    },
    onError: (e: unknown) => {
      setConfirmOpen(false);
      toast.error(e instanceof Error ? e.message : "Envoi impossible.");
    },
  });

  const blockers = sendPreview.data?.blockers ?? [];
  const canSend = blockers.length === 0 && !sendReal.isPending && previewChecked;

  const qcDone = form ? NEWSLETTER_QC_ITEMS.filter((i) => form.qc[i.key]).length : 0;
  const qcTotal = NEWSLETTER_QC_ITEMS.length;
  const approved = issue?.status === "approuvee";

  if (isLoading) {
    return <div className="p-6 md:p-10 text-white/60">Chargement de la newsletter…</div>;
  }
  if (error || !issue || !form) {
    return (
      <div className="p-6 md:p-10 space-y-4">
        <p className="text-[#f87171]">Newsletter introuvable ou inaccessible.</p>
        <Link to="/admin/newsletter" className="text-white/70 underline">
          Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-10 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              to="/admin/newsletter"
              className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Newsletter thérapeutes
            </Link>
            <h1 className="mt-2 text-2xl md:text-3xl font-bold break-words">
              {form.title || "Sans titre"}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/55">
              <Badge className={`${STATUS_COLORS[issue.status]} border-0`}>
                {NEWSLETTER_STATUS_LABELS[issue.status]}
              </Badge>
              <NewsletterStatusLegend />
              {issue.published_at && (
                <Badge className="bg-[#4ade80]/15 text-[#4ade80] border-0">
                  Page ressource publiée
                </Badge>
              )}
              <span>Modifiée le {new Date(issue.updated_at).toLocaleString("fr-CH")}</span>
              {issue.created_by_email && <span>· {issue.created_by_email}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/admin/newsletter" })}
              className="min-h-11 border-white/15 bg-transparent text-white hover:bg-white/10"
            >
              Quitter
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || locked}
              className="min-h-11 bg-[#b86ef9] hover:bg-[#a355f0] text-white"
            >
              <Save className="h-4 w-4 mr-2" aria-hidden="true" />
              {save.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>

        {locked && (
          <Card className="bg-[#1d0d3d] border-[#fbbf24]/40">
            <CardContent className="p-4 text-sm text-[#fbbf24]">
              Cette newsletter est {NEWSLETTER_STATUS_LABELS[issue.status].toLowerCase()} : le
              contenu est verrouillé en lecture seule.
            </CardContent>
          </Card>
        )}

        <Tabs value={tab} onValueChange={setTab} className="space-y-5">
          <TabsList className="flex w-full flex-wrap justify-start gap-1 bg-white/5 p-1 h-auto">
            <TabsTrigger value="brief" className={tabCls}>
              Brief
            </TabsTrigger>
            <TabsTrigger value="email" className={tabCls}>
              Email
            </TabsTrigger>
            <TabsTrigger value="resource" className={tabCls}>
              Page ressource
            </TabsTrigger>
            <TabsTrigger value="seo" className={tabCls}>
              SEO
            </TabsTrigger>
            <TabsTrigger value="qc" className={tabCls}>
              Contrôle qualité
            </TabsTrigger>
            <TabsTrigger value="send" className={tabCls}>
              Envoi
            </TabsTrigger>
            <TabsTrigger value="history" className={tabCls}>
              Historique
            </TabsTrigger>
          </TabsList>

          {/* BRIEF */}
          <TabsContent value="brief">
            <Card className="bg-[#1d0d3d] border-white/10">
              <CardContent className="p-5 sm:p-6 space-y-5">
                <Field
                  id="f-title"
                  label="Titre ou idée"
                  value={form.title}
                  onChange={(v) => set("title", v)}
                />
                <Field
                  id="f-problem"
                  label="Problématique"
                  rows={3}
                  value={form.problem}
                  onChange={(v) => set("problem", v)}
                  placeholder="Quel problème concret vit le thérapeute ?"
                />
                <Field
                  id="f-objective"
                  label="Objectif"
                  rows={2}
                  value={form.objective}
                  onChange={(v) => set("objective", v)}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="f-audience" className="text-white/85">
                      Public cible
                    </Label>
                    <select
                      id="f-audience"
                      value={form.audience}
                      className={selectCls}
                      onChange={(e) => set("audience", e.target.value)}
                    >
                      <option value="" className="bg-[#1d0d3d]">
                        —
                      </option>
                      {NEWSLETTER_AUDIENCES.map((a) => (
                        <option key={a} value={a} className="bg-[#1d0d3d]">
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="f-pillar" className="text-white/85">
                      Pilier éditorial
                    </Label>
                    <select
                      id="f-pillar"
                      value={form.pillar}
                      className={selectCls}
                      onChange={(e) => set("pillar", e.target.value)}
                    >
                      <option value="" className="bg-[#1d0d3d]">
                        —
                      </option>
                      {NEWSLETTER_PILLARS.map((p) => (
                        <option key={p} value={p} className="bg-[#1d0d3d]">
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="f-tone" className="text-white/85">
                      Ton
                    </Label>
                    <select
                      id="f-tone"
                      value={form.tone}
                      className={selectCls}
                      onChange={(e) => set("tone", e.target.value)}
                    >
                      <option value="" className="bg-[#1d0d3d]">
                        —
                      </option>
                      {NEWSLETTER_TONES.map((t) => (
                        <option key={t} value={t} className="bg-[#1d0d3d]">
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Field
                    id="f-feature"
                    label="Fonctionnalité Holiswiss à mettre en avant"
                    value={form.feature_highlight}
                    onChange={(v) => set("feature_highlight", v)}
                  />
                  <Field
                    id="f-cta"
                    label="Appel à l'action"
                    value={form.cta}
                    onChange={(v) => set("cta", v)}
                  />
                  <div className="space-y-1.5">
                    <Label htmlFor="f-lang" className="text-white/85">
                      Langue
                    </Label>
                    <select
                      id="f-lang"
                      value={form.lang}
                      className={selectCls}
                      onChange={(e) => set("lang", e.target.value)}
                    >
                      {NEWSLETTER_LANGS.map((l) => (
                        <option key={l} value={l} className="bg-[#1d0d3d]">
                          {NEWSLETTER_LANG_LABELS[l]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Field
                    id="f-date"
                    label="Date souhaitée"
                    type="date"
                    value={form.target_date}
                    onChange={(v) => set("target_date", v)}
                  />
                </div>
                <Field
                  id="f-notes"
                  label="Notes internes (jamais publiques)"
                  rows={3}
                  value={form.internal_notes}
                  onChange={(v) => set("internal_notes", v)}
                />
              </CardContent>
            </Card>
            <div className="mt-5">
              <NewsletterConnection
                issueId={id}
                values={form as unknown as Record<ConnectionKey, string>}
                set={(k, v) => set(k as TextKey, v)}
                disabled={locked}
                subject={form.email_subject || form.title}
                audience={form.audience}
                cta={form.cta}
                recipientCount={sendPreview.data?.recipientCount ?? null}
              />
            </div>
          </TabsContent>

          {/* EMAIL */}
          <TabsContent value="email">
            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="bg-[#1d0d3d] border-white/10">
                <CardContent className="p-5 sm:p-6 space-y-5">
                  <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-medium text-white">Modèles</p>
                    <p className="mt-1 text-xs text-white/55">
                      Pré-remplit les champs ci-dessous. Une ligne « Titre :: description » est
                      affichée sous forme de carte dans l'email.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {NEWSLETTER_TEMPLATES.map((tpl) => (
                        <Button
                          key={tpl.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={locked}
                          title={tpl.hint}
                          className="min-h-11 border-white/20 bg-transparent text-white hover:bg-white/10"
                          onClick={() => {
                            setForm((f) => (f ? { ...f, ...tpl.values } : f));
                          }}
                        >
                          {tpl.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Field
                    id="e-subject"
                    label="Objet"
                    value={form.email_subject}
                    onChange={(v) => set("email_subject", v)}
                  />
                  <Field
                    id="e-pre"
                    label="Pré-header"
                    value={form.email_preheader}
                    onChange={(v) => set("email_preheader", v)}
                    hint="Texte d'aperçu affiché après l'objet dans la boîte de réception."
                  />
                  <Field
                    id="e-intro"
                    label="Introduction"
                    rows={3}
                    value={form.email_intro}
                    onChange={(v) => set("email_intro", v)}
                  />
                  <Field
                    id="e-body"
                    label="Corps de l'email"
                    rows={10}
                    value={form.email_body}
                    onChange={(v) => set("email_body", v)}
                    hint="Une ligne vide crée un nouveau paragraphe."
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      id="e-btn"
                      label="Texte du bouton"
                      value={form.email_button_label}
                      onChange={(v) => set("email_button_label", v)}
                    />
                    <Field
                      id="e-url"
                      label="URL du bouton"
                      value={form.email_button_url}
                      onChange={(v) => set("email_button_url", v)}
                      placeholder="https://holiswiss.ch/lettre/…"
                    />
                  </div>
                  <Field
                    id="e-footer"
                    label="Footer légal"
                    rows={3}
                    value={form.email_footer}
                    onChange={(v) => set("email_footer", v)}
                  />
                </CardContent>
              </Card>

              <Card className="bg-[#1d0d3d] border-white/10">
                <CardContent className="p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-semibold">Aperçu</h2>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant={device === "desktop" ? "default" : "outline"}
                        aria-label="Aperçu desktop"
                        onClick={() => setDevice("desktop")}
                        className={
                          device === "desktop"
                            ? "min-h-11 bg-[#b86ef9] hover:bg-[#a355f0] text-white"
                            : "min-h-11 border-white/15 bg-transparent text-white hover:bg-white/10"
                        }
                      >
                        <Monitor className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant={device === "mobile" ? "default" : "outline"}
                        aria-label="Aperçu mobile"
                        onClick={() => setDevice("mobile")}
                        className={
                          device === "mobile"
                            ? "min-h-11 bg-[#b86ef9] hover:bg-[#a355f0] text-white"
                            : "min-h-11 border-white/15 bg-transparent text-white hover:bg-white/10"
                        }
                      >
                        <Smartphone className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3 text-xs text-white/70 space-y-1">
                    <div>
                      <span className="text-white/45">Expéditeur :</span> HoliSwiss
                      &lt;contact@holiswiss.ch&gt;
                    </div>
                    <div>
                      <span className="text-white/45">Objet :</span> {form.email_subject || "—"}
                    </div>
                    <div>
                      <span className="text-white/45">Pré-header :</span>{" "}
                      {form.email_preheader || "—"}
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-lg bg-white/5 p-2">
                    <iframe
                      title="Aperçu de l'email"
                      srcDoc={previewHtml}
                      className="rounded bg-white border-0"
                      style={{
                        width: device === "mobile" ? 375 : "100%",
                        minWidth: device === "mobile" ? 375 : 320,
                        height: 620,
                      }}
                    />
                  </div>
                  <p className="text-xs text-white/45">
                    Le lien de désinscription est ajouté automatiquement dans le pied de page.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* PAGE RESSOURCE */}
          <TabsContent value="resource">
            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="bg-[#1d0d3d] border-white/10">
                <CardContent className="p-5 sm:p-6 space-y-5">
                  <Field
                    id="r-title"
                    label="Titre"
                    value={form.resource_title}
                    onChange={(v) => set("resource_title", v)}
                  />
                  <div className="space-y-1.5">
                    <Label htmlFor="r-slug" className="text-white/85">
                      Slug
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="r-slug"
                        value={form.slug}
                        className={inputCls}
                        onChange={(e) => set("slug", slugify(e.target.value))}
                        placeholder="agenda-en-ligne"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => set("slug", slugify(form.resource_title || form.title))}
                        className="min-h-11 border-white/15 bg-transparent text-white hover:bg-white/10"
                      >
                        Générer
                      </Button>
                    </div>
                    <p className="text-xs text-white/45">/fr/lettre/{form.slug || "…"}</p>
                  </div>
                  <Field
                    id="r-intro"
                    label="Introduction"
                    rows={3}
                    value={form.resource_intro}
                    onChange={(v) => set("resource_intro", v)}
                  />
                  <Field
                    id="r-body"
                    label="Contenu principal"
                    rows={10}
                    value={form.resource_body}
                    onChange={(v) => set("resource_body", v)}
                  />
                  <Field
                    id="r-sections"
                    label="Sections"
                    rows={6}
                    value={form.resource_sections}
                    onChange={(v) => set("resource_sections", v)}
                    hint="Une section par bloc : première ligne = titre."
                  />
                  <Field
                    id="r-example"
                    label="Exemple concret"
                    rows={4}
                    value={form.resource_example}
                    onChange={(v) => set("resource_example", v)}
                  />
                  <Field
                    id="r-check"
                    label="Checklist"
                    rows={5}
                    value={form.resource_checklist}
                    onChange={(v) => set("resource_checklist", v)}
                    hint="Un élément par ligne."
                  />
                  <Field
                    id="r-take"
                    label="Encadré « À retenir »"
                    rows={3}
                    value={form.resource_takeaway}
                    onChange={(v) => set("resource_takeaway", v)}
                  />
                  <Field
                    id="r-cta"
                    label="Appel à l'action"
                    value={form.resource_cta}
                    onChange={(v) => set("resource_cta", v)}
                  />
                </CardContent>
              </Card>

              <div className="space-y-5">
                <Card className="bg-[#1d0d3d] border-white/10">
                  <CardContent className="p-5 sm:p-6 space-y-3">
                    <h2 className="font-semibold">Publication</h2>
                    <p className="text-sm text-white/60">
                      {issue.published_at
                        ? `Publiée le ${new Date(issue.published_at).toLocaleString("fr-CH")} — visible publiquement.`
                        : "En brouillon : la page n'est pas accessible publiquement et n'est pas indexable."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => publish.mutate(!issue.published_at)}
                        disabled={publish.isPending}
                        className="min-h-11 bg-[#4ade80]/20 text-[#4ade80] hover:bg-[#4ade80]/30"
                      >
                        {issue.published_at
                          ? "Dépublier la page ressource"
                          : "Publier la page ressource"}
                      </Button>
                      {issue.published_at && issue.slug && (
                        <Button
                          asChild
                          variant="outline"
                          className="min-h-11 border-white/15 bg-transparent text-white hover:bg-white/10"
                        >
                          <Link
                            to="/$lang/lettre/$slug"
                            params={{ lang: issue.lang || "fr", slug: issue.slug }}
                            target="_blank"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" /> Voir la
                            page
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1d0d3d] border-white/10">
                  <CardContent className="p-5 sm:p-6 space-y-4">
                    <h2 className="font-semibold">Aperçu public</h2>
                    <div className="rounded-xl bg-[#14082d] p-5 space-y-4">
                      <h3 className="text-xl font-bold">
                        {form.resource_title || "Titre de la page"}
                      </h3>
                      <p className="text-white/70 text-sm whitespace-pre-line">
                        {form.resource_intro}
                      </p>
                      <p className="text-white/60 text-sm whitespace-pre-line">
                        {form.resource_body}
                      </p>
                      {form.resource_takeaway && (
                        <div className="rounded-lg border border-[#b86ef9]/30 bg-[#b86ef9]/10 p-4 text-sm">
                          <div className="font-semibold mb-1">À retenir</div>
                          <p className="whitespace-pre-line text-white/75">
                            {form.resource_takeaway}
                          </p>
                        </div>
                      )}
                      {form.resource_cta && (
                        <div className="pt-1">
                          <span className="inline-block rounded-full bg-[#b86ef9] px-5 py-2.5 text-sm font-semibold">
                            {form.resource_cta}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* SEO */}
          <TabsContent value="seo">
            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="bg-[#1d0d3d] border-white/10">
                <CardContent className="p-5 sm:p-6 space-y-5">
                  <Field
                    id="s-title"
                    label="Titre SEO"
                    value={form.seo_title}
                    onChange={(v) => set("seo_title", v)}
                    hint={`${form.seo_title.length}/60 caractères recommandés`}
                  />
                  <Field
                    id="s-desc"
                    label="Meta description"
                    rows={3}
                    value={form.meta_description}
                    onChange={(v) => set("meta_description", v)}
                    hint={`${form.meta_description.length}/160 caractères recommandés`}
                  />
                  <Field
                    id="s-img"
                    label="Image de partage (URL absolue)"
                    value={form.share_image_url}
                    onChange={(v) => set("share_image_url", v)}
                    placeholder="https://holiswiss.ch/…"
                  />
                  <Field
                    id="s-canon"
                    label="Canonical URL"
                    value={form.canonical_url}
                    onChange={(v) => set("canonical_url", v)}
                    hint="Laisser vide pour utiliser l'URL de la page ressource."
                  />
                </CardContent>
              </Card>
              <Card className="bg-[#1d0d3d] border-white/10">
                <CardContent className="p-5 sm:p-6 space-y-3">
                  <h2 className="font-semibold">Aperçu moteur de recherche</h2>
                  <div className="rounded-lg bg-white p-4">
                    <div className="text-xs text-[#5f6368]">
                      holiswiss.ch › {form.lang} › lettre › {form.slug || "…"}
                    </div>
                    <div className="text-[#1a0dab] text-lg leading-snug">
                      {form.seo_title || form.resource_title || "Titre de la page"}
                    </div>
                    <p className="text-sm text-[#4d5156]">
                      {form.meta_description ||
                        "Ajoutez une meta description pour contrôler cet extrait."}
                    </p>
                  </div>
                  {!issue.published_at && (
                    <p className="text-xs text-[#fbbf24]">
                      Brouillon : la page reste non indexable tant qu'elle n'est pas publiée.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* CONTRÔLE QUALITÉ */}
          <TabsContent value="qc">
            <div className="mb-5">
              <NewsletterLinkCheck issueId={id} />
            </div>
            <Card className="bg-[#1d0d3d] border-white/10">
              <CardContent className="p-5 sm:p-6 space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold">Validation humaine</h2>
                  <Badge className="bg-white/10 text-white/70 border-0">
                    {qcDone}/{qcTotal}
                  </Badge>
                </div>
                <ul className="space-y-3">
                  {NEWSLETTER_QC_ITEMS.map((item) => (
                    <li key={item.key} className="flex items-start gap-3">
                      <Checkbox
                        id={`qc-${item.key}`}
                        checked={!!form.qc[item.key]}
                        disabled={locked}
                        onCheckedChange={(v) => setQc(item.key, v === true)}
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor={`qc-${item.key}`}
                        className="text-sm text-white/80 leading-relaxed"
                      >
                        {item.label}
                      </Label>
                    </li>
                  ))}
                </ul>

                <div className="border-t border-white/10 pt-5 space-y-3">
                  <h3 className="font-semibold text-sm">Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={locked || changeStatus.isPending}
                      onClick={() => changeStatus.mutate("brouillon")}
                      className="min-h-11 border-white/15 bg-transparent text-white hover:bg-white/10"
                    >
                      Repasser en brouillon
                    </Button>
                    <Button
                      variant="outline"
                      disabled={locked || changeStatus.isPending}
                      onClick={() => changeStatus.mutate("en_revision")}
                      className="min-h-11 border-white/15 bg-transparent text-white hover:bg-white/10"
                    >
                      Envoyer en révision
                    </Button>
                    <Button
                      disabled={locked || changeStatus.isPending || qcDone < qcTotal}
                      onClick={() => changeStatus.mutate("approuvee")}
                      className="min-h-11 bg-[#4ade80]/20 text-[#4ade80] hover:bg-[#4ade80]/30"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" aria-hidden="true" /> Approuver
                    </Button>
                    <Button
                      variant="outline"
                      disabled={locked || changeStatus.isPending}
                      onClick={() => setConfirmStatus("idee")}
                      className="min-h-11 border-[#f87171]/40 bg-transparent text-[#f87171] hover:bg-[#f87171]/10"
                    >
                      Rejeter
                    </Button>
                    <Button
                      variant="outline"
                      disabled={changeStatus.isPending}
                      onClick={() => setConfirmStatus("archivee")}
                      className="min-h-11 border-white/15 bg-transparent text-white/70 hover:bg-white/10"
                    >
                      <Archive className="h-4 w-4 mr-2" aria-hidden="true" /> Archiver
                    </Button>
                  </div>
                  <ul className="text-xs text-white/45 space-y-1">
                    <li>
                      <strong className="text-white/65">Repasser en brouillon</strong> : rouvre
                      l'édition. Aucun email n'est envoyé.
                    </li>
                    <li>
                      <strong className="text-white/65">Envoyer en révision</strong> : change
                      uniquement le statut pour relecture. Aucun email n'est envoyé.
                    </li>
                    <li>
                      <strong className="text-white/65">Approuver</strong> : rend l'envoi possible
                      depuis l'onglet « Envoi ». Ne déclenche aucun envoi.
                    </li>
                    <li>
                      <strong className="text-white/65">Rejeter</strong> : renvoie la newsletter au
                      statut « Idée ». Réversible, avec confirmation.
                    </li>
                    <li>
                      <strong className="text-white/65">Archiver</strong> : sort la newsletter du
                      flux de travail et verrouille l'édition. Réversible par un admin, avec
                      confirmation.
                    </li>
                  </ul>
                  {qcDone < qcTotal && !locked && (
                    <p className="text-xs text-[#fbbf24]">
                      Cochez les {qcTotal} points de contrôle pour pouvoir approuver.
                    </p>
                  )}
                  <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/50">
                      {approved
                        ? "L'envoi se pilote depuis l'onglet « Envoi »."
                        : "Une newsletter ne peut être envoyée qu'avec le statut « Approuvée »."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ENVOI */}
          <TabsContent value="send">
            <Card className="bg-[#1d0d3d] border-white/10">
              <CardContent className="p-5 sm:p-6 space-y-6">
                <div className="space-y-1.5">
                  <Label htmlFor="segment" className="text-white/85">
                    Segment de destinataires
                  </Label>
                  <select
                    id="segment"
                    className={selectCls}
                    value={segment}
                    onChange={(e) => setSegment(e.target.value as NewsletterSegmentKey)}
                  >
                    {NEWSLETTER_SEGMENTS.map((s) => (
                      <option key={s.key} value={s.key} className="bg-[#1d0d3d]">
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-white/50">
                    {NEWSLETTER_SEGMENTS.find((s) => s.key === segment)?.description}
                  </p>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/60">Destinataires estimés</span>
                    <span className="font-semibold">
                      {sendPreview.isFetching ? "…" : (sendPreview.data?.recipientCount ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/60">Expéditeur</span>
                    <span className="text-white/85">{sendPreview.data?.sender ?? "—"}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-white/60">Page ressource</span>
                    <span className="text-right break-all text-white/85">
                      {sendPreview.data?.resourceUrl ?? "Non utilisée"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/60">Version approuvée</span>
                    <span className="text-white/85">{sendPreview.data?.versionLabel ?? "—"}</span>
                  </div>
                </div>

                {blockers.length > 0 && (
                  <div className="rounded-lg border border-[#fbbf24]/40 bg-[#fbbf24]/10 p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-[#fbbf24]">
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Envoi bloqué
                    </p>
                    <ul className="mt-2 list-disc pl-5 text-xs text-[#fbbf24] space-y-1">
                      {blockers.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* TEST */}
                <div className="border-t border-white/10 pt-5 space-y-3">
                  <h3 className="font-semibold text-sm">Aperçu obligatoire</h3>
                  <p className="text-xs text-white/50">
                    Aucun email — test ou réel — ne peut partir avant que l'aperçu de la version
                    actuelle ait été ouvert et validé. Toute modification du contenu annule la
                    validation.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setPreviewOpen(true)}
                      className="min-h-11 border-white/15 bg-transparent text-white hover:bg-white/10"
                    >
                      Prévisualiser avant envoi
                    </Button>
                    <Badge
                      className={
                        previewChecked
                          ? "bg-[#4ade80]/15 text-[#4ade80] border-0"
                          : "bg-[#fbbf24]/15 text-[#fbbf24] border-0"
                      }
                    >
                      {previewChecked ? "Aperçu vérifié" : "Aperçu non vérifié"}
                    </Badge>
                  </div>
                </div>

                {/* TEST */}
                <div className="border-t border-white/10 pt-5 space-y-3">
                  <h3 className="font-semibold text-sm">Email de test</h3>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="test-email"
                      type="email"
                      aria-label="Adresse email de test"
                      placeholder="adresse@exemple.ch"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      className={inputCls}
                    />
                    <Button
                      variant="outline"
                      onClick={() => setConfirmTestOpen(true)}
                      disabled={sendTest.isPending || !previewChecked || !testEmailValid}
                      className="min-h-11 shrink-0 border-white/15 bg-transparent text-white hover:bg-white/10"
                    >
                      {sendTest.isPending ? "Envoi…" : "Envoyer un email de test"}
                    </Button>
                  </div>
                  {testTarget.length > 0 && !testEmailValid && (
                    <p className="text-xs text-[#f87171]" role="alert">
                      Adresse email invalide — format attendu : nom@domaine.ch
                    </p>
                  )}
                  <p className="text-xs text-white/50">
                    Le test part uniquement à l'adresse saisie — jamais à un segment. Il utilise
                    exactement la version prévisualisée, n'affecte pas le statut de la newsletter et
                    est enregistré dans l'historique comme « Test envoyé ».
                    {!previewChecked && " Validez d'abord l'aperçu ci-dessus."}
                  </p>
                </div>

                {/* ENVOI RÉEL */}
                <div className="border-t border-white/10 pt-5 space-y-3">
                  <h3 className="font-semibold text-sm">Envoi réel</h3>
                  {!confirmOpen ? (
                    <div className="space-y-2">
                      <Button
                        onClick={() => setConfirmOpen(true)}
                        disabled={!canSend}
                        className="min-h-11 w-full sm:w-auto bg-[#4ade80]/20 text-[#4ade80] hover:bg-[#4ade80]/30"
                      >
                        <Send className="h-4 w-4 mr-2" aria-hidden="true" /> Envoyer à tout le
                        segment
                      </Button>
                      <p className="text-xs text-white/50">
                        Ce bouton ouvre uniquement une fenêtre de confirmation : rien n'est envoyé
                        tant que vous n'avez pas confirmé.
                        {!previewChecked && " Aperçu à valider avant tout envoi."}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-[#f87171]/40 bg-[#f87171]/10 p-4 space-y-3">
                      <p className="text-sm font-medium text-white">Confirmer l'envoi</p>
                      <ul className="text-sm text-white/80 space-y-1">
                        <li>Newsletter : {sendPreview.data?.title}</li>
                        <li>Objet : {sendPreview.data?.subject ?? "—"}</li>
                        <li>Expéditeur : {sendPreview.data?.sender}</li>
                        <li>
                          Segment : {NEWSLETTER_SEGMENTS.find((s) => s.key === segment)?.label}
                        </li>
                        <li>Destinataires : {sendPreview.data?.recipientCount}</li>
                        <li className="break-all">
                          Page ressource : {sendPreview.data?.resourceUrl ?? "Non utilisée"}
                        </li>
                        <li>Version : {sendPreview.data?.versionLabel}</li>
                        <li>Date : {new Date().toLocaleString("fr-CH")}</li>
                      </ul>
                      <p className="text-xs text-[#f87171]">Cette action est irréversible.</p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => sendReal.mutate()}
                          disabled={!canSend}
                          className="min-h-11 bg-[#4ade80]/20 text-[#4ade80] hover:bg-[#4ade80]/30"
                        >
                          {sendReal.isPending ? "Envoi en cours…" : "Confirmer et envoyer"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setConfirmOpen(false)}
                          disabled={sendReal.isPending}
                          className="min-h-11 border-white/15 bg-transparent text-white hover:bg-white/10"
                        >
                          Annuler
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* JOURNAL */}
                <div className="border-t border-white/10 pt-5 space-y-3">
                  <h3 className="font-semibold text-sm">Journal des envois</h3>
                  {(sends.data?.rows ?? []).length === 0 && (
                    <p className="text-sm text-white/55">Aucun envoi enregistré.</p>
                  )}
                  <ul className="space-y-2">
                    {((sends.data?.rows ?? []) as NewsletterSendRow[]).map((s) => (
                      <li
                        key={s.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/5 pb-2 text-sm"
                      >
                        <Badge className="bg-white/10 text-white/70 border-0">
                          {SEND_STATUS_LABELS[s.status as SendStatus] ?? s.status}
                        </Badge>
                        {s.is_test && (
                          <Badge className="bg-[#5cc8fa]/15 text-[#5cc8fa] border-0">Test</Badge>
                        )}
                        <span className="text-white/70">
                          {s.sent_count}/{s.recipient_count} envoyés
                        </span>
                        <span className="text-white/50">segment {s.segment}</span>
                        <span className="text-white/50">
                          {new Date(s.started_at).toLocaleString("fr-CH")}
                        </span>
                        {s.actor_email && <span className="text-white/50">{s.actor_email}</span>}
                        {s.error_message && (
                          <span className="w-full text-xs text-[#f87171] break-all">
                            {s.error_message}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* HISTORIQUE */}
          <TabsContent value="history">
            <Card className="bg-[#1d0d3d] border-white/10">
              <CardContent className="p-5 sm:p-6">
                {history.isLoading && <p className="text-white/60">Chargement de l'historique…</p>}
                {!history.isLoading && (history.data?.rows ?? []).length === 0 && (
                  <p className="text-white/60">Aucune action enregistrée pour le moment.</p>
                )}
                <ul className="space-y-3">
                  {((history.data?.rows ?? []) as NewsletterRevision[]).map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/5 pb-3 text-sm"
                    >
                      <span className="text-white/85">{r.action}</span>
                      {r.status && (
                        <Badge className="bg-white/10 text-white/60 border-0">{r.status}</Badge>
                      )}
                      <span className="text-white/45">
                        {new Date(r.created_at).toLocaleString("fr-CH")}
                      </span>
                      {r.actor_email && <span className="text-white/45">· {r.actor_email}</span>}
                      {r.comment && <span className="w-full text-white/55">{r.comment}</span>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Prévisualisation obligatoire avant tout envoi */}
      <NewsletterSendPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        newsletterName={form.title}
        subject={form.email_subject || form.title}
        preheader={form.email_preheader}
        senderAddress={sendPreview.data?.sender ?? null}
        segmentLabel={NEWSLETTER_SEGMENTS.find((s) => s.key === segment)?.label ?? segment}
        recipientCount={sendPreview.data?.recipientCount ?? null}
        versionLabel={sendPreview.data?.versionLabel ?? null}
        resourceUrl={sendPreview.data?.resourceUrl ?? null}
        resourcePublished={Boolean(issue.published_at)}
        unsubscribeUrl="https://holiswiss.ch/desinscription"
        langLabel={
          NEWSLETTER_LANG_LABELS[(form.lang || "fr") as (typeof NEWSLETTER_LANGS)[number]] ??
          form.lang
        }
        scheduledAt={
          form.target_date ? new Date(form.target_date).toLocaleDateString("fr-CH") : null
        }
        featureHighlight={form.feature_highlight}
        emailHtml={previewHtml}
        emailText={previewText}
        resource={{
          title: form.resource_title,
          intro: form.resource_intro,
          body: form.resource_body,
          sections: form.resource_sections,
          takeaway: form.resource_takeaway,
          cta: form.resource_cta,
          seoTitle: form.seo_title,
          metaDescription: form.meta_description,
          slug: form.slug,
          linkedResourceSlug: form.linked_resource_slug,
        }}
        privatePreviewUrl={
          typeof window !== "undefined"
            ? `${window.location.origin}/admin/newsletter/${id}`
            : `/admin/newsletter/${id}`
        }
        onValidated={() => setCheckedVersion(emailVersion)}
        onGoto={(t: SendPreviewTab) => setTab(t)}
      />

      {/* Confirmation des changements de statut sensibles */}
      <AlertDialog open={confirmTestOpen} onOpenChange={setConfirmTestOpen}>
        <AlertDialogContent className="bg-[#1d0d3d] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Envoyer un email de test à cette adresse ?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/65">
              Un seul email part, à l'adresse{" "}
              <span className="font-semibold text-white break-all">{testTarget}</span>. Aucun
              destinataire du segment n'est contacté, le statut de la newsletter reste inchangé et
              l'envoi est enregistré comme « Test envoyé ».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11 border-white/15 bg-transparent text-white hover:bg-white/10">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-[#b86ef9] hover:bg-[#a355f0] text-white"
              onClick={() => {
                setConfirmTestOpen(false);
                sendTest.mutate();
              }}
            >
              Envoyer le test
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmStatus !== null} onOpenChange={(o) => !o && setConfirmStatus(null)}>
        <AlertDialogContent className="bg-[#1d0d3d] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmStatus === "archivee" ? "Archiver cette newsletter ?" : "Rejeter ce brief ?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/65">
              {confirmStatus === "archivee"
                ? "La newsletter sort du flux de travail et l'édition est verrouillée. Aucun contenu n'est supprimé et un administrateur peut la repasser en brouillon."
                : "Le brief repasse au statut « Idée ». Aucun contenu n'est supprimé et vous pourrez le reprendre à tout moment."}
              {" Aucun email n'est envoyé par cette action."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11 border-white/15 bg-transparent text-white hover:bg-white/10">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-[#b86ef9] hover:bg-[#a355f0] text-white"
              onClick={() => {
                if (confirmStatus) changeStatus.mutate(confirmStatus);
                setConfirmStatus(null);
              }}
            >
              {confirmStatus === "archivee" ? "Archiver" : "Rejeter"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
