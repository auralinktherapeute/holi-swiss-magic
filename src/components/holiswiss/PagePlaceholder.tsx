import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";

export function PagePlaceholder({ title, description }: { title: string; description?: string }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-xlight text-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      {description && <p className="mt-3 text-muted-foreground">{description}</p>}
      <p className="mt-4 inline-block rounded-full bg-primary-xlight px-3 py-1 text-xs font-medium text-primary">
        {t("common.soon")}
      </p>
    </div>
  );
}