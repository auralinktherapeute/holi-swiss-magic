import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/database.types";

const SUPABASE_URL = "https://gpldaaqwvwopttachrma.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fVx3CCWLaYMJzliD4Isumw_fOjWU--O";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});