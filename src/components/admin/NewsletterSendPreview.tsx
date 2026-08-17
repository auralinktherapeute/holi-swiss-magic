// Prévisualisation obligatoire avant tout envoi de « La Lettre Holiswiss ».
// Aperçu email (desktop / mobile / texte brut), aperçu page ressource,
// et checklist bloquante de validation humaine.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Monitor,
  Smartphone,
  ExternalLink,
  Copy,
  PencilLine,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type SendPreviewTab = "brief" | "email" | "resource" | "seo" | "qc";

/** Checklist bloquante avant envoi — chaque point renvoie vers l'onglet de correction. */
export const SEND_CHECKLIST = [
  { key: "subject", label: "Objet vérifié", tab: "email" },
  { key: "preheader", label: "Pré-header vérifié", tab: "email" },
  { key: "sender", label: "Expéditeur vérifié", tab: "email" },
  { key: "content", label: "Contenu relu", tab: "email" },
  { key: "lang", label: "Langue vérifiée", tab: "brief" },
  { key: "segment", label: "Segment vérifié", tab: "send" },
  { key: "recipients", label: "Nombre de destinataires vérifié", tab: "send" },
  { key: "resource", label: "Page ressource disponible", tab: "resource" },
  { key: "links", label: "Liens vérifiés", tab: "qc" },
  { key: "cta", label: "Appel à l'action vérifié", tab: "email" },
  { key: "unsubscribe", label: "Lien de désinscription présent", tab: "email" },
  { key: "privacy", label: "Politique de confidentialité présente", tab: "email" },
  { key: "mobile", label: "Version mobile vérifiée", tab: "email" },
  { key: "plaintext", label: "Version texte brut vérifiée", tab: "email" },
  { key: "no_promise", label: "Aucune promesse non validée", tab: "qc" },
  { key: "no_fake_data", label: "Aucune donnée fictive", tab: "qc" },
  { key: "no_confidential", label: "Aucune information confidentielle", tab: "qc" },
  { key: "human", label: "Validation humaine effectuée", tab: "qc" },
] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Identité de l'envoi */
  newsletterName: string;
  subject: string;
  preheader: string;
  senderName?: string;
  senderAddress: string | null;
  replyTo?: string;
  segmentLabel: string;
  recipientCount: number | null;
  versionLabel: string | null;
  resourceUrl: string | null;
  resourcePublished: boolean;
  unsubscribeUrl: string;
  langLabel: string;
  scheduledAt: string | null;
  featureHighlight: string;
  /** Contenus */
  emailHtml: string;
  emailText: string;
  resource: {
    title: string;
    intro: string;
    body: string;
    sections: string;
    takeaway: string;
    cta: string;
    seoTitle: string;
    metaDescription: string;
    slug: string;
    linkedResourceSlug: string;
  };
  privatePreviewUrl: string;
  /** Callbacks */
  onValidated: () => void;
  onGoto: (tab: SendPreviewTab) => void;
};

export function NewsletterSendPreview(props: Props) {
  const {
    open,
    onOpenChange,
    newsletterName,
    subject,
    preheader,
    senderName = "HoliSwiss",
    senderAddress,
    replyTo = "contact@holiswiss.ch",
    segmentLabel,
    recipientCount,
    versionLabel,
    resourceUrl,
    resourcePublished,
    unsubscribeUrl,
    langLabel,
    scheduledAt,
    featureHighlight,
    emailHtml,
    emailText,
    resource,
    privatePreviewUrl,
    onValidated,
    onGoto,
  } = props;

  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  const missing = useMemo(() => SEND_CHECKLIST.filter((i) => !checks[i.key]), [checks]);
  const allChecked = missing.length === 0;

  const summary: Array<{ label: string; value: string }> = [
    { label: "Newsletter", value: newsletterName || "—" },
    { label: "Objet", value: subject || "—" },
    { label: "Pré-header", value: preheader || "—" },
    { label: "Expéditeur", value: `${senderName} <${senderAddress ?? "non configuré"}>` },
    { label: "Adresse de réponse", value: replyTo },
    { label: "Segment ciblé", value: segmentLabel },
    {
      label: "Destinataires",
      value: recipientCount === null ? "—" : `${recipientCount} destinataire(s)`,
    },
    { label: "Version envoyée", value: versionLabel ?? "—" },
    { label: "Page ressource", value: resourceUrl ?? "Non utilisée" },
    { label: "Lien de désinscription", value: unsubscribeUrl },
    { label: "Langue", value: langLabel },
    { label: "Date et heure prévue", value: scheduledAt || "Envoi immédiat après validation" },
    { label: "Fonctionnalité mise en avant", value: featureHighlight || "—" },
  ];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(privatePreviewUrl);
      toast.success("Lien d'aperçu privé copié (accessible aux administrateurs uniquement).");
    } catch {
      toast.error("Copie impossible. Sélectionnez le lien manuellement.");
    }
  };

  const goto = (tab: SendPreviewTab) => {
    onOpenChange(false);
    onGoto(tab);
  };

  const outlineBtn =
    "min-h-11 border-white/15 bg-transparent text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#b86ef9]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto bg-[#1d0d3d] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Prévisualisation avant envoi</DialogTitle>
          <DialogDescription className="text-white/60">
            Vérifiez la version exacte qui sera envoyée. Aucun email n'est envoyé depuis cette
            fenêtre.
          </DialogDescription>
        </DialogHeader>

        {/* Récapitulatif d'envoi */}
        <dl className="grid gap-x-6 gap-y-2 rounded-lg border border-white/10 bg-white/5 p-4 text-sm sm:grid-cols-2">
          {summary.map((row) => (
            <div key={row.label} className="flex flex-wrap justify-between gap-2">
              <dt className="text-white/50">{row.label}</dt>
              <dd className="break-all text-right text-white/85">{row.value}</dd>
            </div>
          ))}
        </dl>

        <Tabs defaultValue="email" className="space-y-4">
          <TabsList className="flex w-full flex-wrap justify-start gap-1 bg-white/5 p-1 h-auto">
            <TabsTrigger
              value="email"
              className="min-h-11 data-[state=active]:bg-[#b86ef9] data-[state=active]:text-white text-white/70"
            >
              Aperçu de l'email
            </TabsTrigger>
            <TabsTrigger
              value="resource"
              className="min-h-11 data-[state=active]:bg-[#b86ef9] data-[state=active]:text-white text-white/70"
            >
              Aperçu de la page ressource
            </TabsTrigger>
          </TabsList>

          {/* APERÇU EMAIL */}
          <TabsContent value="email" className="space-y-4">
            <Tabs defaultValue="html" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <TabsList className="bg-white/5 p-1 h-auto">
                  <TabsTrigger
                    value="html"
                    className="min-h-11 data-[state=active]:bg-white/15 text-white/70 data-[state=active]:text-white"
                  >
                    Version HTML
                  </TabsTrigger>
                  <TabsTrigger
                    value="text"
                    className="min-h-11 data-[state=active]:bg-white/15 text-white/70 data-[state=active]:text-white"
                  >
                    Version texte brut
                  </TabsTrigger>
                </TabsList>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    aria-label="Aperçu desktop"
                    aria-pressed={device === "desktop"}
                    onClick={() => setDevice("desktop")}
                    className={
                      device === "desktop"
                        ? "min-h-11 bg-[#b86ef9] hover:bg-[#a355f0] text-white"
                        : outlineBtn + " border"
                    }
                  >
                    <Monitor className="h-4 w-4 mr-2" aria-hidden="true" /> Desktop
                  </Button>
                  <Button
                    size="sm"
                    aria-label="Aperçu mobile"
                    aria-pressed={device === "mobile"}
                    onClick={() => setDevice("mobile")}
                    className={
                      device === "mobile"
                        ? "min-h-11 bg-[#b86ef9] hover:bg-[#a355f0] text-white"
                        : outlineBtn + " border"
                    }
                  >
                    <Smartphone className="h-4 w-4 mr-2" aria-hidden="true" /> Mobile
                  </Button>
                </div>
              </div>

              <TabsContent value="html">
                {/* Enveloppe visuelle : boîte de réception */}
                <div
                  className={
                    device === "mobile"
                      ? "mx-auto w-full max-w-[380px] rounded-2xl border border-white/15 bg-white/5 p-3"
                      : "w-full rounded-2xl border border-white/15 bg-white/5 p-3"
                  }
                >
                  <div className="mb-3 space-y-1 rounded-lg bg-white/5 p-3 text-xs">
                    <div>
                      <span className="text-white/45">De :</span>{" "}
                      <span className="text-white/90">
                        {senderName} &lt;{senderAddress ?? "non configuré"}&gt;
                      </span>
                    </div>
                    <div>
                      <span className="text-white/45">Répondre à :</span>{" "}
                      <span className="text-white/90">{replyTo}</span>
                    </div>
                    <div>
                      <span className="text-white/45">Objet :</span>{" "}
                      <span className="font-semibold text-white">{subject || "—"}</span>
                    </div>
                    <div>
                      <span className="text-white/45">Aperçu :</span>{" "}
                      <span className="text-white/70">{preheader || "—"}</span>
                    </div>
                  </div>
                  <iframe
                    title="Aperçu réaliste de l'email"
                    srcDoc={emailHtml}
                    className="h-[55vh] w-full rounded-lg border border-white/10 bg-white"
                  />
                </div>
              </TabsContent>

              <TabsContent value="text">
                <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-[#14082d] p-4 text-sm leading-relaxed text-white/85">
                  {emailText}
                </pre>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* APERÇU PAGE RESSOURCE */}
          <TabsContent value="resource" className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                asChild={Boolean(resourceUrl && resourcePublished)}
                disabled={!resourceUrl || !resourcePublished}
                className="min-h-11 bg-[#b86ef9] hover:bg-[#a355f0] text-white disabled:opacity-50"
              >
                {resourceUrl && resourcePublished ? (
                  <a href={resourceUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" /> Ouvrir l'aperçu
                    public
                  </a>
                ) : (
                  <span>
                    <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" /> Ouvrir l'aperçu
                    public
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={copyLink}
                aria-label="Copier le lien d'aperçu privé"
                className={outlineBtn}
              >
                <Copy className="h-4 w-4 mr-2" aria-hidden="true" /> Copier le lien d'aperçu
              </Button>
              <Button
                variant="outline"
                onClick={() => goto("resource")}
                aria-label="Modifier le contenu de la page ressource"
                className={outlineBtn}
              >
                <PencilLine className="h-4 w-4 mr-2" aria-hidden="true" /> Modifier le contenu
              </Button>
            </div>
            <p className="text-xs text-white/50">
              Le lien d'aperçu est réservé aux administrateurs : il n'est pas indexable et ne rend
              pas le brouillon public.
              {!resourcePublished &&
                " La page n'est pas encore publiée : l'aperçu public est indisponible."}
            </p>

            <div
              className={
                device === "mobile"
                  ? "mx-auto w-full max-w-[380px] rounded-2xl border border-white/15 bg-[#14082d] p-5"
                  : "w-full rounded-2xl border border-white/15 bg-[#14082d] p-5"
              }
            >
              <article className="space-y-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#d4a8ff]">
                  La Lettre Holiswiss · {langLabel}
                </p>
                <h3 className="text-2xl font-bold">{resource.title || "Titre de la page"}</h3>
                <p className="text-sm text-white/55">
                  {scheduledAt || new Date().toLocaleDateString("fr-CH")}
                </p>
                {resource.intro && (
                  <p className="whitespace-pre-line text-white/85">{resource.intro}</p>
                )}
                {resource.body && (
                  <p className="whitespace-pre-line text-white/70">{resource.body}</p>
                )}
                {resource.sections && (
                  <p className="whitespace-pre-line text-white/70">{resource.sections}</p>
                )}
                {resource.takeaway && (
                  <div className="rounded-lg border border-[#b86ef9]/30 bg-[#b86ef9]/10 p-4 text-sm">
                    <div className="mb-1 font-semibold">À retenir</div>
                    <p className="whitespace-pre-line text-white/75">{resource.takeaway}</p>
                  </div>
                )}
                {resource.cta && (
                  <span className="inline-block rounded-full bg-[#b86ef9] px-5 py-2.5 text-sm font-semibold">
                    {resource.cta}
                  </span>
                )}
              </article>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
                <p className="mb-1 font-semibold">SEO</p>
                <p className="text-white/70">Titre : {resource.seoTitle || "—"}</p>
                <p className="text-white/70">Meta : {resource.metaDescription || "—"}</p>
                <p className="break-all text-white/70">URL : {resourceUrl ?? "—"}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
                <p className="mb-1 font-semibold">Contenus associés</p>
                <p className="text-white/70">
                  {resource.linkedResourceSlug
                    ? `Ressource liée : ${resource.linkedResourceSlug}`
                    : "Aucun article associé."}
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* CHECKLIST BLOQUANTE */}
        <section className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Checklist avant envoi</h3>
            <Badge
              className={
                allChecked
                  ? "bg-[#4ade80]/15 text-[#4ade80] border-0"
                  : "bg-[#fbbf24]/15 text-[#fbbf24] border-0"
              }
            >
              {SEND_CHECKLIST.length - missing.length}/{SEND_CHECKLIST.length}
            </Badge>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {SEND_CHECKLIST.map((item) => (
              <li key={item.key} className="flex items-start gap-3">
                <Checkbox
                  id={`chk-${item.key}`}
                  checked={!!checks[item.key]}
                  onCheckedChange={(v) =>
                    setChecks((c) => ({ ...c, [item.key]: v === true }))
                  }
                  className="mt-0.5"
                />
                <Label
                  htmlFor={`chk-${item.key}`}
                  className="text-sm leading-relaxed text-white/80"
                >
                  {item.label}
                </Label>
              </li>
            ))}
          </ul>

          {missing.length > 0 && (
            <div className="rounded-lg border border-[#fbbf24]/40 bg-[#fbbf24]/10 p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-[#fbbf24]">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" /> {missing.length} élément(s)
                à vérifier
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {missing.map((m) => (
                  <li key={m.key}>
                    <button
                      type="button"
                      onClick={() => goto(m.tab as SendPreviewTab)}
                      className="min-h-9 rounded-full border border-[#fbbf24]/40 px-3 py-1 text-xs text-[#fbbf24] underline underline-offset-2 hover:bg-[#fbbf24]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fbbf24]"
                    >
                      {m.label} — corriger
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className={outlineBtn}>
            Fermer sans valider
          </Button>
          <Button
            onClick={() => {
              onValidated();
              onOpenChange(false);
              toast.success("Prévisualisation validée : l'envoi est débloqué pour cette version.");
            }}
            disabled={!allChecked}
            className="min-h-11 bg-[#4ade80]/20 text-[#4ade80] hover:bg-[#4ade80]/30 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" aria-hidden="true" /> Valider la prévisualisation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
