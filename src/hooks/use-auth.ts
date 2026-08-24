import { useEffect, useState, useRef } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearHoliswissSessionState } from "@/lib/auth-utils";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    
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
  }, []);

  return { session, user, loading };
}
