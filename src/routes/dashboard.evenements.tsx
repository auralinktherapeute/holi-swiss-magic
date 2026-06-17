import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EventFormWizard, type EventDraft } from "@/components/dashboard/EventFormWizard";
import { listMyEvents, deleteMyEvent } from "@/lib/events.functions";

export const Route = createFileRoute("/dashboard/evenements")({ component: Page });

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: "Brouillon", cls: "bg-muted text-foreground" },
  pending_review: { label: "En attente de validation", cls: "bg-amber-100 text-amber-800" },
  published: { label: "Publié", cls: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Refusé", cls: "bg-red-100 text-red-700" },
};

function eventToDraft(e: any): EventDraft {
  return {
    id: e.id,
    title: e.title ?? "",
    short_description: e.short_description ?? "",
    long_description: e.long_description ?? "",
    category: e.category ?? "autre",
    event_date: e.event_date ?? "",
    start_time: (e.start_time ?? "").slice(0, 5),
    end_time: (e.end_time ?? "").slice(0, 5),
    format: e.format ?? "in_person",
    location: e.location ?? "",
    online_link: e.online_link ?? "",
    is_paid: !!e.is_paid,
    price: e.price != null ? String(e.price) : "",
    price_description: e.price_description ?? "",
    reduced_price: e.reduced_price != null ? String(e.reduced_price) : "",
    reduced_price_description: e.reduced_price_description ?? "",
    seats: e.seats != null ? String(e.seats) : "",
    enable_waitlist: !!e.enable_waitlist,
    image_url: e.image_url ?? "",
  };
}

function Page() {
  const fetchList = useServerFn(listMyEvents);
  const removeFn = useServerFn(deleteMyEvent);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-events"], queryFn: () => fetchList() });
  const [editing, setEditing] = useState<EventDraft | null>(null);
  const [showForm, setShowForm] = useState(false);

  const events = data?.events ?? [];

  const onDelete = async (id: string) => {
    if (!confirm("Supprimer cet événement ?")) return;
    try {
      await removeFn({ data: { id } });
      toast.success("Événement supprimé.");
      qc.invalidateQueries({ queryKey: ["my-events"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    }
  };

  if (showForm) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <EventFormWizard
          initial={editing ?? undefined}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["my-events"] });
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">Mes événements</h1>
          <p className="text-sm text-muted-foreground">Créez, soumettez à validation et gérez vos événements.</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" /> Nouvel événement
        </Button>
      </header>

      {isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <p className="text-muted-foreground mb-4">Aucun événement pour le moment.</p>
          <Button onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Créer mon premier événement
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {events.map((e: any) => {
            const s = STATUS_LABEL[e.status] ?? STATUS_LABEL.draft;
            return (
              <li key={e.id} className="rounded-xl border border-border bg-card p-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{e.title}</h3>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {e.event_date ?? "Date ?"}{e.start_time ? ` · ${String(e.start_time).slice(0, 5)}` : ""} · {e.is_paid ? `${e.price ?? "?"} CHF` : "Gratuit"} · {e.seats ?? "?"} places
                  </p>
                  {e.status === "rejected" && e.rejection_reason && (
                    <p className="text-xs text-red-600 mt-1">Motif : {e.rejection_reason}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => { setEditing(eventToDraft(e)); setShowForm(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onDelete(e.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
