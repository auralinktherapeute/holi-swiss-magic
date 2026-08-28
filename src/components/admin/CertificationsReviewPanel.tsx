import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, XCircle, FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { listCertificationsToReview, reviewCertification } from "@/lib/admin-certifications.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Diplômes en attente de validation administrateur.
 * Chaque ligne affiche le résultat de la pré-vérification automatique
 * (organisme reconnu, justificatif joint, année plausible).
 */
export default function CertificationsReviewPanel() {
  const load = useServerFn(listCertificationsToReview);
  const decide = useServerFn(reviewCertification);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-certifications-review"],
    queryFn: () => load(),
    staleTime: 30_000,
  });

  const mutate = useMutation({
    mutationFn: (v: { id: string; decision: "verified" | "rejected" }) => decide({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.decision === "verified" ? "Diplôme vérifié" : "Diplôme refusé");
      qc.invalidateQueries({ queryKey: ["admin-certifications-review"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Action impossible"),
  });

  const rows = data?.rows ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BadgeCheck className="h-4 w-4" aria-hidden />
          Diplômes à valider {rows.length > 0 && <span className="text-sm text-muted-foreground">({rows.length})</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {!isLoading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun diplôme en attente de validation.</p>
        )}

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
                <Button
                  size="sm"
                  disabled={mutate.isPending}
                  onClick={() => mutate.mutate({ id: r.id, decision: "verified" })}
                >
                  <BadgeCheck className="mr-1.5 h-4 w-4" aria-hidden />
                  Vérifier
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={mutate.isPending}
                  onClick={() => mutate.mutate({ id: r.id, decision: "rejected" })}
                >
                  <XCircle className="mr-1.5 h-4 w-4" aria-hidden />
                  Refuser
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
