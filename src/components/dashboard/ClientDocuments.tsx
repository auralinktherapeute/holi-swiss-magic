// L4 — Documents rattachés à un client + modèles imprimables.
// Les fichiers vont dans un bucket privé (jamais d'URL publique) et sont
// consultés via un lien signé de courte durée. Chaque accès est journalisé.

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  FileText, Upload, Trash2, ExternalLink, Printer, ShieldAlert, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteClientDoc, getClientDocUrl, getDocumentTemplateContext, listClientDocs,
  registerClientDoc,
} from "@/lib/cabinet.functions";
import {
  TEMPLATES, renderTemplate, type TemplateId,
} from "@/lib/cabinet-document-templates";

const BUCKET = "therapist-documents";
const MAX_BYTES = 10 * 1024 * 1024;

const DOC_TYPE_LABEL: Record<string, string> = {
  consentement: "Consentement",
  attestation: "Attestation",
  recu: "Reçu",
  bilan: "Bilan",
  correspondance: "Correspondance",
  autre: "Autre",
};

function safeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(-80);
}

function shortDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-CH", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ClientDocuments({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listClientDocs);
  const registerFn = useServerFn(registerClientDoc);
  const urlFn = useServerFn(getClientDocUrl);
  const deleteFn = useServerFn(deleteClientDoc);
  const ctxFn = useServerFn(getDocumentTemplateContext);

  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<string>("consentement");
  const [label, setLabel] = useState("");
  const [isHealth, setIsHealth] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [template, setTemplate] = useState<TemplateId>("attestation");
  const [amount, setAmount] = useState("");

  const { data: docs, isLoading } = useQuery({
    queryKey: ["client-docs", clientId],
    queryFn: () => listFn({ data: { client_id: clientId } }),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["client-docs", clientId] });
    qc.invalidateQueries({ queryKey: ["cabinet-client", clientId] });
  };

  async function handleUpload(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error("Fichier trop volumineux (10 Mo maximum).");
      return;
    }
    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Session expirée, reconnectez-vous.");
      // Le premier dossier doit être l'identifiant utilisateur (règle du bucket).
      const path = `${uid}/clients/${clientId}/${Date.now()}-${safeName(file.name)}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "0",
        upsert: false,
      });
      if (error) throw new Error(error.message);
      await registerFn({
        data: {
          client_id: clientId,
          path,
          file_name: file.name.slice(-255),
          label: label.trim() || null,
          doc_type: docType as any,
          is_health_data: isHealth,
        },
      });
      setLabel("");
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Document ajouté au dossier client.");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Échec du téléversement.");
    } finally {
      setUploading(false);
    }
  }

  const open = useMutation({
    mutationFn: (id: string) => urlFn({ data: { id } }),
    onSuccess: (res: any) => {
      window.open(res.url, "_blank", "noopener,noreferrer");
    },
    onError: (e: any) => toast.error(e?.message ?? "Lien indisponible."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Document supprimé.");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Suppression impossible."),
  });

  const print = useMutation({
    mutationFn: async () => {
      const ctx: any = await ctxFn({ data: { client_id: clientId } });
      const parsed = Number(amount.replace(",", "."));
      return renderTemplate(template, ctx, {
        amount: template === "recu" && Number.isFinite(parsed) ? parsed : null,
      });
    },
    onSuccess: (html: string) => {
      const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
      if (!w) {
        toast.error("Autorisez les fenêtres pop-up pour imprimer le document.");
        return;
      }
      w.document.write(html);
      w.document.close();
      w.focus();
      window.setTimeout(() => w.print(), 300);
    },
    onError: (e: any) => toast.error(e?.message ?? "Génération impossible."),
  });

  const rows = docs ?? [];

  return (
    <section className="rounded-lg border border-border p-3 space-y-4">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <FileText className="h-4 w-4" aria-hidden="true" /> Documents du dossier
      </h3>

      {isLoading && <Skeleton className="h-16 w-full" />}

      {!isLoading && rows.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Aucun document rattaché. Les fichiers ajoutés ici restent privés : seuls vous
          et personne d'autre pouvez les ouvrir.
        </p>
      )}

      {!isLoading && rows.length > 0 && (
        <ul className="divide-y divide-border">
          {rows.map((d: any) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="flex-1 min-w-[160px] truncate">{d.label || d.file_name}</span>
              <Badge variant="secondary">{DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type}</Badge>
              {d.is_health_data && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                  <ShieldAlert className="h-3 w-3" aria-hidden="true" /> santé
                </span>
              )}
              <span className="text-xs text-muted-foreground w-24">{shortDate(d.created_at)}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11 md:min-h-9"
                disabled={open.isPending}
                onClick={() => open.mutate(d.id)}
                aria-label={`Ouvrir ${d.label || d.file_name}`}
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="min-h-11 md:min-h-9 text-destructive"
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm("Supprimer définitivement ce document ?")) remove.mutate(d.id);
                }}
                aria-label={`Supprimer ${d.label || d.file_name}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Ajout d'un document */}
      <div className="rounded-md bg-muted/40 p-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="doc-type" className="text-xs">Type de document</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger id="doc-type" className="mt-1 min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DOC_TYPE_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="doc-label" className="text-xs">Intitulé (optionnel)</Label>
            <Input
              id="doc-label"
              className="mt-1 min-h-11"
              placeholder="Consentement signé, bilan initial…"
              value={label}
              maxLength={255}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id="doc-health"
            checked={isHealth}
            onCheckedChange={(v) => setIsHealth(v === true)}
          />
          <Label htmlFor="doc-health" className="text-xs leading-snug">
            Contient des données de santé (conservation et accès restreints)
          </Label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            id="doc-file"
            type="file"
            className="sr-only"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
            }}
          />
          <Button
            type="button"
            className="min-h-11"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
            )}
            {uploading ? "Téléversement…" : "Ajouter un fichier"}
          </Button>
          <span className="text-xs text-muted-foreground">PDF ou image, 10 Mo maximum.</span>
        </div>
      </div>

      {/* Modèles imprimables */}
      <div className="rounded-md border border-border p-3 space-y-3">
        <div className="text-sm font-medium">Générer un document</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="doc-template" className="text-xs">Modèle</Label>
            <Select value={template} onValueChange={(v) => setTemplate(v as TemplateId)}>
              <SelectTrigger id="doc-template" className="mt-1 min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {template === "recu" && (
            <div>
              <Label htmlFor="doc-amount" className="text-xs">Montant reçu</Label>
              <Input
                id="doc-amount"
                className="mt-1 min-h-11"
                inputMode="decimal"
                placeholder="120.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {TEMPLATES.find((t) => t.id === template)?.description}
        </p>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={print.isPending}
          onClick={() => print.mutate()}
        >
          {print.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
          ) : (
            <Printer className="h-4 w-4 mr-2" aria-hidden="true" />
          )}
          Aperçu et impression
        </Button>
      </div>
    </section>
  );
}
