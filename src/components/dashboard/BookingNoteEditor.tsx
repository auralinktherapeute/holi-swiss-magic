import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Info, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

const MAX_LEN = 500;

export default function BookingNoteEditor({ therapistId }: { therapistId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["therapist-booking-note", therapistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapists")
        .select("booking_note")
        .eq("id", therapistId)
        .maybeSingle();
      if (error) throw error;
      return data as { booking_note: string | null } | null;
    },
    enabled: !!therapistId,
  });

  useEffect(() => {
    setValue(data?.booking_note ?? "");
  }, [data?.booking_note]);

  const saveMutation = useMutation({
    mutationFn: async (note: string) => {
      const { error } = await supabase
        .from("therapists")
        .update({ booking_note: note.trim() ? note.trim() : null })
        .eq("id", therapistId);
      if (error) throw error;
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