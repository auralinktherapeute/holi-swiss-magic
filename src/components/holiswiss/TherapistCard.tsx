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
    <article className="group rounded-xl border border-border bg-surface p-5 transition-all hover:border-border-purple hover:shadow-lg hover:shadow-primary/5">
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 shrink-0 rounded-full bg-primary-xlight text-primary flex items-center justify-center text-base font-semibold">
          {p.initials}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground truncate">{p.displayName}</h3>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>{p.canton}</span>
            <span className="mx-1">·</span>
            <Star className="h-3 w-3 fill-warning text-warning" />
            <span className="font-medium text-foreground">{p.rating.toFixed(1)}</span>
            <span>({p.reviewsCount})</span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {p.specialties.slice(0, 2).map((s) => (
          <Badge key={s} variant="secondary" className="bg-primary-xlight text-primary hover:bg-primary-xlight">
            {s}
          </Badge>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <div className="text-sm">
          <span className="text-muted-foreground">{t("profile.from")} </span>
          <span className="font-semibold text-foreground">{formatCHF(p.priceFrom)}</span>
        </div>
        <Link to="/$lang/therapeute/$slug" params={{ lang, slug: p.slug }}>
          <Button size="sm" variant="outline">{t("profile.viewProfile")}</Button>
        </Link>
      </div>
    </article>
  );
}