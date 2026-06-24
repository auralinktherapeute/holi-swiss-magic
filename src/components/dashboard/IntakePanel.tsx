import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, ExternalLink, UserPlus, Archive, Trash2, ChevronDown, ChevronUp, ClipboardList, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  listMyIntakes, convertIntake, archiveIntake, deleteIntake, type IntakeSubmission,
} from "@/lib/intake.functions";

export default function IntakePanel({ slug }: { slug: string | null }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyIntakes);
  const convertFn = useServerFn(convertIntake);
  const archiveFn = useServerFn(archiveIntake);
  const delFn = useServerFn(deleteIntake);

  const q = useQuery({ queryKey: ["crm-intakes"], queryFn: () => listFn() });
  const [openId, setOpenId] = useState<string | null>(null);

  const intakeUrl = slug ? `${typeof window !== "undefined" ? window.location.origin : "https://holiswiss.ch"}/intake/${slug}` : "";

  const convertMut = useMutation({
    mutationFn: (id: string) => convertFn({ data: { id } }),
    onSuccess: () => { toast.success("Contact créé dans le CRM"); qc.invalidateQueries({ queryKey: ["crm-intakes"] }); qc.invalidateQueries({ queryKey: ["crm-contacts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const archiveMut = useMutation({
    mutationFn: (id: string) => archiveFn({ data: { id } }),
    onSuccess: () => { toast.success("Archivé"); qc.invalidateQueries({ queryKey: ["crm-intakes"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Supprimé"); qc.invalidateQueries({ queryKey: ["crm-intakes"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = async () => {
    try { await navigator.clipboard.writeText(intakeUrl); toast.success("Lien copié"); }
    catch { toast.error("Impossible de copier"); }
  };

  const items = (q.data ?? []) as IntakeSubmission[];
  const newCount = items.filter(i => i.status === "new").length;

  return (
    <div className="space-y-5">
      {/* Share link */}
      <div className="bg-surface border border-border/60 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Votre lien d'admission</h3>
        </div>
        <p className="text-xs text-muted-foreground">Partagez ce lien à vos nouveaux patients pour qu'ils remplissent leur questionnaire pré-séance. Les réponses arrivent automatiquement ici.</p>
        {slug ? (
          <div className="flex gap-2 items-stretch">
            <input readOnly value={intakeUrl} className="flex-1 bg-background border border-border/60 rounded-md px-3 py-2 text-sm font-mono text-foreground truncate" />
            <Button type="button" size="sm" variant="secondary" onClick={copy}><Copy className="h-3.5 w-3.5 mr-1" /> Copier</Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <a href={intakeUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Ouvrir</a>
            </Button>
          </div>
        ) : (
          <p className="text-xs text-amber-400">Votre profil n'a pas encore de slug public — complétez votre fiche thérapeute pour activer le lien.</p>
        )}
      </div>

      {/* Submissions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Soumissions reçues</h3>
          {newCount > 0 && <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/40">{newCount} nouveau{newCount > 1 ? "x" : ""}</Badge>}
        </div>
        <span className="text-xs text-muted-foreground">{items.length} au total</span>
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {!q.isLoading && items.length === 0 && (
        <div className="text-center py-10 bg-surface/50 border border-dashed border-border/60 rounded-xl">
          <p className="text-sm text-muted-foreground">Aucun formulaire reçu pour l'instant.</p>
        </div>
      )}

      <div className="space-y-2">
        {items.map((s) => {
          const open = openId === s.id;
          return (
            <div key={s.id} className="bg-surface border border-border/60 rounded-xl overflow-hidden">
              <button type="button" onClick={() => setOpenId(open ? null : s.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition text-left">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground truncate">{s.first_name} {s.last_name}</span>
                    {s.status === "new" && <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px]">Nouveau</Badge>}
                    {s.status === "converted" && <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px]">Converti</Badge>}
                    {s.status === "archived" && <Badge variant="secondary" className="text-[10px]">Archivé</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{s.email}{s.phone ? ` · ${s.phone}` : ""} · {new Date(s.created_at).toLocaleDateString("fr-CH", { day: "2-digit", month: "long", year: "numeric" })}</p>
                </div>
                {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>

              {open && (
                <div className="border-t border-border/40 p-4 space-y-3 bg-background/40">
                  <Detail label="Date de naissance" value={s.birth_date} />
                  <Detail label="Motif de consultation" value={s.consultation_reason} long />
                  <Detail label="Antécédents médicaux" value={s.medical_history} long />
                  <Detail label="Médicaments" value={s.medications} long />
                  <Detail label="Allergies" value={s.allergies} long />
                  <div className="text-xs text-muted-foreground border-t border-border/40 pt-2">
                    Consentement RGPD signé par <span className="text-foreground font-medium">{s.consent_signature}</span>
                    {s.consent_at && ` le ${new Date(s.consent_at).toLocaleString("fr-CH")}`}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {s.status === "new" && (
                      <Button type="button" size="sm" onClick={() => convertMut.mutate(s.id)} disabled={convertMut.isPending}>
                        <UserPlus className="h-3.5 w-3.5 mr-1" /> Créer la fiche client
                      </Button>
                    )}
                    {s.status !== "archived" && (
                      <Button type="button" size="sm" variant="outline" onClick={() => archiveMut.mutate(s.id)}>
                        <Archive className="h-3.5 w-3.5 mr-1" /> Archiver
                      </Button>
                    )}
                    <Button type="button" size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => { if (confirm("Supprimer cette soumission ?")) delMut.mutate(s.id); }}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Supprimer
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Detail({ label, value, long }: { label: string; value: string | null | undefined; long?: boolean }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm text-foreground ${long ? "whitespace-pre-wrap" : ""}`}>{value}</p>
    </div>
  );
}