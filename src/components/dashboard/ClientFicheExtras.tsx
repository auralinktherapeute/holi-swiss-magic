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
import {
  findClientDuplicates, getClientJournal, logClientAction, mergeClients,
  previewConsentRequest, sendConsentRequest, setClientArchived,
} from "@/lib/client-fiche.functions";
import { sendInvoiceReminder } from "@/lib/therapist-invoices.functions";

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
  const log = useLogAction();

  const status = useMutation({
    mutationFn: (s: string) => statusFn({ data: { id: client.id, relation_status: s as any } }),
    onSuccess: (_d, s) => { toast.success("Statut mis à jour."); invalidate(qc, client.id); log(client.id, "status", { to: s }); },
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
      <ArchiveToggle client={client} />
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
              <ArchiveToggle client={client} />
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
  const log = useLogAction();
  const save = useMutation({
    mutationFn: () => fn({ data: {
      first_name: f.first_name.trim(), last_name: f.last_name.trim(),
      email: f.email.trim() || null, phone: f.phone.trim() || null, relation_status: "prospect",
    } as any }),
    onSuccess: (row: any) => {
      toast.success("Client créé."); invalidate(qc); setOpen(false);
      setF({ first_name: "", last_name: "", email: "", phone: "" });
      if (row?.id) { log(row.id, "created"); onCreated(row.id); }
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
  const log = useLogAction();

  const responses = useQuery({ queryKey: ["client-q-resp", client.id], queryFn: () => respFn({ data: { contact_id: client.id } }) });
  const qs = useQuery({ queryKey: ["my-questionnaires"], queryFn: () => listFn() });
  const active = (qs.data ?? []).filter((q: any) => q.actif);
  const chosen = active.find((q: any) => q.id === qid);

  const send = useMutation({
    mutationFn: () => sendFn({ data: { questionnaire_id: qid, to: client.email, origin: window.location.origin } }),
    onSuccess: () => { toast.success(`Questionnaire envoyé à ${client.email}.`); setPreview(false); log(client.id, "questionnaire_sent", { title: chosen?.titre, to: client.email, status: "envoyé" }); },
    onError: (e: any) => { log(client.id, "questionnaire_sent", { title: chosen?.titre, to: client.email, status: "échec" }); toast.error(`Envoi échoué : ${String(e?.message ?? "erreur inconnue").slice(0, 120)}`); },
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

export function useLogAction() {
  const fn = useServerFn(logClientAction);
  return (contact_id: string, action: any, details?: Record<string, unknown>) =>
    fn({ data: { contact_id, action, details } }).catch(() => undefined);
}

export function ArchiveToggle({ client }: { client: any }) {
  const qc = useQueryClient();
  const fn = useServerFn(setClientArchived);
  const m = useMutation({
    mutationFn: (archived: boolean) => fn({ data: { id: client.id, archived } }),
    onSuccess: (_d, a) => { toast.success(a ? "Client archivé." : "Client désarchivé."); invalidate(qc, client.id); qc.invalidateQueries({ queryKey: ["client-journal", client.id] }); },
    onError: () => toast.error("Échec de l'archivage."),
  });
  const archived = !!client.archived_at;
  return (
    <Button variant="outline" className="min-h-11" disabled={m.isPending} onClick={() => m.mutate(!archived)}>
      <Archive className="h-4 w-4 mr-1.5" aria-hidden="true" /> {archived ? "Désarchiver" : "Archiver"}
    </Button>
  );
}

export function ConsentRequestButton({ client }: { client: any }) {
  const qc = useQueryClient();
  const prevFn = useServerFn(previewConsentRequest);
  const sendFn = useServerFn(sendConsentRequest);
  const [open, setOpen] = useState(false);
  const preview = useQuery({ queryKey: ["consent-preview", client.id], queryFn: () => prevFn({ data: { id: client.id } }), enabled: open });
  const send = useMutation({
    mutationFn: () => sendFn({ data: { id: client.id, origin: window.location.origin } }),
    onSuccess: (r) => { toast.success(`Demande envoyée à ${r.to}.`); setOpen(false); invalidate(qc, client.id); qc.invalidateQueries({ queryKey: ["client-journal", client.id] }); },
    onError: (e: any) => toast.error(String(e?.message ?? "Envoi impossible.").slice(0, 160)),
  });
  const expired = client.consent_expires_at && new Date(client.consent_expires_at) < new Date();
  if (client.consent_at && !expired) return null;
  return (
    <>
      <Button size="sm" variant="outline" className="min-h-11" disabled={!client.email} onClick={() => setOpen(true)}
        title={client.email ? undefined : "Ajoutez d'abord une adresse e-mail"}>
        Envoyer une demande de consentement
      </Button>
      {client.consent_requested_at && (
        <span className="text-xs text-muted-foreground">Dernière demande : {new Date(client.consent_requested_at).toLocaleDateString("fr-CH")}</span>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Aperçu avant envoi</DialogTitle></DialogHeader>
          {preview.isLoading || !preview.data ? <p className="text-sm text-muted-foreground">Chargement…</p> : (
            <div className="text-sm space-y-2">
              <p><span className="text-muted-foreground">Destinataire : </span>{preview.data.to}</p>
              <p><span className="text-muted-foreground">Répondre à : </span>{preview.data.replyTo ?? "contact@holiswiss.ch"}</p>
              <p><span className="text-muted-foreground">Objet : </span>{preview.data.subject}</p>
              <div className="rounded-md border border-border p-3 whitespace-pre-line">{preview.data.text}{"\n\n"}[Bouton « Donner mon accord »]</div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="min-h-11" onClick={() => setOpen(false)}>Annuler</Button>
            <Button className="min-h-11" disabled={send.isPending || !preview.data} onClick={() => send.mutate()}>
              {send.isPending ? "Envoi…" : "Confirmer l'envoi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function InvoiceReminderButton({ invoice, client }: { invoice: any; client: any }) {
  const qc = useQueryClient();
  const fn = useServerFn(sendInvoiceReminder);
  const log = useLogAction();
  const [open, setOpen] = useState(false);
  const to = client.email ?? "";
  const send = useMutation({
    mutationFn: () => fn({ data: { id: invoice.id, to } }),
    onSuccess: () => { toast.success(`Relance envoyée à ${to}.`); setOpen(false); log(client.id, "invoice_reminder", { numero: invoice.numero_facture, to, status: "envoyé" }); qc.invalidateQueries({ queryKey: ["client-journal", client.id] }); },
    onError: (e: any) => { log(client.id, "invoice_reminder", { numero: invoice.numero_facture, to, status: "échec" }); toast.error(String(e?.message ?? "Relance impossible.").slice(0, 160)); },
  });
  if (!(invoice.solde > 0) || !invoice.numero_facture) return null;
  return (
    <>
      <Button size="sm" variant="outline" className="min-h-9" disabled={!to} onClick={() => setOpen(true)}>Relancer…</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Aperçu de la relance</DialogTitle></DialogHeader>
          <div className="text-sm space-y-1">
            <p><span className="text-muted-foreground">Destinataire : </span>{to}</p>
            <p><span className="text-muted-foreground">Objet : </span>Facture {invoice.numero_facture}</p>
            <p className="text-muted-foreground">Rappel amical de la facture {invoice.numero_facture}, solde restant {Number(invoice.solde).toFixed(2)} {invoice.currency ?? "CHF"}, avec le lien de consultation et la facture jointe.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="min-h-11" onClick={() => setOpen(false)}>Annuler</Button>
            <Button className="min-h-11" disabled={send.isPending} onClick={() => send.mutate()}>{send.isPending ? "Envoi…" : "Confirmer l'envoi"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ClientJournal({ clientId }: { clientId: string }) {
  const fn = useServerFn(getClientJournal);
  const q = useQuery({ queryKey: ["client-journal", clientId], queryFn: () => fn({ data: { contact_id: clientId } }) });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (q.isError) return <p className="text-sm text-destructive">Impossible de charger le journal.</p>;
  return (
    <section className="rounded-lg border border-border p-3">
      <h3 className="text-sm font-medium mb-2">Journal d'activité</h3>
      <ol className="space-y-2">
        {(q.data ?? []).map((e) => (
          <li key={e.id} className="flex gap-3 text-sm">
            <time className="text-xs text-muted-foreground w-32 shrink-0">{new Date(e.at).toLocaleString("fr-CH", { dateStyle: "short", timeStyle: "short" })}</time>
            <span>{e.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function DuplicatesButton() {
  const qc = useQueryClient();
  const findFn = useServerFn(findClientDuplicates);
  const mergeFn = useServerFn(mergeClients);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ keep: any; drop: any } | null>(null);
  const q = useQuery({ queryKey: ["client-duplicates"], queryFn: () => findFn(), enabled: open });
  const merge = useMutation({
    mutationFn: (v: { keep: any; drop: any }) => mergeFn({ data: { keep_id: v.keep.id, drop_id: v.drop.id } }),
    onSuccess: () => { toast.success("Fiches fusionnées. Le doublon est archivé."); setConfirm(null); invalidate(qc); qc.invalidateQueries({ queryKey: ["client-duplicates"] }); },
    onError: () => toast.error("La fusion a échoué. Aucune fiche n'a été supprimée."),
  });
  const name = (c: any) => `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
  return (
    <>
      <Button variant="outline" className="min-h-11" onClick={() => setOpen(true)}>Doublons</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Doublons possibles</DialogTitle></DialogHeader>
          {q.isLoading ? <p className="text-sm text-muted-foreground">Recherche…</p>
            : (q.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Aucun doublon détecté.</p>
            : (
              <ul className="divide-y divide-border">
                {(q.data ?? []).map((p) => (
                  <li key={p.a.id + p.b.id} className="py-3 space-y-2">
                    <p className="text-xs text-muted-foreground">{p.reasons.join(", ")}</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {[p.a, p.b].map((c, i) => (
                        <div key={c.id} className="rounded-md border border-border p-2 text-sm">
                          <div className="font-medium">{name(c)}</div>
                          <div className="text-xs text-muted-foreground break-all">{c.email ?? "—"} · {c.phone ?? "—"}</div>
                          <Button size="sm" className="mt-2 min-h-9" onClick={() => setConfirm({ keep: c, drop: i === 0 ? p.b : p.a })}>Garder cette fiche</Button>
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Confirmer la fusion</DialogTitle></DialogHeader>
          {confirm && (
            <p className="text-sm">
              La fiche <strong>{name(confirm.keep)}</strong> est conservée. Les rendez-vous, factures, documents,
              notes et questionnaires de <strong>{name(confirm.drop)}</strong> y seront rattachés, les champs vides
              complétés, puis cette seconde fiche sera archivée (pas supprimée).
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="min-h-11" onClick={() => setConfirm(null)}>Annuler</Button>
            <Button className="min-h-11" disabled={merge.isPending} onClick={() => confirm && merge.mutate(confirm)}>
              {merge.isPending ? "Fusion…" : "Fusionner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
