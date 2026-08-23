import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { markAdminSectionRead } from "@/lib/admin-badges.functions";
import { notifyNotificationsChanged } from "@/lib/notification-bus";

type AdminSection = "waitlist" | "reviews" | "articles";

export function useAdminSectionRead(section: AdminSection, ready = true) {
  const markRead = useServerFn(markAdminSectionRead);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        await markRead({ data: { section } });
        if (active) notifyNotificationsChanged();
      } catch {
        // Le prochain affichage ou rafraîchissement réessaiera l’acquittement.
      }
    }, 800);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [markRead, ready, section]);
}