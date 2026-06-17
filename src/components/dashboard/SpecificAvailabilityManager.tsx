import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { CalendarPlus, Plus, Trash2, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { parseDateOnly, localeForI18n } from "@/lib/dateUtils";

interface SpecificSlot {
  id: string;
  specific_date: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface Props {
  therapistId: string;
}

export default function SpecificAvailabilityManager({ therapistId }: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const locale = localeForI18n(i18n.language);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("12:00");
  const [showAll, setShowAll] = useState(false);

  const formatLabel = (slot: SpecificSlot) => {
    const d = parseDateOnly(slot.specific_date);
    const dateStr = d
      ? d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })
      : slot.specific_date;
    return `${dateStr} · ${slot.start_time.slice(0, 5)} – ${slot.end_time.slice(0, 5)}`;
  };

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ["specific-availability", therapistId],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("availabilities")
        .select("id, specific_date, start_time, end_time, is_active")
        .eq("therapist_id", therapistId)
        .eq("is_active", true)
        .not("specific_date", "is", null)
        .gte("specific_date", today)
        .order("specific_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SpecificSlot[];
    },
    enabled: !!therapistId,
  });

  const resetForm = () => {
    setEditingId(null);
    setDate("");
    setStart("09:00");
    setEnd("12:00");
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (slot: SpecificSlot) => {
    setEditingId(slot.id);
    setDate(slot.specific_date);
    setStart(slot.start_time.slice(0, 5));
    setEnd(slot.end_time.slice(0, 5));
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!date) throw new Error(t("agenda_page.specific_err_date"));
      if (start >= end) throw new Error(t("agenda_page.specific_err_range"));

      const payload = {
        therapist_id: therapistId,
        specific_date: date,
        start_time: start,
        end_time: end,
        is_active: true,
        day_of_week: parseDateOnly(date)?.getDay() ?? 0,
      };

      if (editingId) {
        const { error } = await supabase
          .from("availabilities")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("availabilities").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? t("agenda_page.specific_updated") : t("agenda_page.specific_added"));
      queryClient.invalidateQueries({ queryKey: ["specific-availability", therapistId] });
      queryClient.invalidateQueries({ queryKey: ["availabilities"] });
      setOpen(false);
      resetForm();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("availabilities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("agenda_page.specific_deleted"));
      queryClient.invalidateQueries({ queryKey: ["specific-availability", therapistId] });
      queryClient.invalidateQueries({ queryKey: ["availabilities"] });
    },
    onError: () => toast.error(t("agenda_page.specific_err_delete")),
  });

  const visible = useMemo(() => (showAll ? slots : slots.slice(0, 5)), [slots, showAll]);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5" aria-hidden />
              {t("agenda_page.specific_title")}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("agenda_page.specific_desc")}
            </p>
          </div>
          <Button onClick={openCreate} size="sm" className="shrink-0">
            <Plus className="mr-2 h-4 w-4" /> {t("agenda_page.specific_add")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("agenda_page.specific_empty")}</p>
        ) : (
          <div className="space-y-2">
            <ul className="divide-y rounded-md border">
              {visible.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-sm">{formatLabel(s)}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(s)}
                      className="p-1 text-muted-foreground transition-colors hover:text-primary"
                      aria-label={t("agenda_page.specific_edit_aria")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(s.id)}
                      className="p-1 text-muted-foreground transition-colors hover:text-destructive"
                      aria-label={t("agenda_page.specific_delete_aria")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {slots.length > 5 && (
              <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                {showAll
                  ? t("agenda_page.specific_view_less")
                  : t("agenda_page.specific_view_more", { n: slots.length })}
              </Button>
            )}
          </div>
        )}
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("agenda_page.specific_edit") : t("agenda_page.specific_new")}
            </DialogTitle>
            <DialogDescription>{t("agenda_page.specific_dialog_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="specific-date">{t("agenda_page.specific_date")}</Label>
              <Input
                id="specific-date"
                type="date"
                min={todayStr}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="specific-start">{t("agenda_page.specific_start")}</Label>
                <Input id="specific-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="specific-end">{t("agenda_page.specific_end")}</Label>
                <Input id="specific-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("agenda_page.specific_cancel")}
            </Button>
            <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? t("agenda_page.specific_save") : t("agenda_page.specific_add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
