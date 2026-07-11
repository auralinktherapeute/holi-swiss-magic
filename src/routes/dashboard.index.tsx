import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Eye,
  CalendarCheck,
  Star,
  TrendingUp,
  ArrowUpRight,
  UserCheck,
  CalendarPlus,
  PenLine,
  ChevronRight,
} from "lucide-react";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";

const SHOW_STATS = false;

export const Route = createFileRoute("/dashboard/")({ component: Page });

function Page() {
  const { t } = useTranslation();
  const stats = [
    { label: t("dashboard_home.stat_views"), value: "1 248", delta: "+12%", icon: Eye },
    { label: t("dashboard_home.stat_bookings"), value: "37", delta: "+8%", icon: CalendarCheck },
    { label: t("dashboard_home.stat_rating"), value: "4,8", delta: t("dashboard_home.stat_reviews_count", { count: 23 }), icon: Star },
    { label: t("dashboard_home.stat_conversion"), value: "3,0%", delta: "+0,4 pt", icon: TrendingUp },
  ];
  const upcoming = [
    { name: "Marie L.", when: "14:00", type: t("dashboard_home.first_session") },
    { name: "Jean P.", when: "09:30", type: t("dashboard_home.follow_up") },
    { name: "Sophie K.", when: "16:00", type: t("dashboard_home.follow_up") },
  ];

  const onboardingSteps = [
    {
      icon: UserCheck,
      label: t("dashboard_home.step_profile"),
      cta: t("dashboard_home.step_profile_cta"),
      to: "/dashboard/profil" as const,
    },
    {
      icon: CalendarPlus,
      label: t("dashboard_home.step_agenda"),
      cta: t("dashboard_home.step_agenda_cta"),
      to: "/dashboard/agenda" as const,
    },
    {
      icon: PenLine,
      label: t("dashboard_home.step_content"),
      cta: t("dashboard_home.step_content_cta"),
      to: "/dashboard/articles" as const,
    },
  ];

  return (
    <div className="p-6 md:p-10 space-y-8">
      {/* Welcome header — slightly larger */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">{t("dashboard_home.greeting")}</h1>
          <p className="text-muted-foreground mt-2 text-base md:text-lg">{t("dashboard_home.overview_subtitle")}</p>
        </div>
        <Badge variant="secondary" className="bg-primary-xlight text-primary border-primary/20">{t("dashboard_home.plan_active")}</Badge>
      </div>

      <OnboardingChecklist />

      {/* Statistics — hidden during launch phase; set SHOW_STATS = true to restore */}
      {SHOW_STATS && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="bg-surface border-border/60">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                  <Icon className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{s.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{s.delta}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Onboarding progress block — replaces stats during launch */}
      {!SHOW_STATS && (
        <Card className="relative overflow-hidden border-purple-500/20 bg-gradient-to-br from-purple-950/30 to-indigo-950/20 backdrop-blur-sm">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-400/30 to-transparent" />
          <CardHeader>
            <CardTitle className="text-base font-medium text-foreground/90">{t("dashboard_home.progress_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {onboardingSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.label}
                    className="group flex items-start gap-4 rounded-xl border border-white/5 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground/90 leading-snug">{step.label}</p>
                      <Button
                        asChild
                        variant="link"
                        size="sm"
                        className="h-auto p-0 mt-1 text-purple-300 hover:text-purple-200"
                      >
                        <Link to={step.to}>
                          {step.cta}
                          <ChevronRight className="h-3.5 w-3.5 ml-0.5 transition group-hover:translate-x-0.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-surface border-border/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("dashboard_home.upcoming_bookings")}</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard/reservations">{t("dashboard_home.see_all")} <ArrowUpRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.map((u) => (
              <div key={u.name} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-4">
                <div>
                  <div className="font-medium text-foreground">{u.name}</div>
                  <div className="text-sm text-muted-foreground">{u.type}</div>
                </div>
                <div className="text-sm text-foreground/80">{u.when}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-surface border-border/60">
          <CardHeader><CardTitle>{t("dashboard_home.quick_actions")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full justify-start" variant="secondary"><Link to="/dashboard/profil">{t("dashboard_home.complete_profile")}</Link></Button>
            <Button asChild className="w-full justify-start" variant="secondary"><Link to="/dashboard/agenda">{t("dashboard_home.update_agenda")}</Link></Button>
            <Button asChild className="w-full justify-start" variant="secondary"><Link to="/dashboard/articles">{t("dashboard_home.write_article")}</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
