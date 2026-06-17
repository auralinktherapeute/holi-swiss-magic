import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getBookedAppointmentSlots } from "@/lib/public.functions";
import { z } from "zod";
import { useFormDraft } from "@/hooks/use-form-draft";
import { DraftSavedIndicator } from "@/components/drafts/DraftBanner";
import { useSessionState } from "@/hooks/use-session-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Avail = { day_of_week: number; start_time: string; end_time: string; is_active: boolean };
type Block = { start_date: string; end_date: string };
type Appt = { appointment_date: string; appointment_time: string };
export type BookingService = { name: string; duration?: number; price?: number; format?: string; color?: string; description?: string };

function toISODate(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function dowMonFirst(d: Date) { return (d.getDay() + 6) % 7; } // 0=Lun
function buildSlots(start: string, end: string, slotMin: number): string[] {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const out: string[] = [];
  let cur = sh * 60 + sm; const max = eh * 60 + em;
  while (cur + slotMin <= max) {
    out.push(`${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`);
    cur += slotMin;
  }
  return out;
}

export function BookingWidget({ therapistId, therapistName, services = [] }: { therapistId: string; therapistName?: string; services?: BookingService[] }) {
  const { t } = useTranslation();
  const fetchBookedSlots = useServerFn(getBookedAppointmentSlots);
  const DAY_LABELS = t("booking.days", { returnObjects: true }) as string[];
  const MONTHS = t("booking.months", { returnObjects: true }) as string[];
  const schema = z.object({
    name: z.string().trim().min(2, t("booking.name_too_short")).max(120),
    email: z.string().trim().email(t("booking.email_invalid")).max(200),
    phone: z.string().trim().max(40).optional().or(z.literal("")),
    notes: z.string().max(1000).optional().or(z.literal("")),
  });
  const statePrefix = `booking.${therapistId}`;
  const [selectedServiceIdx, setSelectedServiceIdx] = useSessionState<number | null>(`${statePrefix}.serviceIdx`, null);
  const [month, setMonth] = useSessionState(`${statePrefix}.month`, () => { const d = new Date(); d.setDate(1); return d; });
  const [avs, setAvs] = useState<Avail[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [taken, setTaken] = useState<Appt[]>([]);
  const [selectedDate, setSelectedDate] = useSessionState<string | null>(`${statePrefix}.selectedDate`, null);
  const [selectedTime, setSelectedTime] = useSessionState<string | null>(`${statePrefix}.selectedTime`, null);
  const [form, setForm] = useSessionState(`${statePrefix}.form`, { name: "", email: "", phone: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formTouched, setFormTouched] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const autoRestoredRef = useRef(false);

  const selectedService: BookingService | null =
    selectedServiceIdx !== null && services[selectedServiceIdx] ? services[selectedServiceIdx] : null;
  const slotMin = Math.max(15, Number(selectedService?.duration) || 60);
  const accent = selectedService?.color;

  const { initialDraft, status: draftStatus, savedAt, clearDraft, dismissDraft } = useFormDraft({
    formType: `booking:${therapistId}`,
    data: form,
    enabled: formTouched && !success,
  });
  useEffect(() => {
    if (autoRestoredRef.current || !initialDraft) return;
    autoRestoredRef.current = true;
    setForm(initialDraft as typeof form);
    setFormTouched(true);
    dismissDraft();
  }, [dismissDraft, initialDraft]);

  const updateForm = (patch: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setFormTouched(true);
  };

  useEffect(() => {
    (async () => {
      const [{ data: a }, { data: b }] = await Promise.all([
        supabase.from("availabilities").select("day_of_week,start_time,end_time,is_active").eq("therapist_id", therapistId).eq("is_active", true).not("day_of_week", "is", null),
        supabase.from("public_blocked_periods" as never).select("start_date,end_date,is_all_day").eq("therapist_id", therapistId),
      ]);
      setAvs((a ?? []).filter((x) => x.day_of_week !== null) as Avail[]);
      // Only all-day blocks fully prevent date selection; partial-time blocks remain
      // (the booking widget operates at day granularity for now).
      setBlocks(((b ?? []) as Array<{ start_date: string; end_date: string; is_all_day?: boolean }>)
        .filter((x) => x.is_all_day !== false)
        .map(({ start_date, end_date }) => ({ start_date, end_date })));
    })();
  }, [therapistId]);

  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    fetchBookedSlots({ data: { therapistId, appointmentDate: selectedDate } })
      .then(({ slots }) => {
        if (!cancelled) setTaken(slots as Appt[]);
      })
      .catch(() => {
        if (!cancelled) setTaken([]);
      });
    return () => { cancelled = true; };
  }, [fetchBookedSlots, selectedDate, therapistId]);

  const days = useMemo(() => {
    const first = new Date(month);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const lead = dowMonFirst(first);
    const cells: ({ date: Date; iso: string; available: boolean; blocked: boolean; past: boolean } | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let d = 1; d <= last.getDate(); d++) {
      const date = new Date(month.getFullYear(), month.getMonth(), d);
      const iso = toISODate(date);
      const dow = dowMonFirst(date);
      const hasAvail = avs.some((a) => a.day_of_week === dow);
      const blocked = blocks.some((b) => iso >= b.start_date && iso <= b.end_date);
      const past = date < today;
      cells.push({ date, iso, available: hasAvail && !blocked && !past, blocked, past });
    }
    return cells;
  }, [month, avs, blocks]);

  const slotsForDay = useMemo(() => {
    if (!selectedDate) return [];
    const dow = dowMonFirst(new Date(selectedDate + "T00:00:00"));
    const dayAvs = avs.filter((a) => a.day_of_week === dow);
    const all = dayAvs.flatMap((a) => buildSlots(a.start_time.slice(0, 5), a.end_time.slice(0, 5), slotMin));
    const takenSet = new Set(taken.map((t) => t.appointment_time.slice(0, 5)));
    return all.filter((s) => !takenSet.has(s));
  }, [selectedDate, avs, taken, slotMin]);

  const openConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (services.length > 0 && !selectedService) { toast.error("Veuillez choisir un service."); return; }
    if (!selectedDate || !selectedTime) { toast.error(t("booking.choose_slot")); return; }
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setConfirmOpen(true);
  };

  const confirmBooking = async () => {
    if (!selectedDate || !selectedTime) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSubmitting(true);
    const { error } = await supabase.from("appointments").insert({
      therapist_id: therapistId,
      patient_name: parsed.data.name,
      patient_email: parsed.data.email,
      patient_phone: parsed.data.phone || null,
      appointment_date: selectedDate,
      appointment_time: selectedTime,
      duration_minutes: slotMin,
      service_name: selectedService?.name ?? null,
      notes: parsed.data.notes || null,
      status: "pending",
    });
    setSubmitting(false);
    setConfirmOpen(false);
    if (error) {
      console.error("[booking] appointment insert failed", error);
      toast.error(t("booking.error_generic", "Impossible d'envoyer la demande. Veuillez réessayer."));
      return;
    }
    // eslint-disable-next-line no-console
    console.log("[booking] confirmation email →", parsed.data.email, { selectedDate, selectedTime });
    setSuccess(true);
    await clearDraft();
    toast.success(t("booking.request_sent_toast"));
  };

  if (success) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-6 text-center space-y-3">
          <div className="text-lg font-semibold text-foreground">{t("booking.request_sent_title")}</div>
          <p className="text-sm text-muted-foreground">{t("booking.request_sent_desc")}</p>
        </CardContent>
      </Card>
    );
  }

  const monthLabel = `${MONTHS[month.getMonth()]} ${month.getFullYear()}`;

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-lg">{t("booking.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {services.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">1. Choisissez un service</div>
            <div className="grid gap-2">
              {services.map((s, i) => {
                const sel = selectedServiceIdx === i;
                return (
                  <button
                    key={`${s.name}-${i}`}
                    type="button"
                    onClick={() => { setSelectedServiceIdx(i); setSelectedDate(null); setSelectedTime(null); }}
                    className={`text-left rounded-md border p-3 transition-colors ${sel ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-foreground">{s.name}</div>
                      {s.price != null && <div className="text-sm font-semibold text-primary">{s.price} CHF</div>}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {s.duration ? `${s.duration} min` : "Durée non précisée"}
                      {s.format ? ` · ${s.format}` : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className={services.length > 0 && !selectedService ? "pointer-events-none opacity-40" : ""} aria-disabled={services.length > 0 && !selectedService}>
          {services.length > 0 && <div className="text-sm font-medium mb-2">2. Choisissez une date</div>}
          <div className="flex items-center justify-between mb-3">
            <Button type="button" size="sm" variant="ghost" aria-label={t("booking.prev_month")}
              onClick={() => { const d = new Date(month); d.setMonth(d.getMonth() - 1); setMonth(d); setSelectedDate(null); setSelectedTime(null); }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium capitalize">{monthLabel}</div>
            <Button type="button" size="sm" variant="ghost" aria-label={t("booking.next_month")}
              onClick={() => { const d = new Date(month); d.setMonth(d.getMonth() + 1); setMonth(d); setSelectedDate(null); setSelectedTime(null); }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
            {DAY_LABELS.map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((c, i) => {
              if (!c) return <div key={i} />;
              const isSel = selectedDate === c.iso;
              const base = "h-10 rounded-md text-sm flex items-center justify-center transition-colors";
              if (c.past) return <div key={i} className={`${base} text-muted-foreground/40`}>{c.date.getDate()}</div>;
              if (c.blocked) return <div key={i} className={`${base} bg-muted/30 text-muted-foreground/60 line-through`}>{c.date.getDate()}</div>;
              if (!c.available) return <div key={i} className={`${base} text-muted-foreground/50`}>{c.date.getDate()}</div>;
              return (
                <button key={i} type="button" onClick={() => { setSelectedDate(c.iso); setSelectedTime(null); }}
                  className={`${base} font-medium ${isSel ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>
                  {c.date.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {selectedDate && (
          <div>
            <div className="text-sm font-medium mb-2">{t("booking.available_slots")}</div>
            {slotsForDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("booking.no_slots")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slotsForDay.map((s) => (
                  <Badge key={s} onClick={() => setSelectedTime(s)}
                    className={`cursor-pointer px-3 py-1.5 text-sm ${selectedTime === s ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedDate && selectedTime && (services.length === 0 || selectedService) && (
          <form onSubmit={openConfirm} className="space-y-3 border-t border-border pt-4">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <div className="font-medium mb-1">Récapitulatif</div>
              {selectedService && <div><span className="text-muted-foreground">Service :</span> <strong>{selectedService.name}</strong></div>}
              <div><span className="text-muted-foreground">Date :</span> <strong>{selectedDate}</strong> à <strong>{selectedTime}</strong></div>
              <div><span className="text-muted-foreground">Durée :</span> <strong>{slotMin} min</strong>{selectedService?.price != null && <> · <span className="text-muted-foreground">Tarif :</span> <strong>{selectedService.price} CHF</strong></>}</div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label htmlFor="bk-name">{t("booking.full_name")}</Label>
                <Input id="bk-name" value={form.name} onChange={(e) => updateForm({ name: e.target.value })} required maxLength={120} /></div>
              <div><Label htmlFor="bk-email">{t("auth.email")}</Label>
                <Input id="bk-email" type="email" value={form.email} onChange={(e) => updateForm({ email: e.target.value })} required maxLength={200} /></div>
            </div>
            <div><Label htmlFor="bk-phone">{t("booking.phone_optional")}</Label>
              <Input id="bk-phone" type="tel" value={form.phone} onChange={(e) => updateForm({ phone: e.target.value })} maxLength={40} /></div>
            <div><Label htmlFor="bk-notes">{t("booking.message_optional")}</Label>
              <Textarea id="bk-notes" value={form.notes} onChange={(e) => updateForm({ notes: e.target.value })} maxLength={1000} rows={3} /></div>
            <div className="flex justify-end"><DraftSavedIndicator status={draftStatus} savedAt={savedAt} /></div>
            <Button type="submit" disabled={submitting} className="w-full bg-primary hover:bg-primary/90">
              {submitting ? t("booking.sending") : t("booking.book_at", { date: selectedDate, time: selectedTime })}
            </Button>
          </form>
        )}

        <AlertDialog open={confirmOpen} onOpenChange={(o) => { if (!submitting) setConfirmOpen(o); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer votre rendez-vous</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm">
                  <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1 text-foreground">
                    {therapistName && <div><span className="text-muted-foreground">Thérapeute :</span> <strong>{therapistName}</strong></div>}
                    {selectedService && <div><span className="text-muted-foreground">Service :</span> <strong>{selectedService.name}</strong></div>}
                    {selectedDate && <div><span className="text-muted-foreground">Date :</span> <strong>{selectedDate}</strong></div>}
                    {selectedTime && <div><span className="text-muted-foreground">Heure :</span> <strong>{selectedTime}</strong></div>}
                    <div><span className="text-muted-foreground">Durée :</span> <strong>{slotMin} min</strong></div>
                    {selectedService?.price != null && <div><span className="text-muted-foreground">Tarif :</span> <strong>{selectedService.price} CHF</strong></div>}
                  </div>
                  <p className="leading-relaxed">
                    Ce rendez-vous sera réservé exclusivement pour vous. Un thérapeute se prépare pour vous accueillir — merci de respecter cet engagement ou de l'annuler 24h avant. Merci.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                disabled={submitting}
                onClick={(e) => { e.preventDefault(); void confirmBooking(); }}
                className="bg-primary hover:bg-primary/90"
              >
                {submitting ? "Envoi…" : "✅ Confirmer mon rendez-vous"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}