import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearHoliswissSessionState } from "@/lib/auth-utils";
import { AUTH_SPACE_CHANGE_EVENT, getHoliswissAuthSpace } from "@/integrations/supabase/auth-space";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [space, setSpace] = useState(getHoliswissAuthSpace());

  // Écoute les changements d'espace d'authentification (ex: passage de login -> dashboard)
  useEffect(() => {
    const handleSpaceChange = () => {
      setSpace(getHoliswissAuthSpace());
    };
    window.addEventListener(AUTH_SPACE_CHANGE_EVENT, handleSpaceChange);
    // On écoute aussi les changements d'URL car l'espace en dépend
    window.addEventListener("popstate", handleSpaceChange);
    
    return () => {
      window.removeEventListener(AUTH_SPACE_CHANGE_EVENT, handleSpaceChange);
      window.removeEventListener("popstate", handleSpaceChange);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);

    // La souscription est faite sur le client correspondant à l'espace actuel (via le Proxy)
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return;

      if (event === "SIGNED_OUT") {
        clearHoliswissSessionState();
      }

      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [space]); // Se réabonne si l'espace change

  return { session, user, loading, space };
}
