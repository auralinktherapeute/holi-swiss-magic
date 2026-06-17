import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { addMyBlockedPeriod, deleteMyBlockedPeriod, listMyAgenda, saveMyAvailabilities } from "@/lib/dashboard.functions";
import BookingNoteEditor from "@/components/dashboard/BookingNoteEditor";
import InteractiveAgenda from "@/components/dashboard/InteractiveAgenda";
import SpecificAvailabilityManager from "@/components/dashboard/SpecificAvailabilityManager";

export const Route = createFileRoute("/dashboard/agenda")({ component: Page });

type Slot = { id?: string; day_of_week: number; start_time: string; end_time: string; is_active: boolean };
type Block = { id?: string; start_date: string; end_date: string; reason: string };

function Page() {
  const { t } = useTranslation();
  const DAYS = t("agenda_page.days", { returnObjects: true }) as string[];
  const { user } = useAuth();
  const fetchAgenda = useServerFn(listMyAgenda);
  const addBlockedPeriod = useServerFn(addMyBlockedPeriod);
  const deleteBlockedPeriod = useServerFn(deleteMyBlockedPeriod);
  const saveAvailabilities = useServerFn(saveMyAvailabilities);
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>(
    Array.from({ length: 7 }, (_, i) => ({ day_of_week: i, start_time: "09:00", end_time: "18:00", is_active: i < 5 })),
  );
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [newBlock, setNewBlock] = useState<Block>({ start_date: "", end_date: "", reason: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { therapistId: thId, availabilities: avs, blockedPeriods: bps } = await fetchAgenda();
        setTherapistId(thId);
        if (avs?.length) {
        setSlots(Array.from({ length: 7 }, (_, i) => {
          const found = avs.find((a) => a.day_of_week === i);
          return found
            ? { id: found.id, day_of_week: i, start_time: found.start_time.slice(0, 5), end_time: found.end_time.slice(0, 5), is_active: found.is_active }
            : { day_of_week: i, start_time: "09:00", end_time: "18:00", is_active: false };
        }));
        }
        setBlocks((bps ?? []).map((b) => ({ id: b.id, start_date: b.start_date, end_date: b.end_date, reason: b.reason ?? "" })));
      } catch {
        setTherapistId(null);
      }
      setLoading(false);
    })();
  }, [fetchAgenda, user]);

  const update = (i: number, patch: Partial<Slot>) =>
    setSlots((s) => s.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const addBlock = async () => {
    if (!therapistId || !newBlock.start_date || !newBlock.end_date) {
      toast.error(t("agenda_page.fill_dates")); return;
    }
    try {
      const { row } = await addBlockedPeriod({ data: { start_date: newBlock.start_date, end_date: newBlock.end_date, reason: newBlock.reason || undefined } });
      setBlocks((b) => [...b, { id: row.id, start_date: row.start_date, end_date: row.end_date, reason: row.reason ?? "" }]);
      setNewBlock({ start_date: "", end_date: "", reason: "" });
      toast.success(t("agenda_page.block_added"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur d'ajout");
    }
  };

  const removeBlock = async (id?: string) => {
    if (!id) return;
    try {
      await deleteBlockedPeriod({ data: { id } });
      setBlocks((b) => b.filter((x) => x.id !== id));
      toast.success(t("agenda_page.block_removed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur de suppression");
    }
  };

  const save = async () => {
    if (!therapistId) { toast.error(t("agenda_page.complete_profile")); return; }
    setSaving(true);
    try {
      await saveAvailabilities({ data: { slots: slots.map(({ day_of_week, start_time, end_time, is_active }) => ({ day_of_week, start_time, end_time, is_active })) } });
      toast.success(t("agenda_page.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur d'enregistrement");
    }
    setSaving(false);
  };

  if (loading) return <div className="p-10 text-muted-foreground">{t("agenda_page.loading")}</div>;

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t("agenda_page.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("agenda_page.subtitle")}</p>
      </div>

      {!therapistId && (
        <Card className="border-yellow-500/30 bg-yellow-500/10">
          <CardContent className="p-4 text-sm text-yellow-200">{t("agenda_page.complete_profile")}</CardContent>
        </Card>
      )}

      <Card className="bg-surface border-border/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("agenda_page.weekly_hours")}</CardTitle>
          <Badge className="bg-primary-xlight text-primary border-primary/20">{t("agenda_page.timezone")}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {slots.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-4 rounded-lg border border-border/60 bg-background/40 p-4">
              <div className="w-28 font-medium text-foreground">{DAYS[i]}</div>
              <Switch checked={s.is_active} onCheckedChange={(v) => update(i, { is_active: v })} />
              {s.is_active ? (
                <div className="flex items-center gap-2">
                  <Input type="time" value={s.start_time} onChange={(e) => update(i, { start_time: e.target.value })} className="w-32" />
                  <span className="text-muted-foreground">→</span>
                  <Input type="time" value={s.end_time} onChange={(e) => update(i, { end_time: e.target.value })} className="w-32" />
                </div>
              ) : <span className="text-sm text-muted-foreground">{t("agenda_page.closed")}</span>}
            </div>
          ))}
        </CardContent>
      </Card>

      {therapistId && <BookingNoteEditor therapistId={therapistId} />}

      {therapistId && <SpecificAvailabilityManager therapistId={therapistId} />}

      {therapistId && (
        <Card className="bg-surface border-border/60">
          <CardHeader><CardTitle>{t("agenda_page.title")}</CardTitle></CardHeader>
          <CardContent>
            <InteractiveAgenda therapistId={therapistId} />
          </CardContent>
        </Card>
      )}

      <Card className="bg-surface border-border/60">
        <CardHeader><CardTitle>{t("agenda_page.unavail_title")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1"><label className="text-xs text-muted-foreground">{t("agenda_page.from")}</label>
              <Input type="date" value={newBlock.start_date} onChange={(e) => setNewBlock({ ...newBlock, start_date: e.target.value })} /></div>
            <div className="space-y-1"><label className="text-xs text-muted-foreground">{t("agenda_page.to")}</label>
              <Input type="date" value={newBlock.end_date} onChange={(e) => setNewBlock({ ...newBlock, end_date: e.target.value })} /></div>
            <div className="space-y-1 flex-1 min-w-[180px]"><label className="text-xs text-muted-foreground">{t("agenda_page.reason")}</label>
              <Input value={newBlock.reason} placeholder={t("agenda_page.reason_ph")} onChange={(e) => setNewBlock({ ...newBlock, reason: e.target.value })} /></div>
            <Button onClick={addBlock} disabled={!therapistId} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-1" /> {t("agenda_page.add")}
            </Button>
          </div>
          {blocks.length === 0 ? (
            <div className="rounded-lg border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">{t("agenda_page.no_blocks")}</div>
          ) : (
            <ul className="space-y-2">
              {blocks.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-3 text-sm">
                  <div>
                    <span className="font-medium text-foreground">{b.start_date} → {b.end_date}</span>
                    {b.reason && <span className="ml-2 text-muted-foreground">— {b.reason}</span>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeBlock(b.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || !therapistId} className="bg-primary hover:bg-primary/90">
          {saving ? t("agenda_page.saving") : t("agenda_page.save")}
        </Button>
      </div>
    </div>
  );
}
