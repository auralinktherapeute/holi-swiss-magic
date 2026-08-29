import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, XCircle, FileText, AlertTriangle, HelpCircle, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { listCertificationsToReview, reviewCertification } from "@/lib/admin-certifications.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type Tab = "declared" | "verified" | "rejected" | "needs_information" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "declared", label: "À valider" },
  { key: "verified", label: "Vérifiés" },
  { key: "rejected", label: "Refusés" },
  { key: "needs_information", label: "Informations demandées" },
  { key: "all", label: "Tous" },
];

const REASONS = [
  "Justificatif illisible ou incomplet",
  "Diplôme non reconnu ou non vérifiable",
  "Informations insuffisantes",
  "Document ne correspondant pas à la formation déclarée",
];

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";

type Pending = {
  id: string;
  name: string;
  decision: "verified" | "rejected" | "needs_information" | "reset";
};

/**
 * Modération des diplômes : onglets par statut, confirmation avant validation,
 * motif obligatoire au refus et à la révocation. Toute décision est persistée
 * et journalisée côté base (table `diploma_verification_history`).
 */
export default function CertificationsReviewPanel() {
  const load = useServerFn(listCertificationsToReview);
  const decide = useServerFn(reviewCertification);
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>("declared");
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-certifications-review", tab],
    queryFn: () => load({ data: { status: tab } }),
    staleTime: 30_000,
  });

  const mutate = useMutation({
    mutationFn: (v: Pending & { reason?: string | null; note?: string | null }) =>
      decide({ data: { id: v.id, decision: v.decision, reason: v.reason ?? null, note: v.note ?? null } }),
    onSuccess: (_r, v) => {
      toast.success(
        v.decision === "verified"
          ? "Diplôme vérifié avec succès."
          : v.decision === "rejected"
            ? "Diplôme refusé. Le thérapeute peut consulter le motif dans son espace."
            : v.decision === "needs_information"
              ? "Informations complémentaires demandées."
              : "Diplôme repassé en attente.",
      );
      setPending(null);
      setReason("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["admin-certifications-review"] });
    },
    onError: (e: any) => {
      console.error("[CertificationsReviewPanel]", e);
      toast.error(e?.message ?? "Impossible de vérifier le diplôme. Veuillez réessayer.");
    },
  });

  const rows = data?.rows ?? [];
  const counts = data?.counts ?? {};
  const needsReason = pending?.decision === "rejected" || pending?.decision === "reset";

  const open = (id: string, name: string, decision: Pending["decision"]) => {
    setReason("");
    setNote("");
    setPending({ id, name, decision });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BadgeCheck className="h-4 w-4" aria-hidden />
          Diplômes
          <span className="text-sm text-muted-foreground">({counts["declared"] ?? 0} à valider)</span>
        </CardTitle>
        <div className="mt-3 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={`min-h-[44px] rounded-full border px-4 text-xs font-medium transition-colors ${
                tab === t.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.label} {typeof counts[t.key] === "number" ? `(${counts[t.key]})` : ""}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {!isLoading && rows.length === 0 && <p className="text-sm text-muted-foreground">Aucun diplôme dans cette liste.</p>}

        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-border p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.therapistName}
                  {r.issuer ? ` · ${r.issuer}` : ""}
                  {r.year ? ` · ${r.year}` : ""}
                </p>

                {r.status === "verified" && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-500">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                    Vérifié le {fmt(r.verifiedAt)}
                    {r.verifiedByLabel ? ` · ${r.verifiedByLabel}` : ""}
                  </p>
                )}
                {r.status === "rejected" && (
                  <p className="mt-2 inline-flex items-start gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400">
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    Refusé le {fmt(r.rejectedAt)}
                    {r.rejectionReason ? ` — ${r.rejectionReason}` : ""}
                  </p>
                )}
                {r.status === "needs_information" && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-500">
                    <HelpCircle className="h-3.5 w-3.5" aria-hidden />
                    Informations demandées
                  </p>
                )}

                {r.status === "declared" && (
                  <p
                    className={`mt-2 flex items-start gap-1.5 text-xs ${
                      r.autoCheck.verdict === "incomplete" ? "text-orange-500" : "text-emerald-500"
                    }`}
                  >
                    {r.autoCheck.verdict === "incomplete" ? (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    ) : (
                      <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    )}
                    {r.autoCheck.summary}
                  </p>
                )}

                {r.fileUrl && (
                  <a
                    href={r.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-primary underline underline-offset-2"
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                    Voir le justificatif
                  </a>
                )}
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                {(r.status === "declared" || r.status === "needs_information") && (
                  <>
                    <Button size="sm" disabled={mutate.isPending} onClick={() => open(r.id, r.name, "verified")}>
                      <BadgeCheck className="mr-1.5 h-4 w-4" aria-hidden />
                      Vérifier
                    </Button>
                    {r.status === "declared" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={mutate.isPending}
                        onClick={() => open(r.id, r.name, "needs_information")}
                      >
                        <HelpCircle className="mr-1.5 h-4 w-4" aria-hidden />
                        Demander des informations
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={mutate.isPending}
                      onClick={() => open(r.id, r.name, "rejected")}
                    >
                      <XCircle className="mr-1.5 h-4 w-4" aria-hidden />
                      Refuser
                    </Button>
                  </>
                )}

                {r.status === "verified" && (
                  <Button size="sm" variant="outline" disabled={mutate.isPending} onClick={() => open(r.id, r.name, "reset")}>
                    <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
                    Révoquer la validation
                  </Button>
                )}

                {r.status === "rejected" && (
                  <Button size="sm" variant="outline" disabled={mutate.isPending} onClick={() => open(r.id, r.name, "reset")}>
                    <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
                    Repasser en attente
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.decision === "verified"
                ? "Confirmer la vérification de ce diplôme ?"
                : pending?.decision === "rejected"
                  ? "Refuser ce diplôme"
                  : pending?.decision === "needs_information"
                    ? "Demander des informations complémentaires"
                    : "Repasser ce diplôme en attente"}
            </DialogTitle>
            <DialogDescription>
              {pending?.decision === "verified"
                ? "Cette action validera le diplôme sur le profil du thérapeute."
                : pending?.decision === "rejected"
                  ? "Le motif sera visible par le thérapeute dans son espace, jamais publiquement."
                  : "Indiquez le motif de cette décision."}
              {pending ? ` — « ${pending.name} »` : ""}
            </DialogDescription>
          </DialogHeader>

          {(needsReason || pending?.decision === "needs_information") && (
            <div className="space-y-2">
              {pending?.decision === "rejected" && (
                <div className="flex flex-wrap gap-2">
                  {REASONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setReason(m)}
                      className={`min-h-[36px] rounded-full border px-3 text-xs ${
                        reason === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
              <label htmlFor="cert-reason" className="text-xs font-medium text-muted-foreground">
                Motif {needsReason ? "(obligatoire)" : "(facultatif)"}
              </label>
              <Textarea id="cert-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="cert-note" className="text-xs font-medium text-muted-foreground">
              Note interne (facultative)
            </label>
            <Textarea id="cert-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={mutate.isPending}>
              Annuler
            </Button>
            <Button
              disabled={mutate.isPending || (needsReason && reason.trim().length === 0)}
              onClick={() =>
                pending &&
                mutate.mutate({
                  ...pending,
                  reason: reason.trim() ? reason.trim() : null,
                  note: note.trim() ? note.trim() : null,
                })
              }
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
