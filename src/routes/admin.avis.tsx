import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/avis")({ component: Page });

type Row = {
  id: string;
  therapist_id: string;
  rating: number;
  comment: string;
  author_name: string | null;
  author_avatar_url: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  therapists?: { first_name: string; last_name: string; slug: string } | null;
};

const sb = supabase as any;

function Page() {
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb
      .from("reviews")
      .select("id,therapist_id,rating,comment,author_name,author_avatar_url,status,created_at,therapists(first_name,last_name,slug)")
      .eq("status", tab)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as any);
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (id: string, status: "approved" | "rejected" | "pending") => {
    const { error } = await sb.from("reviews").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Avis mis à jour");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer définitivement cet avis ?")) return;
    const { error } = await sb.from("reviews").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Avis supprimé");
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Modération des avis</h1>
        <p className="text-sm text-muted-foreground">Valider, refuser ou supprimer les avis postés par les visiteurs.</p>
      </div>

      <div className="flex gap-2 border-b">
        {([
          { k: "pending", label: "En attente", icon: Clock },
          { k: "approved", label: "Approuvés", icon: Check },
          { k: "rejected", label: "Refusés", icon: X },
        ] as const).map(({ k, label, icon: Icon }) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun avis dans cette catégorie.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
                <div className="flex items-center gap-3">
                  {r.author_avatar_url ? (
                    <img src={r.author_avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center font-semibold">
                      {(r.author_name ?? "?")[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-sm">{r.author_name ?? "Anonyme"}</p>
                    <p className="text-xs text-muted-foreground">
                      Thérapeute : {r.therapists ? `${r.therapists.first_name} ${r.therapists.last_name}` : r.therapist_id.slice(0, 8)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`h-4 w-4 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted"}`} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-CH")}</span>
                </div>
              </div>
              <p className="text-sm leading-relaxed mb-3">{r.comment}</p>
              <div className="flex gap-2 flex-wrap">
                {tab !== "approved" && (
                  <button onClick={() => updateStatus(r.id, "approved")} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-emerald-700 transition">
                    <Check className="h-3.5 w-3.5" /> Approuver
                  </button>
                )}
                {tab !== "rejected" && (
                  <button onClick={() => updateStatus(r.id, "rejected")} className="inline-flex items-center gap-1 rounded-md bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-700 transition">
                    <X className="h-3.5 w-3.5" /> Refuser
                  </button>
                )}
                <button onClick={() => remove(r.id)} className="inline-flex items-center gap-1 rounded-md border border-destructive text-destructive px-3 py-1.5 text-xs font-semibold hover:bg-destructive/10 transition">
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
