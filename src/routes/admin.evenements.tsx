import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, X, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { listAdminEvents, reviewEvent } from "@/lib/events.functions";

export const Route = createFileRoute("/admin/evenements")({ component: Page });

const TABS = [
  { id: "pending_review", label: "À valider" },
  { id: "published", label: "Publiés" },
  { id: "rejected", label: "Refusés" },
  { id: "draft", label: "Brouillons" },
  { id: "all", label: "Tous" },
] as const;

function Page() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("pending_review");
  const [rejecting, setRejecting] = useState<{ id: string; title: string } | null>(null);
  const [reason, setReason] = useState("");
  const fetchList = useServerFn(listAdminEvents);
  const review = useServerFn(reviewEvent);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-events", tab],
    queryFn: () => fetchList({ data: { status: tab } }),
  });

  const events = data?.events ?? [];

  const onPublish = async (id: string) => {
    try {
      await review({ data: { id, action: "publish" } });
      toast.success("Événement publié.");
      qc.invalidateQueries({ queryKey: ["admin-events"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    }
  };

  const onReject = async () => {
    if (!rejecting) return;
    try {
      await review({ data: { id: rejecting.id, action: "reject", reason: reason.trim() || undefined } });
      toast.success("Événement refusé.");
      qc.invalidateQueries({ queryKey: ["admin-events"] });
      setRejecting(null);
      setReason("");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Événements</h1>
        <p className="text-sm text-muted-foreground">Modérez les événements soumis par les thérapeutes.</p>
      </header>

      <div className="flex flex-wrap gap-2 mb-5 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center">Aucun événement dans cette catégorie.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((e: any) => (
            <li key={e.id} className="rounded-xl border border-border bg-card p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{e.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    par {e.therapists?.first_name} {e.therapists?.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" />{e.event_date ?? "—"} {e.start_time ? String(e.start_time).slice(0, 5) : ""}</span>
                    <span>· {e.is_paid ? `${e.price} CHF` : "Gratuit"}</span>
                    <span>· {e.seats ?? "?"} places</span>
                  </p>
                  {e.short_description && <p className="text-sm mt-2 line-clamp-2">{e.short_description}</p>}
                  {e.status === "rejected" && e.rejection_reason && (
                    <p className="text-xs text-red-600 mt-2">Refusé : {e.rejection_reason}</p>
                  )}
                </div>
                {e.status === "pending_review" && (
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={() => onPublish(e.id)}>
                      <Check className="h-4 w-4 mr-1" /> Publier
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setRejecting({ id: e.id, title: e.title }); setReason(""); }}>
                      <X className="h-4 w-4 mr-1" /> Refuser
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!rejecting} onOpenChange={(o) => { if (!o) { setRejecting(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Refuser l'événement</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">« {rejecting?.title} »</p>
          <Textarea
            placeholder="Motif (optionnel) — sera communiqué au thérapeute."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(null)}>Annuler</Button>
            <Button onClick={onReject}>Confirmer le refus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}