import {
  Lightbulb,
  FileText,
  Pencil,
  Eye,
  CheckCircle2,
  CalendarClock,
  Loader2,
  Send,
  XCircle,
  Archive,
} from "lucide-react";
import {
  NEWSLETTER_STATUSES,
  NEWSLETTER_STATUS_LABELS,
  NEWSLETTER_STATUS_DESCRIPTIONS,
  type NewsletterStatus,
} from "@/lib/newsletter.shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const STATUS_COLORS: Record<
  NewsletterStatus,
  { text: string; bg: string; icon: React.ElementType }
> = {
  idee: { text: "text-white/70", bg: "bg-white/10", icon: Lightbulb },
  brief_cree: { text: "text-[#38bdf8]", bg: "bg-[#38bdf8]/15", icon: FileText },
  brouillon: { text: "text-[#5cc8fa]", bg: "bg-[#5cc8fa]/15", icon: Pencil },
  en_revision: { text: "text-[#fbbf24]", bg: "bg-[#fbbf24]/15", icon: Eye },
  approuvee: { text: "text-[#4ade80]", bg: "bg-[#4ade80]/15", icon: CheckCircle2 },
  programmee: { text: "text-[#b86ef9]", bg: "bg-[#b86ef9]/15", icon: CalendarClock },
  envoi_en_cours: { text: "text-[#fb923c]", bg: "bg-[#fb923c]/15", icon: Loader2 },
  envoyee: { text: "text-white", bg: "bg-white/15", icon: Send },
  echec: { text: "text-[#f87171]", bg: "bg-[#f87171]/15", icon: XCircle },
  archivee: { text: "text-white/40", bg: "bg-white/5", icon: Archive },
};

export function NewsletterStatusLegend() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Comprendre les statuts des newsletters"
          className="min-h-11 border-white/15 bg-transparent text-white/80 hover:bg-white/10"
        >
          Comprendre les statuts
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#1d0d3d] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Légende des statuts newsletter</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 pt-2">
          {NEWSLETTER_STATUSES.map((status) => {
            const { icon: Icon, text, bg } = STATUS_COLORS[status];
            const isAnimated = status === "envoi_en_cours";
            return (
              <div
                key={status}
                className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${bg}`}
                  aria-hidden="true"
                >
                  <Icon className={`h-4 w-4 ${text} ${isAnimated ? "animate-spin" : ""}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${text}`}>
                    {NEWSLETTER_STATUS_LABELS[status]}
                  </p>
                  <p className="text-sm text-white/60">
                    {NEWSLETTER_STATUS_DESCRIPTIONS[status]}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
