import { useEffect, useState, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { signOutCompletely } from "@/lib/auth-utils";

const INACTIVITY_MS = 3 * 60 * 60 * 1000; // 3h
const STORAGE_KEY = "holiswiss-last-activity";

export function InactivityLogout({ redirectTo = "/fr/connexion" }: { redirectTo?: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const logout = async () => {
      try { await signOutCompletely(queryClient); } catch {}
      setOpen(true);
    };

    const scheduleCheck = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      const last = Number(window.localStorage.getItem(STORAGE_KEY) || Date.now());
      const elapsed = Date.now() - last;
      const remaining = INACTIVITY_MS - elapsed;
      if (remaining <= 0) {
        logout();
        return;
      }
      timerRef.current = window.setTimeout(() => {
        const lastNow = Number(window.localStorage.getItem(STORAGE_KEY) || 0);
        if (Date.now() - lastNow >= INACTIVITY_MS) logout();
        else scheduleCheck();
      }, remaining + 500);
    };

    const touch = () => {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
      scheduleCheck();
    };

    // initialize
    if (!window.localStorage.getItem(STORAGE_KEY)) {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    }
    scheduleCheck();

    const events: (keyof WindowEventMap)[] = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    let throttle = 0;
    const handler = () => {
      const now = Date.now();
      if (now - throttle < 5000) return;
      throttle = now;
      touch();
    };
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    const onVisible = () => { if (document.visibilityState === "visible") scheduleCheck(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, handler));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [queryClient]);

  const handleClose = () => {
    setOpen(false);
    try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
    navigate({ to: redirectTo as any });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Session expirée</DialogTitle>
          <DialogDescription>
            Pour votre sécurité, vous avez été déconnecté automatiquement après 3 heures d'inactivité.
            Merci de vous reconnecter pour continuer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleClose}>Se reconnecter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}