import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import frLocale from "@fullcalendar/core/locales/fr";
import deLocale from "@fullcalendar/core/locales/de";
import itLocale from "@fullcalendar/core/locales/it";
import enLocale from "@fullcalendar/core/locales/en-gb";
import type { EventInput, EventClickArg, EventDropArg, DateSelectArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Trash2, Copy, Pencil, Ban, Undo2, Redo2, StickyNote } from "lucide-react";

type AppointmentRow = {
  id: string;
  therapist_id: string;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string | null;
  notes: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  service_name: string | null;
  source: string;
  duration_minutes: number;
};

type AppointmentSource = "holiswiss" | "google" | "outlook" | "apple" | "other";
const SOURCE_META: Record<AppointmentSource, { label: string; color: string; icon: string }> = {
  holiswiss: { label: "Holiswiss", color: "#b86ef9", icon: "🌐" },
  google:    { label: "Google",    color: "#ea4335", icon: "🔴" },
  outlook:   { label: "Outlook",   color: "#0078d4", icon: "📧" },
  apple:     { label: "Apple",     color: "#ff9b30", icon: "🍎" },
  other:     { label: "Externe",   color: "#f4b400", icon: "📅" },
};
const normalizeSource = (s?: string | null): AppointmentSource => {
  const v = (s ?? "holiswiss").toLowerCase();
  return (v in SOURCE_META ? v : "other") as AppointmentSource;
};

type Editing = {
  id?: string;
  patient_name: string;
  patient_email: string;
  patient_phone: string;
  notes: string;
  start: Date;
  end: Date;
  status: string;
};

type UndoAction =
  | { type: "create"; after: AppointmentRow }
  | { type: "update"; before: AppointmentRow; after: AppointmentRow }
  | { type: "delete"; before: AppointmentRow };

const STORAGE_KEY = "holiswiss_agenda_prefs";

const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function InteractiveAgenda({ therapistId, defaultDuration = 60 }: { therapistId: string; defaultDuration?: number }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const calendarRef = useRef<FullCalendar | null>(null);

  const locale = useMemo(() => {
    const l = i18n.language?.split("-")[0];
    return l === "de" ? deLocale : l === "it" ? itLocale : l === "en" ? enLocale : frLocale;
  }, [i18n.language]);

  const [slotDuration, setSlotDuration] = useState<"00:30:00" | "01:00:00">(() => {
    try { return (JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").slotDuration) ?? "01:00:00"; }
    catch { return "01:00:00"; }
  });
  const [view, setView] = useState<"timeGridDay" | "timeGridWeek" | "dayGridMonth">(() => {
    try { return (JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").view) ?? "timeGridWeek"; }
    catch { return "timeGridWeek"; }
  });
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ slotDuration, view }));
  }, [slotDuration, view]);

  const range = useMemo(() => {
    const s = new Date(); s.setDate(s.getDate() - 21); s.setHours(0, 0, 0, 0);
    const e = new Date(); e.setDate(e.getDate() + 60); e.setHours(23, 59, 59, 999);
    return { start: s.toISOString(), end: e.toISOString() };
  }, []);

  const { data: appointments = [] } = useQuery({
    queryKey: ["interactive-agenda", therapistId, range.start],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("therapist_id", therapistId)
        .not("start_time", "is", null)
        .gte("start_time", range.start)
        .lt("start_time", range.end)
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as unknown as AppointmentRow[];
    },
    enabled: !!therapistId,
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["interactive-agenda", therapistId] });
  }, [queryClient, therapistId]);

  // Undo / redo
  const undoStack = useRef<UndoAction[]>([]);
  const redoStack = useRef<UndoAction[]>([]);
  const pushUndo = (a: UndoAction) => {
    undoStack.current.push(a);
    redoStack.current = [];
    if (undoStack.current.length > 50) undoStack.current.shift();
  };
  const applyAction = async (a: UndoAction) => {
    if (a.type === "create") {
      const { id, ...rest } = a.after;
      const { error } = await supabase.from("appointments").insert({ ...rest, id } as any);
      if (error) throw error;
    } else if (a.type === "update") {
      const { id, start_time, end_time, status, patient_name, patient_email, patient_phone, notes, service_name } = a.after;
      const { error } = await supabase.from("appointments")
        .update({ start_time, end_time, status, patient_name, patient_email, patient_phone, notes, service_name } as any)
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("appointments").delete().eq("id", a.before.id);
      if (error) throw error;
    }
  };
  const reverse = (a: UndoAction): UndoAction =>
    a.type === "create" ? { type: "delete", before: a.after }
    : a.type === "delete" ? { type: "create", after: a.before }
    : { type: "update", before: a.after, after: a.before };

  const undo = useCallback(async () => {
    const a = undoStack.current.pop(); if (!a) return;
    try { await applyAction(reverse(a)); redoStack.current.push(a); refresh(); toast.success(t("agenda_page.action_undone")); }
    catch (e: any) { toast.error(e?.message ?? "Error"); }
  }, [refresh, t]);
  const redo = useCallback(async () => {
    const a = redoStack.current.pop(); if (!a) return;
    try { await applyAction(a); undoStack.current.push(a); refresh(); toast.success(t("agenda_page.action_redone")); }
    catch (e: any) { toast.error(e?.message ?? "Error"); }
  }, [refresh, t]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z" && !e.shiftKey) { e.preventDefault(); void undo(); }
      else if ((e.ctrlKey || e.metaKey) && (k === "y" || (e.shiftKey && k === "z"))) { e.preventDefault(); void redo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  // Build events
  const events: EventInput[] = useMemo(() => appointments.map((a) => {
    const source = normalizeSource(a.source);
    const meta = SOURCE_META[source];
    const isBlocked = a.status === "blocked";
    return {
      id: a.id,
      title: isBlocked
        ? `🚫 ${a.patient_name || t("agenda_page.blocked_label")}`
        : `${meta.icon} ${a.patient_name}${a.service_name ? " · " + a.service_name : ""}`,
      start: a.start_time!,
      end: a.end_time!,
      backgroundColor: isBlocked ? "rgba(59, 31, 82, 0.55)" : "rgba(184, 110, 249, 0.22)",
      borderColor: isBlocked ? "#3b1f52" : meta.color,
      textColor: isBlocked ? "#c4b5d0" : "#ffffff",
      classNames: isBlocked ? ["agenda-blocked"] : [`agenda-source-${source}`],
      extendedProps: { raw: a, isBlocked, source, meta },
    } as EventInput;
  }), [appointments, t]);

  // Editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);

  const openCreate = (start: Date, end?: Date) => {
    const e = end ?? new Date(start.getTime() + defaultDuration * 60000);
    setEditing({
      patient_name: "", patient_email: "", patient_phone: "", notes: "",
      start, end: e, status: "confirmed",
    });
    setEditorOpen(true);
  };
  const openEdit = (a: AppointmentRow) => {
    setEditing({
      id: a.id,
      patient_name: a.patient_name,
      patient_email: a.patient_email ?? "",
      patient_phone: a.patient_phone ?? "",
      notes: a.notes ?? "",
      start: new Date(a.start_time!),
      end: new Date(a.end_time!),
      status: a.status,
    });
    setEditorOpen(true);
  };

  const handleSelect = (info: DateSelectArg) => {
    openCreate(info.start, info.end);
    info.view.calendar.unselect();
  };
  const handleEventClick = (arg: EventClickArg) => {
    const raw = arg.event.extendedProps?.raw as AppointmentRow | undefined;
    if (raw) openEdit(raw);
  };
  const handleEventDrop = async (arg: EventDropArg) => {
    const raw = arg.event.extendedProps?.raw as AppointmentRow | undefined;
    if (!raw || !arg.event.start || !arg.event.end) { arg.revert(); return; }
    const before = { ...raw };
    const after = { ...raw, start_time: arg.event.start.toISOString(), end_time: arg.event.end.toISOString() };
    const { error } = await supabase.from("appointments")
      .update({ start_time: after.start_time, end_time: after.end_time } as any).eq("id", raw.id);
    if (error) { arg.revert(); toast.error(t("agenda_page.fail_move"), { description: error.message }); return; }
    pushUndo({ type: "update", before, after });
    toast.success(t("agenda_page.moved"));
    refresh();
  };
  const handleEventResize = async (arg: EventResizeDoneArg) => {
    const raw = arg.event.extendedProps?.raw as AppointmentRow | undefined;
    if (!raw || !arg.event.start || !arg.event.end) { arg.revert(); return; }
    const before = { ...raw };
    const newDur = Math.round((arg.event.end.getTime() - arg.event.start.getTime()) / 60000);
    const after = { ...raw, start_time: arg.event.start.toISOString(), end_time: arg.event.end.toISOString(), duration_minutes: newDur };
    const { error } = await supabase.from("appointments")
      .update({ start_time: after.start_time, end_time: after.end_time, duration_minutes: newDur } as any).eq("id", raw.id);
    if (error) { arg.revert(); toast.error(t("agenda_page.fail_resize"), { description: error.message }); return; }
    pushUndo({ type: "update", before, after });
    toast.success(t("agenda_page.resized"));
    refresh();
  };

  const saveEditor = async () => {
    if (!editing) return;
    if (editing.status !== "blocked" && !editing.patient_name.trim()) {
      toast.error(t("agenda_page.name_required")); return;
    }
    const duration = Math.max(15, Math.round((editing.end.getTime() - editing.start.getTime()) / 60000));
    const payload: any = {
      therapist_id: therapistId,
      patient_name: editing.patient_name.trim() || t("agenda_page.blocked_label"),
      patient_email: editing.patient_email.trim() || null,
      patient_phone: editing.patient_phone.trim() || null,
      notes: editing.notes.trim() || null,
      duration_minutes: duration,
      start_time: editing.start.toISOString(),
      end_time: editing.end.toISOString(),
      appointment_date: editing.start.toISOString().slice(0, 10),
      appointment_time: editing.start.toTimeString().slice(0, 8),
      status: editing.status,
      source: "holiswiss",
    };
    if (editing.id) {
      const before = appointments.find((a) => a.id === editing.id);
      const { data, error } = await supabase.from("appointments").update(payload).eq("id", editing.id).select().single();
      if (error) { toast.error(t("agenda_page.fail_save"), { description: error.message }); return; }
      if (before) pushUndo({ type: "update", before, after: data as unknown as AppointmentRow });
      toast.success(t("agenda_page.updated"));
    } else {
      const { data, error } = await supabase.from("appointments").insert(payload).select().single();
      if (error) { toast.error(t("agenda_page.fail_save"), { description: error.message }); return; }
      pushUndo({ type: "create", after: data as unknown as AppointmentRow });
      toast.success(t("agenda_page.created"));
    }
    setEditorOpen(false); setEditing(null); refresh();
  };

  const deleteAppointment = async (raw: AppointmentRow) => {
    const before = { ...raw };
    const { error } = await supabase.from("appointments").delete().eq("id", raw.id);
    if (error) { toast.error(t("agenda_page.fail_delete"), { description: error.message }); return; }
    pushUndo({ type: "delete", before });
    toast.success(t("agenda_page.deleted"));
    refresh();
  };
  const duplicateAppointment = async (raw: AppointmentRow) => {
    if (!raw.start_time || !raw.end_time) return;
    const s = new Date(raw.start_time); s.setDate(s.getDate() + 1);
    const e = new Date(raw.end_time); e.setDate(e.getDate() + 1);
    const payload: any = {
      therapist_id: therapistId,
      patient_name: raw.patient_name, patient_email: raw.patient_email, patient_phone: raw.patient_phone,
      notes: raw.notes, status: raw.status, source: raw.source,
      duration_minutes: raw.duration_minutes, service_name: raw.service_name,
      start_time: s.toISOString(), end_time: e.toISOString(),
      appointment_date: s.toISOString().slice(0, 10), appointment_time: s.toTimeString().slice(0, 8),
    };
    const { data, error } = await supabase.from("appointments").insert(payload).select().single();
    if (error) { toast.error(t("agenda_page.fail_save"), { description: error.message }); return; }
    pushUndo({ type: "create", after: data as unknown as AppointmentRow });
    toast.success(t("agenda_page.duplicated"));
    refresh();
  };

  // Context menu
  const [contextRaw, setContextRaw] = useState<AppointmentRow | null>(null);
  const handleContextCapture = (e: React.MouseEvent) => {
    const tgt = (e.target as HTMLElement).closest(".fc-event") as HTMLElement | null;
    if (!tgt) { setContextRaw(null); return; }
    const id = tgt.getAttribute("data-event-id");
    setContextRaw(appointments.find((a) => a.id === id) ?? null);
  };

  const eventDidMount = (info: any) => {
    info.el.setAttribute("data-event-id", info.event.id);
    const meta = info.event.extendedProps?.meta as { label: string; color: string } | undefined;
    if (!meta) return;
    info.el.style.borderLeft = `4px solid ${meta.color}`;
    info.el.setAttribute("title", `Source: ${meta.label}`);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="holiswiss-agenda-toolbar flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single" value={view} size="sm" className="hw-toggle"
            onValueChange={(v) => {
              if (!v) return;
              setView(v as typeof view);
              calendarRef.current?.getApi().changeView(v);
            }}
          >
            <ToggleGroupItem value="timeGridDay">{t("agenda_page.day")}</ToggleGroupItem>
            <ToggleGroupItem value="timeGridWeek">{t("agenda_page.week")}</ToggleGroupItem>
            <ToggleGroupItem value="dayGridMonth">{t("agenda_page.month")}</ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup
            type="single" value={slotDuration} size="sm" className="hw-toggle"
            onValueChange={(v) => v && setSlotDuration(v as typeof slotDuration)}
          >
            <ToggleGroupItem value="01:00:00">60 min</ToggleGroupItem>
            <ToggleGroupItem value="00:30:00">30 min</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void undo()} title="Ctrl+Z">
            <Undo2 className="h-4 w-4 mr-1" /> {t("agenda_page.undo")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void redo()} title="Ctrl+Y">
            <Redo2 className="h-4 w-4 mr-1" /> {t("agenda_page.redo")}
          </Button>
          <Button
            size="sm" variant="outline"
            onClick={() => {
              const api = calendarRef.current?.getApi(); if (!api) return;
              const s = api.getDate(); const e = new Date(s); e.setHours(s.getHours() + 1);
              setEditing({ patient_name: t("agenda_page.blocked_label"), patient_email: "", patient_phone: "", notes: "", start: s, end: e, status: "blocked" });
              setEditorOpen(true);
            }}
          >
            <Ban className="h-4 w-4 mr-1" /> {t("agenda_page.block")}
          </Button>
        </div>
      </div>

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="holiswiss-agenda" onContextMenuCapture={handleContextCapture}>
            <FullCalendar
              ref={calendarRef}
              plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
              initialView={view}
              locale={locale}
              headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
              firstDay={1}
              slotDuration={slotDuration}
              slotMinTime="07:00:00"
              slotMaxTime="22:00:00"
              allDaySlot={false}
              nowIndicator
              editable
              selectable
              selectMirror
              eventDurationEditable
              eventStartEditable
              dayMaxEvents
              height="auto"
              events={events}
              select={handleSelect}
              eventClick={handleEventClick}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              eventDidMount={eventDidMount}
              dateClick={(info) => {
                if (info.jsEvent.detail >= 2) {
                  const end = new Date(info.date);
                  end.setMinutes(end.getMinutes() + (slotDuration === "00:30:00" ? 30 : 60));
                  openCreate(info.date, end);
                }
              }}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem disabled={!contextRaw} onClick={() => contextRaw && openEdit(contextRaw)}>
            <Pencil className="h-4 w-4 mr-2" /> {t("agenda_page.edit_menu")}
          </ContextMenuItem>
          <ContextMenuItem disabled={!contextRaw} onClick={() => contextRaw && duplicateAppointment(contextRaw)}>
            <Copy className="h-4 w-4 mr-2" /> {t("agenda_page.duplicate")}
          </ContextMenuItem>
          <ContextMenuItem disabled={!contextRaw} onClick={() => contextRaw && openEdit(contextRaw)}>
            <StickyNote className="h-4 w-4 mr-2" /> {t("agenda_page.notes")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem disabled={!contextRaw} onClick={() => contextRaw && deleteAppointment(contextRaw)} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" /> {t("agenda_page.delete")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Sources legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="font-medium">{t("agenda_page.sources")} :</span>
        {(Object.keys(SOURCE_META) as AppointmentSource[]).map((k) => {
          const m = SOURCE_META[k];
          return (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
              {m.icon} {m.label}
            </span>
          );
        })}
      </div>

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing?.status === "blocked"
                ? (editing?.id ? t("agenda_page.edit_block") : t("agenda_page.new_block"))
                : (editing?.id ? t("agenda_page.edit_appt") : t("agenda_page.new_appt"))}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t("agenda_page.start")}</Label>
                  <Input type="datetime-local" value={toLocalInput(editing.start)}
                    onChange={(e) => setEditing({ ...editing, start: new Date(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label>{t("agenda_page.end")}</Label>
                  <Input type="datetime-local" value={toLocalInput(editing.end)}
                    onChange={(e) => setEditing({ ...editing, end: new Date(e.target.value) })} />
                </div>
              </div>
              {editing.status !== "blocked" && (
                <>
                  <div className="space-y-1">
                    <Label>{t("agenda_page.patient")}</Label>
                    <Input value={editing.patient_name} placeholder={t("agenda_page.patient_ph")}
                      onChange={(e) => setEditing({ ...editing, patient_name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>{t("agenda_page.email")}</Label>
                      <Input type="email" value={editing.patient_email}
                        onChange={(e) => setEditing({ ...editing, patient_email: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>{t("agenda_page.phone")}</Label>
                      <Input value={editing.patient_phone}
                        onChange={(e) => setEditing({ ...editing, patient_phone: e.target.value })} />
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-1">
                <Label>{t("agenda_page.notes")}</Label>
                <Textarea id="agenda-notes-field" rows={3} value={editing.notes}
                  placeholder={t("agenda_page.notes_ph")}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            {editing?.id && (
              <Button
                variant="destructive" className="mr-auto"
                onClick={async () => {
                  if (!editing?.id) return;
                  const raw = appointments.find((a) => a.id === editing.id);
                  if (!raw) return;
                  if (!window.confirm(t("agenda_page.confirm_delete"))) return;
                  await deleteAppointment(raw);
                  setEditorOpen(false); setEditing(null);
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" /> {t("agenda_page.delete")}
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditorOpen(false)}>{t("agenda_page.cancel")}</Button>
            <Button onClick={saveEditor}>{t("agenda_page.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}