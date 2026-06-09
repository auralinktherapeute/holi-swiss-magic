import { Link } from "@tanstack/react-router";
import { Star, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCHF } from "@/lib/constants";
import { useTranslation } from "react-i18next";

export type TherapistCardProps = {
  slug: string;
  displayName: string;
  specialties: string[];
  canton: string;
  rating: number;
  reviewsCount: number;
  priceFrom: number;
  initials: string;
};

export function TherapistCard(p: TherapistCardProps) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "fr").split("-")[0];
  return (
    <article className="group rounded-xl border border-[rgba(184,110,249,0.2)] bg-[#3d1a5c] backdrop-blur p-5 transition-all hover:border-[#b86ef9] hover:bg-[#522870] hover:shadow-[0_0_20px_rgba(184,110,249,0.3)]">
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 shrink-0 rounded-full bg-gradient-to-br from-[#b86ef9]/30 to-[#5cc8fa]/20 text-white flex items-center justify-center text-base font-semibold ring-1 ring-[#b86ef9]/30">
          {p.initials}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-white truncate">{p.displayName}</h3>
          <div className="mt-1 flex items-center gap-1 text-xs text-[#d4c4e0]">
            <MapPin className="h-3 w-3" />
            <span>{p.canton}</span>
            <span className="mx-1">·</span>
            <Star className="h-3 w-3 fill-[#f59e0b] text-[#f59e0b]" />
            <span className="font-medium text-white">{p.rating.toFixed(1)}</span>
            <span>({p.reviewsCount})</span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {p.specialties.slice(0, 2).map((s) => (
          <Badge key={s} variant="secondary" className="bg-[#b86ef9]/15 text-[#d4a5f9] hover:bg-[#b86ef9]/20 border border-[#b86ef9]/20">
            {s}
          </Badge>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <div className="text-sm">
          <span className="text-[#d4c4e0]">{t("profile.from")} </span>
          <span className="font-semibold text-white">{formatCHF(p.priceFrom)}</span>
        </div>
        <Link to="/$lang/therapeute/$slug" params={{ lang, slug: p.slug }}>
          <Button size="sm" variant="outline" className="border-[#b86ef9]/40 text-white hover:bg-[#b86ef9] hover:text-white">{t("profile.viewProfile")}</Button>
        </Link>
      </div>
    </article>
  );
}