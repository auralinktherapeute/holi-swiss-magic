import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOnboardingState, updateOnboardingProgress } from "@/lib/onboarding.functions";

export const ONBOARDING_QUERY_KEY = ["onboarding-state"] as const;
export const START_TOUR_EVENT = "holiswiss:start-tour";
export const SHOW_CHECKLIST_EVENT = "holiswiss:show-checklist";

export type StartTourDetail = { mode: "resume" | "restart" };

/** Même clé que le layout : une seule requête partagée. */
export function useOnboardingState(enabled = true) {
  const fetchState = useServerFn(getOnboardingState);
  return useQuery({
    queryKey: ONBOARDING_QUERY_KEY,
    queryFn: () => fetchState(),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}

export function useUpdateOnboardingProgress() {
  const update = useServerFn(updateOnboardingProgress);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof update>[0]["data"]) => update({ data }),
    onSettled: () => qc.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY }),
  });
}

export function startTour(mode: StartTourDetail["mode"] = "resume") {
  window.dispatchEvent(new CustomEvent<StartTourDetail>(START_TOUR_EVENT, { detail: { mode } }));
}
