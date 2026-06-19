import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/$lang/reinitialiser-mot-de-passe/")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/reinitialiser-mot-de-passe/" });
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery hash automatically (detectSessionInUrl).
    // We listen for PASSWORD_RECOVERY or an existing session to confirm the link is valid.
    let cancelled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        setInvalid(false);
      }
    });
    (async () => {
      // Give Supabase a tick to parse the URL hash, then check session
      await new Promise((r) => setTimeout(r, 400));
      if (cancelled) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setReady(true);
      } else if (!window.location.hash.includes("access_token")) {
        setInvalid(true);
      }
    })();
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error(t("auth.reset_min_length"));
    if (password !== confirm) return toast.error(t("auth.password_mismatch"));
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSuccess(true);
    toast.success(t("auth.reset_success"));
    await supabase.auth.signOut();
    setTimeout(() => navigate({ to: "/$lang/connexion", params: { lang } }), 3000);
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">{t("auth.reset_title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("auth.reset_subtitle")}</p>
      </div>

      {success ? (
        <div
          role="status"
          className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-foreground"
        >
          {t("auth.reset_success")}
        </div>
      ) : invalid ? (
        <div className="rounded-2xl border border-border bg-surface p-6 space-y-4 text-center">
          <p className="text-sm text-muted-foreground">{t("auth.reset_invalid_link")}</p>
          <Link
            to="/$lang/mot-de-passe-oublie"
            params={{ lang }}
            className="inline-block font-medium text-primary hover:underline"
          >
            {t("auth.forgot_title")}
          </Link>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-border bg-surface p-6 space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="new-password">{t("auth.reset_new_password")}</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={show ? t("auth.hide_password") : t("auth.show_password")}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">{t("auth.reset_confirm_password")}</Label>
            <Input
              id="confirm-password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <Button className="w-full" type="submit" disabled={loading || !ready}>
            {loading ? t("auth.reset_updating") : t("auth.reset_submit")}
          </Button>
        </form>
      )}
    </div>
  );
}