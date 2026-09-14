import { createFileRoute } from "@tanstack/react-router";
import { loadEssential } from "@/lib/read-health";
import { ServiceUnavailableNotice } from "@/components/holiswiss/ServiceUnavailableNotice";

export const Route = createFileRoute("/tmp-probe-unavailable")({
  loader: async () => {
    const res = await loadEssential(async () => {
      throw new Error("probe");
    });
    return { unavailable: !res.ok };
  },
  component: () => <ServiceUnavailableNotice lang="fr" />,
});
