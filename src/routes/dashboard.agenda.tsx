import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { listMyAgenda } from "@/lib/dashboard.functions";
import BookingNoteEditor from "@/components/dashboard/BookingNoteEditor";
import InteractiveAgenda from "@/components/dashboard/InteractiveAgenda";
import SpecificAvailabilityManager from "@/components/dashboard/SpecificAvailabilityManager";
import UnavailabilityManager from "@/components/dashboard/UnavailabilityManager";
import WeeklyScheduleEditor from "@/components/dashboard/WeeklyScheduleEditor";

export const Route = createFileRoute("/dashboard/agenda")({ component: Page });

function Page() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const fetchAgenda = useServerFn(listMyAgenda);
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { therapistId: thId } = await fetchAgenda();
        setTherapistId(thId);
      } catch {
        setTherapistId(null);
      }
      setLoading(false);
    })();
  }, [fetchAgenda, user]);

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

      {therapistId && <WeeklyScheduleEditor therapistId={therapistId} />}

      {therapistId && <BookingNoteEditor therapistId={therapistId} />}

      {therapistId && <SpecificAvailabilityManager therapistId={therapistId} />}

      {therapistId && (
        <InteractiveAgenda therapistId={therapistId} />
      )}

      {therapistId && <UnavailabilityManager therapistId={therapistId} />}
    </div>
  );
}
