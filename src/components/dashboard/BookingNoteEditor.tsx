import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getMyBookingNote, saveMyBookingNote } from "@/lib/booking-note.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Info, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { hasSessionState, useSessionState } from "@/hooks/use-session-state";

const MAX_LEN = 500;

export default function BookingNoteEditor({ therapistId }: { therapistId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const stateKey = `dashboard.booking-note.${therapistId}`;
  const [value, setValue] = useSessionState(stateKey, "");

  const { data, isLoading } = useQuery({
    queryKey: ["therapist-booking-note", therapistId],
    queryFn: () => getMyBookingNote({ data: { therapistId } }),
    enabled: !!therapistId,
  });

  useEffect(() => {
    if (data === undefined) return;
    if (hasSessionState(stateKey) && value !== "") return;
    setValue(data?.booking_note ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.booking_note, setValue, stateKey]);

  const saveMutation = useMutation({
    mutationFn: async (note: string) => {
      await saveMyBookingNote({ data: { therapistId, note } });
    },
    onSuccess: () => {
      toast.success(t("agenda_page.note_saved"));
      queryClient.invalidateQueries({ queryKey: ["therapist-booking-note", therapistId] });
    },
    onError: (e: any) => toast.error(e?.message ?? t("agenda_page.note_error")),
  });

  const dirty = (data?.booking_note ?? "") !== value;

  return (
    <Card className="bg-surface border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="w-4 h-4 text-primary" />
          {t("agenda_page.note_title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">{t("agenda_page.note_desc")}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_LEN))}
          rows={4}
          placeholder={t("agenda_page.note_ph")}
          disabled={isLoading}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t("agenda_page.note_count", { n: value.length, max: MAX_LEN })}
          </span>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate(value)}
            disabled={!dirty || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {t("agenda_page.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}