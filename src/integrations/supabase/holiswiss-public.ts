// Client Supabase public pour le projet Holiswiss (gpldaaqwvwopttachrma)
// Clé anon publique — lecture seule sur les articles validés (RLS)
import { createClient } from '@supabase/supabase-js';

const HOLISWISS_URL = "https://gpldaaqwvwopttachrma.supabase.co";
const HOLISWISS_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwbGRhYXF3dndvcHR0YWNocm1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5ODIyOTAsImV4cCI6MjA5NjU1ODI5MH0.BKuw_l2YrTZXTDHFlMcTC0yoH003_naKeoJXYs61fQg";

export const holiswissPublic = createClient(HOLISWISS_URL, HOLISWISS_ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});
