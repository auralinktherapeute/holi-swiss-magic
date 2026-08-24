import { useEffect, useState, useRef } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearHoliswissSessionState } from "@/lib/auth-utils";
import { AUTH_SPACE_CHANGE_EVENT, getHoliswissAuthSpace } from "@/integrations/supabase/auth-space";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [space, setSpace] = useState(getHoliswissAuthSpace());
  const isMounted = useRef(true);

  // Écoute les changements d'espace d'authentification (ex: passage de login -> dashboard)
  useEffect(() => {
    const handleSpaceChange = () => {
      if (isMounted.current) {
        setSpace(getHoliswissAuthSpace());
      }
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
    isMounted.current = true;
    
    // La souscription est faite sur le client correspondant à l'espace actuel (via le Proxy)
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!isMounted.current) return;
      
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
        if (!isMounted.current) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
      })
      .catch(() => {
        if (!isMounted.current) return;
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        if (isMounted.current) setLoading(false);
      });

    return () => {
      isMounted.current = false;
      sub.subscription.unsubscribe();
    };
  }, [space]); // Se réabonne si l'espace change

  return { session, user, loading, space };
}
