import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

type Avail = { day_of_week: number; start_time: string; end_time: string; is_active: boolean };
type Block = { start_date: string; end_date: string };
type Appt = { appointment_date: string; appointment_time: string };

const SLOT_MIN = 60;
const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

const schema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(120),
  email: z.string().trim().email("Email invalide").max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

function toISODate(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function dowMonFirst(d: Date) { return (d.getDay() + 6) % 7; } // 0=Lun
function buildSlots(start: string, end: string): string[] {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const out: string[] = [];
  let cur = sh * 60 + sm; const max = eh * 60 + em;
  while (cur + SLOT_MIN <= max) {
    out.push(`${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`);
    cur += SLOT_MIN;
  }
  return out;
}

export function BookingWidget({ therapistId }: { therapistId: string }) {
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [avs, setAvs] = useState<Avail[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [taken, setTaken] = useState<Appt[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: a }, { data: b }] = await Promise.all([
        supabase.from("availabilities").select("day_of_week,start_time,end_time,is_active").eq("therapist_id", therapistId).eq("is_active", true),
        supabase.from("blocked_periods").select("start_date,end_date").eq("therapist_id", therapistId),
      ]);
      setAvs(a ?? []); setBlocks(b ?? []);
    })();
  }, [therapistId]);

  useEffect(() => {
    if (!selectedDate) return;
    supabase.from("appointments").select("appointment_date,appointment_time")
      .eq("therapist_id", therapistId).eq("appointment_date", selectedDate)
      .in("status", ["pending", "confirmed"])
      .then(({ data }) => setTaken((data ?? []) as Appt[]));
  }, [selectedDate, therapistId]);

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
    const all = dayAvs.flatMap((a) => buildSlots(a.start_time.slice(0, 5), a.end_time.slice(0, 5)));
    const takenSet = new Set(taken.map((t) => t.appointment_time.slice(0, 5)));
    return all.filter((s) => !takenSet.has(s));
  }, [selectedDate, avs, taken]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedTime) { toast.error("Choisissez un créneau"); return; }
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
      notes: parsed.data.notes || null,
      status: "pending",
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    // eslint-disable-next-line no-console
    console.log("[booking] confirmation email →", parsed.data.email, { selectedDate, selectedTime });
    setSuccess(true);
    toast.success("Demande envoyée ! Vous recevrez une confirmation par email.");
  };

  if (success) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-6 text-center space-y-3">
          <div className="text-lg font-semibold text-foreground">Demande envoyée 🎉</div>
          <p className="text-sm text-muted-foreground">Le thérapeute reviendra vers vous très rapidement par email.</p>
        </CardContent>
      </Card>
    );
  }

  const monthLabel = `${MONTHS[month.getMonth()]} ${month.getFullYear()}`;

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-lg">Réserver une consultation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <Button type="button" size="sm" variant="ghost" aria-label="Mois précédent"
              onClick={() => { const d = new Date(month); d.setMonth(d.getMonth() - 1); setMonth(d); setSelectedDate(null); setSelectedTime(null); }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium capitalize">{monthLabel}</div>
            <Button type="button" size="sm" variant="ghost" aria-label="Mois suivant"
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
            <div className="text-sm font-medium mb-2">Créneaux disponibles</div>
            {slotsForDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun créneau libre ce jour-là.</p>
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

        {selectedDate && selectedTime && (
          <form onSubmit={submit} className="space-y-3 border-t border-border pt-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label htmlFor="bk-name">Nom complet</Label>
                <Input id="bk-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={120} /></div>
              <div><Label htmlFor="bk-email">Email</Label>
                <Input id="bk-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={200} /></div>
            </div>
            <div><Label htmlFor="bk-phone">Téléphone (optionnel)</Label>
              <Input id="bk-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={40} /></div>
            <div><Label htmlFor="bk-notes">Message (optionnel)</Label>
              <Textarea id="bk-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={1000} rows={3} /></div>
            <Button type="submit" disabled={submitting} className="w-full bg-primary hover:bg-primary/90">
              {submitting ? "Envoi…" : `Réserver le ${selectedDate} à ${selectedTime}`}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}