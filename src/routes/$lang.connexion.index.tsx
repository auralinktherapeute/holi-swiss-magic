import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/$lang/connexion/")({
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/connexion/" });
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Connecté");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">{t("auth.loginTitle")}</h1>
      </div>
      <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-surface p-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input id="email" type="email" placeholder="vous@exemple.ch" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button className="w-full" type="submit" disabled={loading}>{loading ? "..." : t("auth.submit")}</Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link to="/$lang/inscription" params={{ lang }} className="font-medium text-primary hover:underline">
          {t("nav.signup")}
        </Link>
      </p>
    </div>
  );
}