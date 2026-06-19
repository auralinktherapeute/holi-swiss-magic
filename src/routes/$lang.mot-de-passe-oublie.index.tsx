import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/$lang/mot-de-passe-oublie/")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/mot-de-passe-oublie/" });
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const lastSubmitRef = useRef<number>(0);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Simple client-side anti-bruteforce: 15s cooldown between submissions
    const now = Date.now();
    if (now - lastSubmitRef.current < 15000) {
      toast.error(t("auth.forgot_rate_limited"));
      return;
    }
    lastSubmitRef.current = now;
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/${lang}/reinitialiser-mot-de-passe`,
      });
    } catch {
      // swallow: never reveal existence
    }
    setLoading(false);
    setSent(true);
    toast.success(t("auth.forgot_neutral"));
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">{t("auth.forgot_title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("auth.forgot_subtitle")}</p>
      </div>

      {sent ? (
        <div
          role="status"
          className="rounded-2xl border border-border bg-surface p-6 text-sm text-foreground"
        >
          {t("auth.forgot_neutral")}
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-border bg-surface p-6 space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="vous@exemple.ch"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? t("auth.forgot_sending") : t("auth.forgot_submit")}
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground">
        <Link
          to="/$lang/connexion"
          params={{ lang }}
          className="font-medium text-primary hover:underline"
        >
          ← {t("auth.forgot_back_login")}
        </Link>
      </p>
    </div>
  );
}