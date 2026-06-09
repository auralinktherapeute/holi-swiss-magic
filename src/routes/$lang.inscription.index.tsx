import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/$lang/inscription/")({
  component: SignupPage,
});

function SignupPage() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/inscription/" });
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">{t("auth.signupTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("home.ctaFree")}</p>
      </div>
      <form className="rounded-2xl border border-border bg-surface p-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input id="email" type="email" placeholder="vous@exemple.ch" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input id="password" type="password" />
        </div>
        <Button className="w-full" type="button">{t("auth.submit")}</Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {t("auth.haveAccount")}{" "}
        <Link to="/$lang/connexion" params={{ lang }} className="font-medium text-primary hover:underline">
          {t("nav.login")}
        </Link>
      </p>
    </div>
  );
}