import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, CalendarClock } from "lucide-react";
import { toast } from "sonner";

interface Props {
  therapistId: string;
}

interface DayRow {
  active: boolean;
  start: string;
  end: string;
}

const DEFAULT_ROW: DayRow = { active: false, start: "09:00", end: "18:00" };

// Display order: Monday → Sunday. JS getDay() values (0 = Sunday).
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export default function WeeklyScheduleEditor({ therapistId }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // i18n days are indexed Monday..Sunday (locale label order from agenda_page.days).
  const DAY_LABELS = t("agenda_page.days", { returnObjects: true }) as string[];

  const [rows, setRows] = useState<Record<number, DayRow>>(() =>
    Object.fromEntries(DAY_ORDER.map((d) => [d, { ...DEFAULT_ROW }])),
  );

  const { data: existing, isLoading } = useQuery({
    queryKey: ["weekly-schedule", therapistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("availabilities")
        .select("id, day_of_week, start_time, end_time, is_active, specific_date")
        .eq("therapist_id", therapistId)
        .is("specific_date", null);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!therapistId,
  });

  useEffect(() => {
    if (!existing) return;
    const next: Record<number, DayRow> = Object.fromEntries(
      DAY_ORDER.map((d) => [d, { ...DEFAULT_ROW }]),
    );
    for (const slot of existing) {
      if (!slot.is_active || slot.day_of_week === null) continue;
      const dow = slot.day_of_week as number;
      const cur = next[dow];
      if (!cur) continue;
      const start = slot.start_time.slice(0, 5);
      const end = slot.end_time.slice(0, 5);
      if (!cur.active) {
        next[dow] = { active: true, start, end };
      } else {
        next[dow] = {
          active: true,
          start: start < cur.start ? start : cur.start,
          end: end > cur.end ? end : cur.end,
        };
      }
    }
    setRows(next);
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (let i = 0; i < DAY_ORDER.length; i++) {
        const dow = DAY_ORDER[i];
        const r = rows[dow];
        if (r.active && r.start >= r.end) {
          throw new Error(t("agenda_page.weekly_err_range", { day: DAY_LABELS[i] }));
        }
      }
      // Replace recurring slots only (keep specific-date slots untouched).
      const { error: delErr } = await supabase
        .from("availabilities")
        .delete()
        .eq("therapist_id", therapistId)
        .is("specific_date", null);
      if (delErr) throw delErr;

      const toInsert = DAY_ORDER
        .filter((d) => rows[d].active)
        .map((d) => ({
          therapist_id: therapistId,
          day_of_week: d,
          start_time: rows[d].start,
          end_time: rows[d].end,
          is_active: true,
        }));

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from("availabilities").insert(toInsert);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      toast.success(t("agenda_page.weekly_saved"));
      queryClient.invalidateQueries({ queryKey: ["weekly-schedule", therapistId] });
      queryClient.invalidateQueries({ queryKey: ["availabilities"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : t("agenda_page.fail_save")),
  });

  const update = (dow: number, patch: Partial<DayRow>) =>
    setRows((prev) => ({ ...prev, [dow]: { ...prev[dow], ...patch } }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5" aria-hidden />
          {t("agenda_page.weekly_title")}
        </CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">{t("agenda_page.weekly_desc")}</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {DAY_ORDER.map((dow, i) => {
              const row = rows[dow];
              const label = DAY_LABELS[i] ?? "";
              return (
                <div
                  key={dow}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-background/40 p-3"
                >
                  <label className="flex w-32 items-center gap-2 text-sm font-medium">
                    <Checkbox
                      checked={row.active}
                      onCheckedChange={(v) => update(dow, { active: v === true })}
                    />
                    {label}
                  </label>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Input
                      type="time"
                      value={row.start}
                      disabled={!row.active}
                      onChange={(e) => update(dow, { start: e.target.value })}
                      className="w-[110px]"
                    />
                    <span>→</span>
                    <Input
                      type="time"
                      value={row.end}
                      disabled={!row.active}
                      onChange={(e) => update(dow, { end: e.target.value })}
                      className="w-[110px]"
                    />
                  </div>
                </div>
              );
            })}
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("agenda_page.weekly_save")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
