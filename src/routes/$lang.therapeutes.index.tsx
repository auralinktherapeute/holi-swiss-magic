import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PagePlaceholder } from "@/components/holiswiss/PagePlaceholder";

export const Route = createFileRoute("/$lang/therapeutes/")({
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  return <PagePlaceholder title={t("directory.title")} description={t("directory.subtitle")} />;
}
