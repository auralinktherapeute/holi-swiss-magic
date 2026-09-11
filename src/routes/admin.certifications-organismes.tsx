import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, BadgeCheck, Building2, History, Plus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  createOrgCertification,
  getOrgCertificationHistory,
  listCertificationOrganizations,
  listOrgCertifications,
  searchTherapistsForCertification,
  setCertificationOrganizationActive,
  setOrgCertificationStatus,
  upsertCertificationOrganization,
  type OrgCertificationStatus,
} from "@/lib/org-certifications.functions";

export const Route = createFileRoute("/admin/certifications-organismes")({ component: Page });

const STATUSES: { key: OrgCertificationStatus; label: string; color: string }[] = [
  { key: "pending", label: "En attente", color: "#fbbf24" },
  { key: "active", label: "Active", color: "#4ade80" },
  { key: "suspended", label: "Suspendue", color: "#fb923c" },
  { key: "expired", label: "Expirée", color: "#94a3b8" },
  { key: "revoked", label: "Révoquée", color: "#f87171" },
];
const DEACTIVATING: OrgCertificationStatus[] = ["suspended", "expired", "revoked"];
const statusMeta = (s: OrgCertificationStatus) => STATUSES.find((x) => x.key === s) ?? STATUSES[0];

function StatusPill({ status }: { status: OrgCertificationStatus }) {
  const m = statusMeta(status);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: `${m.color}1f`, color: m.color }}
    >
      {m.label}
    </span>
  );
}

function Page() {
  const [tab, setTab] = useState<"organismes" | "associations">("organismes");

  return (
    <div className="p-6 md:p-10 space-y-6 text-white">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BadgeCheck className="h-7 w-7 text-[#b86ef9]" /> Certifications par organisme
        </h1>
        <p className="text-white/60 mt-1">
          Organismes externes (SVHH, SoulSense…) et thérapeutes qu&apos;ils certifient. Écran distinct des diplômes.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTab("organismes")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === "organismes" ? "bg-[#b86ef9] text-white" : "bg-white/5 text-white/70 hover:bg-white/10"
          }`}
        >
          <Building2 className="h-4 w-4" /> Organismes
        </button>
        <button
          onClick={() => setTab("associations")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === "associations" ? "bg-[#b86ef9] text-white" : "bg-white/5 text-white/70 hover:bg-white/10"
          }`}
        >
          <Users className="h-4 w-4" /> Thérapeutes certifiés
        </button>
      </div>

      {tab === "organismes" ? <OrganizationsScreen /> : <AssociationsScreen />}
    </div>
  );
}

/* ------------------------------ Écran 1 : organismes ------------------------------ */

type OrgForm = {
  id?: string | null;
  code: string;
  display_name: string;
  logo_url: string;
  badge_color: string;
  is_active: boolean;
};
const emptyOrg: OrgForm = { id: null, code: "", display_name: "", logo_url: "", badge_color: "#b86ef9", is_active: true };

function OrganizationsScreen() {
  const qc = useQueryClient();
  const list = useServerFn(listCertificationOrganizations);
  const upsert = useServerFn(upsertCertificationOrganization);
  const setActive = useServerFn(setCertificationOrganizationActive);
  const [form, setForm] = useState<OrgForm | null>(null);

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ["admin-cert-orgs"],
    queryFn: () => list({ data: undefined }),
  });

  const save = useMutation({
    mutationFn: async (f: OrgForm) =>
      upsert({
        data: {
          id: f.id ?? null,
          code: f.code,
          display_name: f.display_name,
          logo_url: f.logo_url,
          badge_color: f.badge_color,
          is_active: f.is_active,
        },
      }),
    onSuccess: () => {
      toast.success("Organisme enregistré");
      setForm(null);
      qc.invalidateQueries({ queryKey: ["admin-cert-orgs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Enregistrement impossible"),
  });

  const toggle = useMutation({
    mutationFn: async (v: { id: string; is_active: boolean }) => setActive({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cert-orgs"] }),
    onError: (e: any) => toast.error(e?.message ?? "Modification impossible"),
  });

  return (
    <section className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setForm({ ...emptyOrg })} className="bg-[#b86ef9] hover:bg-[#a855f7]">
          <Plus className="h-4 w-4 mr-1" /> Nouvel organisme
        </Button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-white/50">
            <tr className="text-left">
              <th className="p-3 font-medium">Organisme</th>
              <th className="p-3 font-medium">Code</th>
              <th className="p-3 font-medium">Badge</th>
              <th className="p-3 font-medium">Certifications</th>
              <th className="p-3 font-medium">Actif</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="p-4 text-white/50" colSpan={6}>
                  Chargement…
                </td>
              </tr>
            )}
            {!isLoading && orgs.length === 0 && (
              <tr>
                <td className="p-4 text-white/50" colSpan={6}>
                  Aucun organisme enregistré.
                </td>
              </tr>
            )}
            {orgs.map((o) => (
              <tr key={o.id} className="border-t border-white/5">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {o.logo_url ? (
                      <img src={o.logo_url} alt="" className="h-7 w-7 rounded object-contain bg-white/10" />
                    ) : (
                      <span className="h-7 w-7 rounded bg-white/10 inline-flex items-center justify-center text-white/50">
                        <Building2 className="h-4 w-4" />
                      </span>
                    )}
                    <span className="font-medium">{o.display_name}</span>
                  </div>
                </td>
                <td className="p-3 text-white/70">{o.code}</td>
                <td className="p-3">
                  <span
                    className="inline-block h-5 w-5 rounded-full border border-white/20"
                    style={{ background: o.badge_color ?? "transparent" }}
                    aria-label={`Couleur ${o.badge_color ?? "non définie"}`}
                  />
                </td>
                <td className="p-3 text-white/70">
                  {o.certificationsActive} active(s) / {o.certificationsTotal}
                </td>
                <td className="p-3">
                  <Switch
                    checked={o.is_active}
                    onCheckedChange={(v) => toggle.mutate({ id: o.id, is_active: v })}
                    aria-label={`Activer ${o.display_name}`}
                  />
                </td>
                <td className="p-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/70 hover:text-white"
                    onClick={() =>
                      setForm({
                        id: o.id,
                        code: o.code,
                        display_name: o.display_name,
                        logo_url: o.logo_url ?? "",
                        badge_color: o.badge_color ?? "#b86ef9",
                        is_active: o.is_active,
                      })
                    }
                  >
                    Modifier
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Modifier l'organisme" : "Nouvel organisme"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="org-code">Code</Label>
                <Input
                  id="org-code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="SVHH"
                />
              </div>
              <div>
                <Label htmlFor="org-name">Nom affiché</Label>
                <Input
                  id="org-name"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Logo (optionnel)</Label>
                <OrganizationLogoUploader
                  value={form.logo_url}
                  onChange={(url) => setForm((f) => (f ? { ...f, logo_url: url } : f))}
                />
              </div>
              <div>
                <Label htmlFor="org-color">Couleur du badge</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="org-color"
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(form.badge_color) ? form.badge_color : "#b86ef9"}
                    onChange={(e) => setForm({ ...form, badge_color: e.target.value })}
                    className="h-10 w-14 rounded border border-white/15 bg-transparent"
                  />
                  <Input value={form.badge_color} onChange={(e) => setForm({ ...form, badge_color: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <Switch
                  id="org-active"
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
                <Label htmlFor="org-active">Organisme actif</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Annuler
            </Button>
            <Button
              className="bg-[#b86ef9] hover:bg-[#a855f7]"
              disabled={save.isPending}
              onClick={() => form && save.mutate(form)}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* --------------------------- Écran 2 : associations --------------------------- */

function AssociationsScreen() {
  const qc = useQueryClient();
  const listOrgs = useServerFn(listCertificationOrganizations);
  const listCerts = useServerFn(listOrgCertifications);
  const setStatus = useServerFn(setOrgCertificationStatus);

  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [addOpen, setAddOpen] = useState(false);
  const [historyFor, setHistoryFor] = useState<{ id: string; name: string } | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; name: string; status: OrgCertificationStatus } | null>(null);

  const { data: orgs = [] } = useQuery({ queryKey: ["admin-cert-orgs"], queryFn: () => listOrgs({ data: undefined }) });
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-org-certs", search, orgFilter, statusFilter],
    queryFn: () =>
      listCerts({
        data: {
          search: search || undefined,
          organizationId: orgFilter || undefined,
          status: (statusFilter || undefined) as OrgCertificationStatus | undefined,
        },
      }),
  });

  const change = useMutation({
    mutationFn: async (v: { id: string; status: OrgCertificationStatus }) => setStatus({ data: v }),
    onSuccess: () => {
      toast.success("Statut mis à jour");
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ["admin-org-certs"] });
      qc.invalidateQueries({ queryKey: ["admin-cert-orgs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Modification impossible"),
  });

  const requestChange = (row: { id: string; therapistName: string }, status: OrgCertificationStatus) => {
    if (DEACTIVATING.includes(status)) setConfirm({ id: row.id, name: row.therapistName, status });
    else change.mutate({ id: row.id, status });
  };

  return (
    <section className="space-y-4">
      <div
        role="status"
        className="flex gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100"
      >
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
        <p>
          Toute modification de statut ici a un effet immédiat sur l&apos;endpoint public{" "}
          <code className="rounded bg-black/30 px-1">/api/public/certified-therapists</code>, consommé par des sites
          partenaires externes (SVHH, SoulSense). Le cache peut retarder l&apos;affichage côté partenaire jusqu&apos;à 15
          minutes.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            aria-label="Rechercher un thérapeute"
            className="pl-9"
            placeholder="Rechercher un thérapeute…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="f-org" className="text-white/60 text-xs">
            Organisme
          </Label>
          <select
            id="f-org"
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            className="block h-10 rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white"
          >
            <option value="">Tous</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id} className="text-black">
                {o.display_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="f-status" className="text-white/60 text-xs">
            Statut
          </Label>
          <select
            id="f-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block h-10 rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white"
          >
            <option value="">Tous</option>
            {STATUSES.map((s) => (
              <option key={s.key} value={s.key} className="text-black">
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <Button className="bg-[#b86ef9] hover:bg-[#a855f7]" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Associer un thérapeute
        </Button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-white/50">
            <tr className="text-left">
              <th className="p-3 font-medium">Thérapeute</th>
              <th className="p-3 font-medium">Organisme</th>
              <th className="p-3 font-medium">Statut</th>
              <th className="p-3 font-medium">Certifié depuis</th>
              <th className="p-3 font-medium">Référence externe</th>
              <th className="p-3 font-medium">Changer le statut</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="p-4 text-white/50" colSpan={7}>
                  Chargement…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td className="p-4 text-white/50" colSpan={7}>
                  Aucune certification pour ces critères.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {r.therapistPhoto ? (
                      <img src={r.therapistPhoto} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <span className="h-8 w-8 rounded-full bg-white/10" />
                    )}
                    <div>
                      {r.therapistSlug ? (
                        <a
                          href={`/fr/therapeutes/${r.therapistSlug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-[#5cc8fa] hover:underline"
                        >
                          {r.therapistName}
                        </a>
                      ) : (
                        <span className="font-medium">{r.therapistName}</span>
                      )}
                      <div className="text-xs text-white/45">{r.therapistCity ?? "—"}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{
                      background: `${r.organizationColor ?? "#b86ef9"}1f`,
                      color: r.organizationColor ?? "#b86ef9",
                    }}
                  >
                    {r.organizationName}
                  </span>
                </td>
                <td className="p-3">
                  <StatusPill status={r.status} />
                </td>
                <td className="p-3 text-white/70">
                  {r.certifiedSince ? new Date(r.certifiedSince).toLocaleDateString("fr-CH") : "—"}
                </td>
                <td className="p-3 text-white/70">{r.externalReference ?? "—"}</td>
                <td className="p-3">
                  <select
                    aria-label={`Statut de ${r.therapistName}`}
                    value={r.status}
                    onChange={(e) => requestChange(r, e.target.value as OrgCertificationStatus)}
                    className="h-9 rounded-md border border-white/15 bg-white/5 px-2 text-sm text-white"
                  >
                    {STATUSES.map((s) => (
                      <option key={s.key} value={s.key} className="text-black">
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/70 hover:text-white"
                    onClick={() => setHistoryFor({ id: r.id, name: r.therapistName })}
                  >
                    <History className="h-4 w-4 mr-1" /> Historique
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddCertificationDialog open={addOpen} onOpenChange={setAddOpen} />
      <HistoryDialog value={historyFor} onClose={() => setHistoryFor(null)} />

      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la désactivation</AlertDialogTitle>
            <AlertDialogDescription>
              Passer la certification de {confirm?.name} en «&nbsp;{confirm ? statusMeta(confirm.status).label : ""}
              &nbsp;» la retirera de l&apos;endpoint public utilisé par les sites partenaires (jusqu&apos;à 15 minutes de
              cache).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirm && change.mutate({ id: confirm.id, status: confirm.status })}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function AddCertificationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const listOrgs = useServerFn(listCertificationOrganizations);
  const searchTherapists = useServerFn(searchTherapistsForCertification);
  const create = useServerFn(createOrgCertification);

  const [term, setTerm] = useState("");
  const [therapist, setTherapist] = useState<{ id: string; label: string } | null>(null);
  const [organizationId, setOrganizationId] = useState("");
  const [status, setStatus] = useState<OrgCertificationStatus>("active");
  const [certifiedSince, setCertifiedSince] = useState("");
  const [externalReference, setExternalReference] = useState("");

  const { data: orgs = [] } = useQuery({ queryKey: ["admin-cert-orgs"], queryFn: () => listOrgs({ data: undefined }) });
  const activeOrgs = useMemo(() => orgs.filter((o) => o.is_active), [orgs]);

  const { data: suggestions = [] } = useQuery({
    queryKey: ["admin-cert-therapist-search", term],
    queryFn: () => searchTherapists({ data: { term } }),
    enabled: term.trim().length >= 2 && !therapist,
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!therapist) throw new Error("Sélectionnez un thérapeute.");
      if (!organizationId) throw new Error("Sélectionnez un organisme.");
      return create({
        data: { therapistId: therapist.id, organizationId, status, certifiedSince, externalReference },
      });
    },
    onSuccess: () => {
      toast.success("Certification créée");
      setTerm("");
      setTherapist(null);
      setOrganizationId("");
      setStatus("active");
      setCertifiedSince("");
      setExternalReference("");
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["admin-org-certs"] });
      qc.invalidateQueries({ queryKey: ["admin-cert-orgs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Création impossible"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Associer un thérapeute à un organisme</DialogTitle>
          <DialogDescription>
            Cette association est indépendante des diplômes déclarés par le thérapeute.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="cert-therapist">Thérapeute</Label>
            {therapist ? (
              <div className="flex items-center justify-between rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm">
                <span>{therapist.label}</span>
                <Button variant="ghost" size="sm" onClick={() => setTherapist(null)}>
                  Changer
                </Button>
              </div>
            ) : (
              <>
                <Input
                  id="cert-therapist"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Nom du thérapeute (2 caractères min.)"
                />
                {suggestions.length > 0 && (
                  <ul className="mt-1 max-h-48 overflow-auto rounded-md border border-white/15 bg-[#160f2c]">
                    {suggestions.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-white/10"
                          onClick={() => setTherapist({ id: s.id, label: s.label })}
                        >
                          {s.label}
                          {s.city ? <span className="text-white/45"> — {s.city}</span> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div>
            <Label htmlFor="cert-org">Organisme actif</Label>
            <select
              id="cert-org"
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              className="block h-10 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white"
            >
              <option value="">Sélectionner…</option>
              {activeOrgs.map((o) => (
                <option key={o.id} value={o.id} className="text-black">
                  {o.display_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="cert-status">Statut initial</Label>
            <select
              id="cert-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as OrgCertificationStatus)}
              className="block h-10 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white"
            >
              {STATUSES.map((s) => (
                <option key={s.key} value={s.key} className="text-black">
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="cert-since">Certifié depuis</Label>
            <Input
              id="cert-since"
              type="date"
              value={certifiedSince}
              onChange={(e) => setCertifiedSince(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="cert-ref">Référence externe (visible admin uniquement)</Label>
            <Input
              id="cert-ref"
              value={externalReference}
              onChange={(e) => setExternalReference(e.target.value)}
              placeholder="Optionnel"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            className="bg-[#b86ef9] hover:bg-[#a855f7]"
            disabled={submit.isPending}
            onClick={() => submit.mutate()}
          >
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ value, onClose }: { value: { id: string; name: string } | null; onClose: () => void }) {
  const fetchHistory = useServerFn(getOrgCertificationHistory);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-org-cert-history", value?.id],
    queryFn: () => fetchHistory({ data: { certificationId: value!.id } }),
    enabled: !!value,
  });

  return (
    <Dialog open={!!value} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Historique — {value?.name}</DialogTitle>
        </DialogHeader>
        {isLoading && <p className="text-white/60 text-sm">Chargement…</p>}
        {!isLoading && rows.length === 0 && <p className="text-white/60 text-sm">Aucun changement enregistré.</p>}
        <ul className="space-y-2">
          {rows.map((h) => (
            <li key={h.id} className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                {h.oldStatus ? <StatusPill status={h.oldStatus} /> : <span className="text-white/50">Création</span>}
                <span className="text-white/40">→</span>
                <StatusPill status={h.newStatus} />
              </div>
              <div className="mt-1 text-xs text-white/45">
                {new Date(h.changedAt).toLocaleString("fr-CH")}
                {h.changedByLabel ? ` · ${h.changedByLabel}` : ""}
              </div>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
