import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getOnboardingState } from "@/lib/onboarding.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Circle, ChevronRight } from "lucide-react";

type Item = { key: keyof Await["checklist"]; label: string; to: string; optional?: boolean };
type Await = Awaited<ReturnType<typeof getOnboardingState>>;

const ITEMS: Item[] = [
  { key: "profileComplete", label: "Profil complété (bio, spécialités, IBAN, adresse)", to: "/dashboard/profil" },
  { key: "availabilitySet", label: "Disponibilités définies dans l'agenda", to: "/dashboard/agenda" },
  { key: "packageCreated", label: "Au moins une séance ou un forfait créé", to: "/dashboard/forfaits" },
  { key: "questionnaireCreated", label: "Au moins un questionnaire créé (optionnel)", to: "/dashboard/questionnaires", optional: true },
  { key: "firstReservation", label: "Première réservation reçue", to: "/dashboard/reservations" },
];

export function OnboardingChecklist() {
  const fetchState = useServerFn(getOnboardingState);
  const { data } = useQuery({
    queryKey: ["onboarding-state"],
    queryFn: () => fetchState(),
    staleTime: 30_000,
  });

  if (!data) return null;
  const done = ITEMS.filter((i) => data.checklist[i.key]).length;
  const total = ITEMS.length;
  if (done === total) return null;

  return (
    <Card className="relative overflow-hidden border-teal-400/20 bg-gradient-to-br from-[#150732]/80 to-[#0b0620]/60 backdrop-blur-sm">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-300/40 to-transparent" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-medium text-foreground/90">Checklist de démarrage</CardTitle>
          <span className="text-xs font-semibold text-teal-300">{done}/{total}</span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-purple-400 to-teal-300 transition-all duration-500"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {ITEMS.map((item) => {
          const isDone = data.checklist[item.key];
          return (
            <Link
              key={item.key}
              to={item.to}
              className="group flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 transition hover:bg-white/[0.06]"
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  isDone ? "bg-teal-400/20 text-teal-300" : "bg-white/5 text-white/40"
                }`}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
              </div>
              <span
                className={`flex-1 text-sm ${
                  isDone ? "text-white/50 line-through" : "text-foreground/90"
                }`}
              >
                {item.label}
                {item.optional && !isDone && <span className="ml-1.5 text-[11px] text-white/40">(non bloquant)</span>}
              </span>
              {!isDone && (
                <ChevronRight className="h-4 w-4 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white/60" />
              )}
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}