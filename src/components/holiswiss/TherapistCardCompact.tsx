import { Link } from "@tanstack/react-router";
import { MapPin, BadgeCheck } from "lucide-react";
import { TherapistAvatar } from "@/components/holiswiss/TherapistAvatar";
import type { PublicTherapistCard } from "@/lib/geo-listings.functions";

/** Carte compacte d'un thérapeute, rendue côté serveur (lien crawlable). */
export function TherapistCardCompact({ t, lang }: { t: PublicTherapistCard; lang: string }) {
  const name = `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim();
  return (
    <Link
      to="/$lang/therapeute/$slug"
      params={{ lang, slug: t.slug ?? "" }}
      className="group rounded-2xl border border-[rgba(184,110,249,0.2)] bg-[#1a0a2e] p-4 transition hover:border-[#b86ef9] hover:shadow-[0_4px_20px_rgba(184,110,249,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9]"
    >
      <div className="flex gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-[#b86ef9]/30">
          <TherapistAvatar photoUrl={t.photo_url} alt={name} fallback={t.first_name?.[0] ?? "?"} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-semibold text-white">
            {name}
            {t.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#5cc8fa]" aria-hidden />}
          </p>
          {t.title && <p className="truncate text-xs text-[#b86ef9]">{t.title}</p>}
          {t.city && (
            <p className="mt-1 flex items-center gap-1 text-xs text-white/50">
              <MapPin className="h-3 w-3" aria-hidden />
              {t.city}
            </p>
          )}
          {t.short_bio && (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/60">{t.short_bio}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
