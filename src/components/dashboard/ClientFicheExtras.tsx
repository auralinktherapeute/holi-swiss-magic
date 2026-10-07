import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Archive, ClipboardList, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteContact, updateContactStatus, upsertContact } from "@/lib/crm-therapist.functions";
import {
  emailQuestionnaireToClient, listMyQuestionnaires, listResponsesForContact,
} from "@/lib/questionnaires.functions";

const STATUSES = [
  ["prospect", "Prospect"], ["new", "Nouveau"], ["active", "Actif"],
  ["followup", "À relancer"], ["inactive", "Inactif / archivé"],
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9 ().-]{6,20}$/;

function invalidate(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: ["cabinet-clients"] });
  if (id) qc.invalidateQueries({ queryKey: ["cabinet-client", id] });
}

/** Statut + Archiver + Supprimer, en haut de la fiche. */
export function ClientActionsBar({ client, counts, onDeleted }: {
  client: any;
  counts: { invoices: number; appointments: number; documents: number };
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const statusFn = useServerFn(updateContactStatus);
  const delFn = useServerFn(deleteContact);
  const [confirmDel, setConfirmDel] = useState(false);

  const status = useMutation({
    mutationFn: (s: string) => statusFn({ data: { id: client.id, relation_status: s as any } }),
    onSuccess: () => { toast.success("Statut mis à jour."); invalidate(qc, client.id); },
    onError: () => toast.error("Échec du changement de statut."),
  });
  const del = useMutation({
    mutationFn: () => delFn({ data: { id: client.id } }),
    onSuccess: () => { toast.success("Client supprimé."); invalidate(qc); onDeleted(); },
    onError: () => toast.error("Suppression impossible. Archivez plutôt ce client."),
  });

  const hasInvoices = counts.invoices > 0;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[180px]">
        <Label htmlFor="fiche-status" className="text-xs">Statut</Label>
        <Select value={client.relation_status} onValueChange={(v) => status.mutate(v)} disabled={status.isPending}>
          <SelectTrigger id="fiche-status" className="mt-1 min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {client.relation_status !== "inactive" && (
        <Button variant="outline" className="min-h-11" disabled={status.isPending} onClick={() => status.mutate("inactive")}>
          <Archive className="h-4 w-4 mr-1.5" aria-hidden="true" /> Archiver
        </Button>
      )}
      <Button variant="outline" className="min-h-11 text-destructive" onClick={() => setConfirmDel(true)}>
        <Trash2 className="h-4 w-4 mr-1.5" aria-hidden="true" /> Supprimer
      </Button>

      <Dialog open={confirmDel} onOpenChange={setConfirmDel}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Supprimer ce client ?</DialogTitle></DialogHeader>
          <div className="text-sm space-y-2">
            <p>Éléments liés : {counts.invoices} facture(s), {counts.appointments} rendez-vous, {counts.documents} document(s).</p>
            {hasInvoices ? (
              <p className="text-destructive">
                Ce client a des factures : la loi impose de les conserver. La suppression est bloquée —
                archivez-le à la place.
              </p>
            ) : (
              <p className="text-muted-foreground">Cette action est définitive.</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="min-h-11" onClick={() => setConfirmDel(false)}>Annuler</Button>
            {hasInvoices ? (
              <Button className="min-h-11" onClick={() => { status.mutate("inactive"); setConfirmDel(false); }}>Archiver</Button>
            ) : (
              <Button variant="destructive" className="min-h-11" disabled={del.isPending} onClick={() => del.mutate()}>
                {del.isPending ? "Suppression…" : "Supprimer définitivement"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Bouton « Nouveau client » + formulaire court. */
export function NewClientButton({ onCreated }: { onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const fn = useServerFn(upsertContact);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ first_name: "", last_name: "", email: "", phone: "" });
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => fn({ data: {
      first_name: f.first_name.trim(), last_name: f.last_name.trim(),
      email: f.email.trim() || null, phone: f.phone.trim() || null, relation_status: "prospect",
    } as any }),
    onSuccess: (row: any) => {
      toast.success("Client créé."); invalidate(qc); setOpen(false);
      setF({ first_name: "", last_name: "", email: "", phone: "" });
      if (row?.id) onCreated(row.id);
    },
    onError: () => setErr("Échec de la création. Réessayez."),
  });
  return (
    <>
      <Button className="min-h-11" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" /> Nouveau client
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
          <form noValidate className="grid gap-3" onSubmit={(e) => {
            e.preventDefault(); setErr(null);
            if (!f.first_name.trim()) return setErr("Le prénom est requis.");
            if (f.email && !EMAIL_RE.test(f.email.trim())) return setErr("Adresse e-mail invalide.");
            if (f.phone && !PHONE_RE.test(f.phone.trim())) return setErr("Numéro de téléphone invalide.");
            save.mutate();
          }}>
            {([["first_name", "Prénom *", "text"], ["last_name", "Nom", "text"], ["email", "E-mail", "email"], ["phone", "Téléphone", "tel"]] as const).map(([k, l, t]) => (
              <div key={k}>
                <Label htmlFor={`nc-${k}`}>{l}</Label>
                <Input id={`nc-${k}`} type={t} className="mt-1 min-h-11" value={f[k]}
                  onChange={(e) => setF((p) => ({ ...p, [k]: e.target.value }))} />
              </div>
            ))}
            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" className="min-h-11" disabled={save.isPending}>{save.isPending ? "Création…" : "Créer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Onglet Questionnaires : réponses reçues + envoi avec aperçu et confirmation. */
export function ClientQuestionnaires({ client }: { client: any }) {
  const respFn = useServerFn(listResponsesForContact);
  const listFn = useServerFn(listMyQuestionnaires);
  const sendFn = useServerFn(emailQuestionnaireToClient);
  const [qid, setQid] = useState("");
  const [preview, setPreview] = useState(false);

  const responses = useQuery({ queryKey: ["client-q-resp", client.id], queryFn: () => respFn({ data: { contact_id: client.id } }) });
  const qs = useQuery({ queryKey: ["my-questionnaires"], queryFn: () => listFn() });
  const active = (qs.data ?? []).filter((q: any) => q.actif);
  const chosen = active.find((q: any) => q.id === qid);

  const send = useMutation({
    mutationFn: () => sendFn({ data: { questionnaire_id: qid, to: client.email, origin: window.location.origin } }),
    onSuccess: () => { toast.success(`Questionnaire envoyé à ${client.email}.`); setPreview(false); },
    onError: (e: any) => toast.error(`Envoi échoué : ${String(e?.message ?? "erreur inconnue").slice(0, 120)}`),
  });

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-border p-3 space-y-2">
        <h3 className="text-sm font-medium flex items-center gap-2"><ClipboardList className="h-4 w-4" aria-hidden="true" /> Envoyer un questionnaire</h3>
        {!client.email ? (
          <p className="text-xs text-amber-500">Ajoutez d'abord une adresse e-mail à ce client.</p>
        ) : active.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun questionnaire actif. Créez-en un dans « Questionnaires ».</p>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="q-pick" className="text-xs">Questionnaire</Label>
              <Select value={qid} onValueChange={setQid}>
                <SelectTrigger id="q-pick" className="mt-1 min-h-11"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>{active.map((q: any) => <SelectItem key={q.id} value={q.id}>{q.titre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="min-h-11" disabled={!qid} onClick={() => setPreview(true)}>Envoyer…</Button>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border p-3">
        <h3 className="text-sm font-medium mb-1">Réponses reçues</h3>
        {responses.isLoading ? <p className="text-xs text-muted-foreground">Chargement…</p>
          : (responses.data ?? []).length === 0 ? <p className="text-xs text-muted-foreground">Aucune réponse pour l'instant.</p>
          : (
            <ul className="divide-y divide-border">
              {(responses.data ?? []).map((r: any) => (
                <li key={r.id} className="flex flex-wrap justify-between gap-2 py-1.5 text-sm">
                  <span>{r.questionnaires?.titre ?? "Questionnaire"}</span>
                  <span className="text-muted-foreground">{r.date_soumission ? new Date(r.date_soumission).toLocaleDateString("fr-CH") : "—"}</span>
                  <Badge variant="secondary">{r.statut === "soumis" ? "Terminé" : r.statut}</Badge>
                </li>
              ))}
            </ul>
          )}
      </section>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Aperçu avant envoi</DialogTitle></DialogHeader>
          <dl className="text-sm space-y-1">
            <div><dt className="inline text-muted-foreground">Destinataire : </dt><dd className="inline">{client.email}</dd></div>
            <div><dt className="inline text-muted-foreground">Objet : </dt><dd className="inline">Questionnaire « {chosen?.titre} »</dd></div>
          </dl>
          <p className="text-sm text-muted-foreground">
            Le client reçoit un e-mail Holiswiss avec votre nom et un lien pour remplir le questionnaire.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="min-h-11" onClick={() => setPreview(false)}>Annuler</Button>
            <Button className="min-h-11" disabled={send.isPending} onClick={() => send.mutate()}>
              {send.isPending ? "Envoi…" : "Confirmer l'envoi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
