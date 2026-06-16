import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Mail, Check, Star, Trash2, Download, Copy, ChevronLeft, ChevronRight, Hourglass,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteWaitingListEntryAdmin, listWaitingListAdmin, updateWaitingListStatusAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/liste-attente")({
  component: WaitingListAdminPage,
});

type Status = "pending" | "contacted" | "converted" | "removed";
type Entry = {
  id: string;
  email: string;
  created_at: string;
  source: string | null;
  status: Status;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  specialty: string | null;
  canton: string | null;
  message: string | null;
};

const TOTAL_SPOTS = 70;
const PAGE_SIZE = 20;

const STATUS_META: Record<Status, { label: string; bg: string; color: string }> = {
  pending:   { label: "En attente", bg: "rgba(245,158,11,0.15)",  color: "#fbbf24" },
  contacted: { label: "Contacté",   bg: "rgba(59,130,246,0.15)",  color: "#60a5fa" },
  converted: { label: "Converti",   bg: "rgba(34,197,94,0.15)",   color: "#4ade80" },
  removed:   { label: "Supprimé",   bg: "rgba(239,68,68,0.15)",   color: "#f87171" },
};

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return "***";
  const head = name.slice(0, 2);
  return `${head}***@${domain}`;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-CH", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function WaitingListAdminPage() {
  const fetchRows = useServerFn(listWaitingListAdmin);
  const updateRowStatus = useServerFn(updateWaitingListStatusAdmin);
  const deleteRow = useServerFn(deleteWaitingListEntryAdmin);
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<Entry | null>(null);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [filterSpecialty, setFilterSpecialty] = useState<string>("all");
  const [filterCanton, setFilterCanton] = useState<string>("all");
  const knownIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  const load = useCallback(async () => {
    try {
      const { rows: data } = await fetchRows();
      const list = (data ?? []) as Entry[];
      if (!isFirstLoad.current) {
        // detect new entries -> flash
        const newOnes = list.filter((r) => !knownIds.current.has(r.id)).map((r) => r.id);
        if (newOnes.length) {
          setFlashIds((prev) => {
            const next = new Set(prev);
            newOnes.forEach((id) => next.add(id));
            return next;
          });
          window.setTimeout(() => {
            setFlashIds((prev) => {
              const next = new Set(prev);
              newOnes.forEach((id) => next.delete(id));
              return next;
            });
          }, 1200);
        }
      }
      knownIds.current = new Set(list.map((r) => r.id));
      isFirstLoad.current = false;
      setRows(list);
      setLoading(false);
    } catch {
      toast.error("Erreur de chargement");
    }
  }, [fetchRows]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 30000);
    return () => window.clearInterval(id);
  }, [load]);

  const total = rows.length;
  const remaining = Math.max(0, TOTAL_SPOTS - total);
  const pct = Math.min(100, Math.round((total / TOTAL_SPOTS) * 100));

  const { today, week } = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now); startToday.setHours(0,0,0,0);
    const startWeek = new Date(now.getTime() - 7 * 86400000);
    let t = 0, w = 0;
    for (const r of rows) {
      const d = new Date(r.created_at);
      if (d >= startToday) t++;
      if (d >= startWeek) w++;
    }
    return { today: t, week: w };
  }, [rows]);

  const filteredRows = useMemo(() => rows.filter((r) =>
    (filterSpecialty === "all" || r.specialty === filterSpecialty) &&
    (filterCanton === "all" || r.canton === filterCanton)
  ), [rows, filterSpecialty, filterCanton]);

  const specialtyOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.specialty).filter(Boolean) as string[])).sort(),
    [rows]
  );
  const cantonOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.canton).filter(Boolean) as string[])).sort(),
    [rows]
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function updateStatus(id: string, status: Status) {
    try {
      await updateRowStatus({ data: { id, status } });
      toast.success("Statut mis à jour");
      load();
    } catch {
      toast.error("Erreur de mise à jour");
    }
  }

  async function remove(id: string) {
    try {
      await deleteRow({ data: { id } });
      toast.success("Inscrit supprimé");
      load();
    } catch {
      toast.error("Suppression échouée");
    }
    setConfirmDelete(null);
  }

  function exportCsv() {
    const esc = (v: string | null | undefined) => `"${String(v ?? "").replace(/"/g, '""').replace(/\n/g, " ")}"`;
    const header = "prenom,nom,email,telephone,specialite,canton,message,source,statut,date\n";
    const body = filteredRows
      .map((r) => [
        esc(r.first_name), esc(r.last_name), esc(r.email), esc(r.phone),
        esc(r.specialty), esc(r.canton), esc(r.message),
        esc(r.source), esc(r.status), esc(r.created_at),
      ].join(","))
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waiting-list-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyEmails() {
    const list = filteredRows.map((r) => r.email).join(", ");
    try {
      await navigator.clipboard.writeText(list);
      toast.success(`${filteredRows.length} emails copiés !`);
    } catch {
      toast.error("Impossible de copier");
    }
  }

  return (
    <div className="p-6 md:p-8 space-y-6" style={{ color: "#e9e6f5" }}>
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <Hourglass className="h-6 w-6" style={{ color: "#b86ef9" }} />
            Liste d'attente
          </h1>
          <p className="text-sm text-white/60 mt-1">
            Suivi temps réel des inscriptions au lancement
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={copyEmails} variant="outline" className="gap-2" disabled={!rows.length}>
            <Copy className="h-4 w-4" /> Copier tous les emails
          </Button>
          <Button onClick={exportCsv} className="gap-2" disabled={!rows.length}
            style={{ background: "linear-gradient(135deg,#b86ef9,#5cc8fa)", color: "white", border: 0 }}>
            <Download className="h-4 w-4" /> Exporter CSV
          </Button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Total inscrits" value={total}
             bg="rgba(184,110,249,0.12)" border="rgba(184,110,249,0.3)" color="#b86ef9" />
        <Kpi label="Places restantes" value={remaining}
             bg={remaining < 10 ? "rgba(239,68,68,0.12)" : "rgba(92,200,250,0.10)"}
             border={remaining < 10 ? "rgba(239,68,68,0.35)" : "rgba(92,200,250,0.3)"}
             color={remaining < 10 ? "#f87171" : "#5cc8fa"} />
        <Kpi label="Inscriptions aujourd'hui" value={today}
             bg="rgba(34,197,94,0.10)" border="rgba(34,197,94,0.3)" color="#4ade80" />
        <Kpi label="Inscriptions cette semaine" value={week}
             bg="rgba(245,158,11,0.10)" border="rgba(245,158,11,0.3)" color="#fbbf24" />
      </div>

      {/* Progress */}
      <div className="rounded-xl p-5" style={{ background: "#0f0a1e", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-white">{total} / {TOTAL_SPOTS} thérapeutes inscrits</span>
          <span className="text-sm text-white/60">{pct}%</span>
        </div>
        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 999, height: 8, overflow: "hidden" }}>
          <div style={{
            width: `${pct}%`, height: "100%",
            background: "linear-gradient(90deg,#b86ef9,#5cc8fa)",
            borderRadius: 999, transition: "width 0.8s ease",
          }} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#0f0a1e", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }} className="text-white/60 text-left">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Date inscription</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-white/50">Chargement…</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-white/50">Aucun inscrit pour le moment.</td></tr>
              ) : pageRows.map((r, i) => {
                const meta = STATUS_META[r.status] ?? STATUS_META.pending;
                const flashing = flashIds.has(r.id);
                return (
                  <tr
                    key={r.id}
                    className="border-t transition-colors"
                    style={{
                      borderColor: "rgba(255,255,255,0.06)",
                      background: flashing ? "rgba(184,110,249,0.18)" : undefined,
                      animation: flashing ? "wl-flash 1s ease-out" : undefined,
                    }}
                  >
                    <td className="px-4 py-3 text-white/40">{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-3 text-white">{r.email}</td>
                    <td className="px-4 py-3 text-white/70">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-3 text-white/60">{r.source ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
                            style={{ background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <IconBtn title="Envoyer un email" onClick={() => window.open(`mailto:${r.email}`)}>
                          <Mail className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn title="Marquer Contacté" onClick={() => updateStatus(r.id, "contacted")}>
                          <Check className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn title="Marquer Converti" onClick={() => updateStatus(r.id, "converted")}>
                          <Star className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn title="Supprimer" onClick={() => setConfirmDelete(r)} danger>
                          <Trash2 className="h-4 w-4" />
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-xs text-white/50">Page {currentPage} sur {totalPages}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet inscrit ?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.email} sera définitivement retiré de la liste d'attente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && remove(confirmDelete.id)}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <style>{`
        @keyframes wl-flash {
          0% { background: rgba(184,110,249,0.35); }
          100% { background: transparent; }
        }
      `}</style>
    </div>
  );
}

function Kpi({ label, value, bg, border, color }: { label: string; value: number; bg: string; border: string; color: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="text-xs uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>{label}</div>
      <div className="mt-2 text-3xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function IconBtn({ children, title, onClick, danger }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors"
      style={{
        color: danger ? "#f87171" : "rgba(255,255,255,0.7)",
        background: "transparent",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}