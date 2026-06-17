import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Ban, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateOnly, parseDateOnly, localeForI18n } from "@/lib/dateUtils";

export interface Unavailability {
  id: string;
  therapist_id: string;
  start_date: string;
  end_date: string;
  is_all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

interface Props {
  therapistId: string;
  quickBlockDate?: string | null;
  onQuickBlockHandled?: () => void;
}

export default function UnavailabilityManager({ therapistId, quickBlockDate, onQuickBlockHandled }: Props) {
  const { t, i18n } = useTranslation();
  const locale = localeForI18n(i18n.language);
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);

  const REASON_CHIPS = [
    t("agenda_page.unavail_reason_holiday"),
    t("agenda_page.unavail_reason_training"),
    t("agenda_page.unavail_reason_personal"),
    t("agenda_page.unavail_reason_sick"),
  ];

  const [quickOpen, setQuickOpen] = useState(false);
  const [quickMode, setQuickMode] = useState<"all" | "range">("all");
  const [quickStart, setQuickStart] = useState("09:00");
  const [quickEnd, setQuickEnd] = useState("12:00");
  const [quickReason, setQuickReason] = useState("");
  const [quickDate, setQuickDate] = useState("");

  const [periodOpen, setPeriodOpen] = useState(false);
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [periodAllDay, setPeriodAllDay] = useState(true);
  const [periodStart, setPeriodStart] = useState("09:00");
  const [periodEnd, setPeriodEnd] = useState("18:00");
  const [periodReason, setPeriodReason] = useState("");

  useEffect(() => {
    if (quickBlockDate) {
      setQuickDate(quickBlockDate);
      setQuickMode("all");
      setQuickReason("");
      setQuickStart("09:00");
      setQuickEnd("12:00");
      setQuickOpen(true);
      onQuickBlockHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickBlockDate]);

  const { data: unavailabilities = [] } = useQuery({
    queryKey: ["unavailabilities", therapistId],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("blocked_periods")
        .select("id, therapist_id, start_date, end_date, is_all_day, start_time, end_time, reason")
        .eq("therapist_id", therapistId)
        .gte("end_date", today)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Unavailability[];
    },
    enabled: !!therapistId,
  });

  const formatRange = (u: Unavailability) => {
    const s = parseDateOnly(u.start_date);
    const e = parseDateOnly(u.end_date);
    if (!s || !e) return `${u.start_date} → ${u.end_date}`;
    const dateFmt: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };
    const sameDay = s.toDateString() === e.toDateString();
    const allDay = t("agenda_page.unavail_all_day_suffix");
    if (u.is_all_day && sameDay) return `${s.toLocaleDateString(locale, dateFmt)} – ${allDay}`;
    if (u.is_all_day) return `${s.toLocaleDateString(locale, dateFmt)} → ${e.toLocaleDateString(locale, dateFmt)} – ${allDay}`;
    const st = (u.start_time ?? "00:00").slice(0, 5);
    const et = (u.end_time ?? "23:59").slice(0, 5);
    return `${s.toLocaleDateString(locale, dateFmt)} · ${st} – ${et}`;
  };

  type NewRow = Pick<Unavailability, "start_date" | "end_date" | "is_all_day" | "start_time" | "end_time" | "reason">;

  const createMutation = useMutation({
    mutationFn: async (rows: NewRow[]) => {
      const payload = rows.map((r) => ({ ...r, therapist_id: therapistId }));
      const { error } = await supabase.from("blocked_periods").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("agenda_page.unavail_saved"));
      queryClient.invalidateQueries({ queryKey: ["unavailabilities", therapistId] });
      setQuickOpen(false);
      setPeriodOpen(false);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blocked_periods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("agenda_page.unavail_deleted"));
      queryClient.invalidateQueries({ queryKey: ["unavailabilities", therapistId] });
    },
  });

  const handleQuickConfirm = () => {
    if (!quickDate) return;
    if (quickMode === "all") {
      createMutation.mutate([{
        start_date: quickDate,
        end_date: quickDate,
        is_all_day: true,
        start_time: null,
        end_time: null,
        reason: quickReason || null,
      }]);
    } else {
      if (quickStart >= quickEnd) {
        toast.error(t("agenda_page.unavail_err_time_order"));
        return;
      }
      createMutation.mutate([{
        start_date: quickDate,
        end_date: quickDate,
        is_all_day: false,
        start_time: `${quickStart}:00`,
        end_time: `${quickEnd}:00`,
        reason: quickReason || null,
      }]);
    }
  };

  const handlePeriodConfirm = () => {
    if (!periodFrom || !periodTo) { toast.error(t("agenda_page.unavail_err_period")); return; }
    if (periodFrom > periodTo) { toast.error(t("agenda_page.unavail_err_order")); return; }
    if (!periodAllDay && periodStart >= periodEnd) { toast.error(t("agenda_page.unavail_err_time_order")); return; }

    if (periodAllDay) {
      createMutation.mutate([{
        start_date: periodFrom,
        end_date: periodTo,
        is_all_day: true,
        start_time: null,
        end_time: null,
        reason: periodReason || null,
      }]);
      return;
    }

    // One row per day for partial-time periods
    const rows: NewRow[] = [];
    const cur = parseDateOnly(periodFrom);
    const end = parseDateOnly(periodTo);
    if (!cur || !end) { toast.error(t("agenda_page.unavail_err_dates")); return; }
    while (cur <= end) {
      const d = formatDateOnly(cur);
      rows.push({
        start_date: d,
        end_date: d,
        is_all_day: false,
        start_time: `${periodStart}:00`,
        end_time: `${periodEnd}:00`,
        reason: periodReason || null,
      });
      cur.setDate(cur.getDate() + 1);
    }
    createMutation.mutate(rows);
  };

  const visible = showAll ? unavailabilities : unavailabilities.slice(0, 5);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5" aria-hidden />
              {t("agenda_page.unavail_my_title")}
              {unavailabilities.length > 0 && (
                <Badge variant="secondary">{unavailabilities.length}</Badge>
              )}
            </CardTitle>
            <Button
              size="sm"
              onClick={() => {
                setPeriodFrom("");
                setPeriodTo("");
                setPeriodReason("");
                setPeriodAllDay(true);
                setPeriodStart("09:00");
                setPeriodEnd("18:00");
                setPeriodOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> {t("agenda_page.unavail_add_period")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {unavailabilities.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("agenda_page.unavail_empty")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {visible.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                    <span className="truncate">{formatRange(u)}</span>
                    {u.reason && <Badge variant="outline" className="shrink-0">{u.reason}</Badge>}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(u.id)}
                    className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-destructive"
                    aria-label={t("agenda_page.unavail_delete_aria")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {unavailabilities.length > 5 && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAll((v) => !v)}>
              {showAll
                ? t("agenda_page.unavail_view_less")
                : t("agenda_page.unavail_view_more", { n: unavailabilities.length })}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Quick block dialog */}
      <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("agenda_page.unavail_quick_title")}</DialogTitle>
            {quickDate && (
              <DialogDescription>
                {(parseDateOnly(quickDate) ?? new Date(quickDate)).toLocaleDateString(locale, {
                  weekday: "long", day: "numeric", month: "long",
                })}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4">
            {!quickBlockDate && (
              <div className="space-y-1.5">
                <Label htmlFor="quick-date">{t("agenda_page.specific_date")}</Label>
                <Input id="quick-date" type="date" min={todayStr} value={quickDate} onChange={(e) => setQuickDate(e.target.value)} />
              </div>
            )}
            <RadioGroup value={quickMode} onValueChange={(v) => setQuickMode(v as "all" | "range")}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="all" id="qm-all" />
                <Label htmlFor="qm-all">{t("agenda_page.unavail_all_day")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="range" id="qm-range" />
                <Label htmlFor="qm-range">{t("agenda_page.unavail_time_range")}</Label>
              </div>
            </RadioGroup>

            {quickMode === "range" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="qs">{t("agenda_page.unavail_from")}</Label>
                  <Input id="qs" type="time" value={quickStart} onChange={(e) => setQuickStart(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qe">{t("agenda_page.unavail_to")}</Label>
                  <Input id="qe" type="time" value={quickEnd} onChange={(e) => setQuickEnd(e.target.value)} />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="qr">{t("agenda_page.unavail_reason_opt")}</Label>
              <Input id="qr" value={quickReason} onChange={(e) => setQuickReason(e.target.value)} placeholder={t("agenda_page.unavail_reason_ph")} />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {REASON_CHIPS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setQuickReason(r)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      quickReason === r
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickOpen(false)}>{t("agenda_page.unavail_cancel")}</Button>
            <Button onClick={handleQuickConfirm} disabled={createMutation.isPending || !quickDate}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("agenda_page.unavail_quick_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Period dialog */}
      <Dialog open={periodOpen} onOpenChange={setPeriodOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("agenda_page.unavail_period_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pf">{t("agenda_page.unavail_period_from")}</Label>
                <Input id="pf" type="date" min={todayStr} value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pt">{t("agenda_page.unavail_period_to")}</Label>
                <Input id="pt" type="date" min={periodFrom || todayStr} value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="pad" checked={periodAllDay} onCheckedChange={(c) => setPeriodAllDay(c === true)} />
              <Label htmlFor="pad">{t("agenda_page.unavail_period_all_day")}</Label>
            </div>

            {!periodAllDay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ps">{t("agenda_page.unavail_from")}</Label>
                  <Input id="ps" type="time" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pe">{t("agenda_page.unavail_to")}</Label>
                  <Input id="pe" type="time" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="pr">{t("agenda_page.unavail_reason_opt")}</Label>
              <Input id="pr" value={periodReason} onChange={(e) => setPeriodReason(e.target.value)} placeholder={t("agenda_page.unavail_reason_ph_long")} />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {REASON_CHIPS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setPeriodReason(r)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      periodReason === r
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPeriodOpen(false)}>{t("agenda_page.unavail_cancel")}</Button>
            <Button onClick={handlePeriodConfirm} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("agenda_page.unavail_period_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
