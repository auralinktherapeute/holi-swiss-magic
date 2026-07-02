import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getUnreadNotificationCount } from "@/lib/notifications.functions";

export function NotificationBell() {
  const fetchCount = useServerFn(getUnreadNotificationCount);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetchCount();
        if (alive) setCount(r.count);
      } catch {
        /* silent */
      }
    };
    load();
    const iv = window.setInterval(load, 20_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.clearInterval(iv);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchCount]);

  return (
    <Link
      to="/admin/notifications"
      title={count > 0 ? `${count} notification(s) non lue(s)` : "Notifications"}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 40,
        height: 40,
        borderRadius: 10,
        color: "#e9d8ff",
        textDecoration: "none",
        transition: "background 150ms",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(184,110,249,0.12)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
    >
      <Bell size={18} />
      {count > 0 && (
        <span
          aria-label={`${count} non lues`}
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            background: "#ef4444",
            color: "#fff",
            borderRadius: 999,
            minWidth: 18,
            height: 18,
            padding: "0 5px",
            fontSize: 10,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 0 2px #0d0820",
          }}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}