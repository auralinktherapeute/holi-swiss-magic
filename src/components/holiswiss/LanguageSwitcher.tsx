import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LANGS } from "@/lib/constants";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const first = pathname.split("/").filter(Boolean)[0];
  const current = LANGS.find((l) => l.code === first) ?? LANGS[0];

  const change = async (code: string) => {
    await i18n.changeLanguage(code);
    try { localStorage.setItem("holiswiss-lang", code); } catch {}
    // Replace the first path segment with the new language
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length && LANGS.some((l) => l.code === segments[0])) {
      segments[0] = code;
    } else {
      segments.unshift(code);
    }
    navigate({ to: "/" + segments.join("/") });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-white hover:bg-white/10 hover:text-white">
          <Globe className="h-4 w-4" />
          <span aria-hidden>{current.flag}</span>
          <span className="font-medium">{current.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGS.map((l) => (
          <DropdownMenuItem key={l.code} onClick={() => change(l.code)}>
            <span aria-hidden className="mr-2">{l.flag}</span>
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}