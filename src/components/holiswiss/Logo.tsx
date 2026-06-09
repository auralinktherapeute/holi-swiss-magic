import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export function Logo({ dark = false }: { dark?: boolean }) {
  const { i18n } = useTranslation();
  const lang = (i18n.language || "fr").split("-")[0];
  return (
    <Link
      to="/$lang"
      params={{ lang }}
      className="flex items-center gap-1.5 text-xl font-bold tracking-tight"
    >
      <span aria-hidden className="text-2xl">🌿</span>
      <span className="text-primary">Holi</span>
      <span className={dark ? "text-white font-normal" : "text-foreground font-normal"}>swiss</span>
    </Link>
  );
}